import { NotFoundException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Cart } from 'src/cart/cart.schema';
import { Product } from 'src/product/product.schema';
import { Tax } from 'src/tax/tax.schema';
import { Order } from './order.schema';
import { OrderService } from './order.service';

type OrderCreateResult = { data: Record<string, unknown> };

describe('OrderService', () => {
  let service: OrderService;
  let orderModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let cartModel: { findOne: jest.Mock; findOneAndUpdate: jest.Mock };
  let productModel: { findByIdAndUpdate: jest.Mock };
  let mailService: { sendMail: jest.Mock };
  let mockStripe: {
    checkout: { sessions: { create: jest.Mock } };
    webhooks: { constructEvent: jest.Mock };
  };
  let taxModel: { findOne: jest.Mock };

  const user_id = '507f1f77bcf86cd799439011';
  const objectId = (id: string) => new Types.ObjectId(id);

  const populatedCart = (userId: string) => ({
    user: { _id: objectId(userId), email: 'buyer@example.com', name: 'Buyer', address: 'Cairo' },
    cartItems: [
      {
        productId: {
          _id: objectId('507f1f77bcf86cd799439012'),
          title: 'Phone',
          description: 'A nice phone',
          imageCover: 'https://img/phone.jpg',
          images: [],
          price: 100,
          priceAfterDiscount: 80,
        },
        quantity: 2,
        color: 'black',
      },
    ],
    totalPrice: 160,
  });

  beforeEach(async () => {
    orderModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    };
    cartModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    productModel = { findByIdAndUpdate: jest.fn() };
    taxModel = { findOne: jest.fn().mockResolvedValue({ taxPrice: 0, shippingPrice: 0 }) };
    mailService = { sendMail: jest.fn() };
    mockStripe = {
      checkout: { sessions: { create: jest.fn() } },
      webhooks: { constructEvent: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(Cart.name), useValue: cartModel },
        { provide: getModelToken(Tax.name), useValue: taxModel },
        { provide: getModelToken(Product.name), useValue: productModel },
        { provide: MailerService, useValue: mailService },
      ],
    }).compile();

    service = module.get(OrderService);
    (service as unknown as { stripe: typeof mockStripe }).stripe = mockStripe;
  });

  const mockCartFindOne = (cart: unknown) => {
    cartModel.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(cart),
    } as never);
  };

  describe('create (cash)', () => {
    it('decrements stock and resets the cart for a free order', async () => {
      mockCartFindOne({ ...populatedCart(user_id), totalPrice: 0 });
      productModel.findByIdAndUpdate.mockResolvedValue({});
      orderModel.create.mockImplementation(async (dto) => dto);

      await service.create(
        user_id,
        'cash',
        { shippingAddress: 'Alex' },
        { success_url: 'https://x/s', cancel_url: 'https://x/c' },
      );

      expect(productModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { quantity: -2, sold: 2 } },
        { new: true },
      );
      expect(cartModel.findOneAndUpdate).toHaveBeenCalledWith(
        { user: user_id },
        { cartItems: [], totalPrice: 0 },
      );
    });

    it('creates an unpaid order for a paid cash order without touching stock', async () => {
      mockCartFindOne({
        ...populatedCart(user_id),
        totalPrice: 500,
      });
      taxModel.findOne.mockResolvedValue({ taxPrice: 3, shippingPrice: 2 });
      orderModel.create.mockImplementation(async (dto) => dto);

      const result = (await service.create(
        user_id,
        'cash',
        { shippingAddress: 'Alex' },
        { success_url: 'https://x/s', cancel_url: 'https://x/c' },
      )) as OrderCreateResult;

      expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result.data.totalOrderPrice).toBe(505);
      expect(result.data.isPaid).toBe(false);
    });
  });

  describe('create (card)', () => {
    it('bills per item price × quantity plus one Tax & Shipping line', async () => {
      mockCartFindOne(populatedCart(user_id));
      taxModel.findOne.mockResolvedValue({ taxPrice: 3, shippingPrice: 2 });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://stripe/checkout',
        success_url: 'https://x/s',
        cancel_url: 'https://x/c',
        expires_at: 1_700_000_000,
        amount_total: 16_500,
      });
      orderModel.create.mockImplementation(async (dto) => dto);

      const result = await service.create(
        user_id,
        'card',
        { shippingAddress: 'Cairo' },
        { success_url: 'https://x/s', cancel_url: 'https://x/c' },
      );

      const lineItems = mockStripe.checkout.sessions.create.mock.calls[0][0].line_items;
      expect(lineItems).toHaveLength(2);
      // per-item pricing: unit_amount = priceAfterDiscount(80) * 100, quantity 2
      expect(lineItems[0]).toEqual(
        expect.objectContaining({
          quantity: 2,
          price_data: expect.objectContaining({ unit_amount: 8000 }),
        }),
      );
      // tax + shipping as a single line
      expect(lineItems[1]).toEqual(
        expect.objectContaining({
          quantity: 1,
          price_data: expect.objectContaining({ unit_amount: 500 }),
        }),
      );
      expect(result.data.sessionId).toBe('cs_test_1');
    });

    it('bills full price when no discount applies', async () => {
      mockCartFindOne({
        ...populatedCart(user_id),
        cartItems: [
          {
            ...populatedCart(user_id).cartItems[0],
            productId: { ...populatedCart(user_id).cartItems[0].productId, priceAfterDiscount: 0 },
          },
        ],
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({});
      orderModel.create.mockImplementation(async (dto) => dto);

      await service.create(
        user_id,
        'card',
        { shippingAddress: 'Cairo' },
        { success_url: 'https://x/s', cancel_url: 'https://x/c' },
      );

      const lineItems = mockStripe.checkout.sessions.create.mock.calls[0][0].line_items;
      expect(lineItems[0].price_data.unit_amount).toBe(10_000);
    });
  });

  describe('updatePaidCard (webhook)', () => {
    const mockCompletedEvent = () =>
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1' } },
      });

    it('is idempotent: skips an already-paid order', async () => {
      mockCompletedEvent();
      orderModel.findOne.mockResolvedValue({ sessionId: 'cs_test_1', isPaid: true });

      const result = await service.updatePaidCard(
        Buffer.from('payload'),
        'sig',
        'whsec_test',
      );

      expect(result).toEqual({ received: true });
      expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns received for an unknown session id without crashing', async () => {
      mockCompletedEvent();
      orderModel.findOne.mockResolvedValue(null);

      const result = await service.updatePaidCard(
        Buffer.from('payload'),
        'sig',
        'whsec_test',
      );

      expect(result).toEqual({ received: true });
    });

    it('marks the order paid, decrements stock, resets the cart and mails the buyer', async () => {
      mockCompletedEvent();
      const save = jest.fn().mockResolvedValue(undefined);
      const order = {
        sessionId: 'cs_test_1',
        isPaid: false,
        user: { toString: () => user_id },
        isDeliverd: false,
        paidAt: null,
        deliverdAt: null,
        save,
      };
      orderModel.findOne.mockResolvedValue(order);
      mockCartFindOne(populatedCart(user_id));
      productModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.updatePaidCard(
        Buffer.from('payload'),
        'sig',
        'whsec_test',
      );

      expect(result).toEqual({ received: true });
      expect(order.isPaid).toBe(true);
      expect(save).toHaveBeenCalled();
      expect(productModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(cartModel.findOneAndUpdate).toHaveBeenCalledWith(
        { user: user_id },
        { cartItems: [], totalPrice: 0 },
      );
      expect(mailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'buyer@example.com' }),
      );
    });
  });

  describe('updatePaidCash', () => {
    it('rejects non-cash orders', async () => {
      orderModel.findById.mockResolvedValue({
        paymentMethodType: 'card',
        isPaid: false,
      });

      await expect(
        service.updatePaidCash('order1', {
          isPaid: true,
          paidAt: new Date(),
          isDelivered: false,
          deliveredAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects orders that are already paid', async () => {
      orderModel.findById.mockResolvedValue({
        paymentMethodType: 'cash',
        isPaid: true,
      });

      await expect(
        service.updatePaidCash('order1', {
          isPaid: true,
          paidAt: new Date(),
          isDelivered: false,
          deliveredAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});