import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AcceptOrderCashDto, CreateOrderDto } from './dto/create-order.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from './order.schema';
import { Model, Types } from 'mongoose';
import { Cart } from 'src/cart/cart.schema';
import { Tax } from 'src/tax/tax.schema';
import { Product } from 'src/product/product.schema';
import { User } from 'src/user/user.schema';
import { MailerService } from '@nestjs-modules/mailer';
import Stripe from 'stripe';
import { env } from 'src/config/env';

type PopulatedCartItem = {
  productId: (Product & { _id: Types.ObjectId }) | null;
  quantity: number;
  color: string;
};

type PopulatedCart = {
  user: (User & { _id: Types.ObjectId }) | null;
  cartItems: PopulatedCartItem[];
  totalPrice: number;
};

const MAX_ORDERS = 100;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly stripe = new Stripe(env.STRIPE_SECRET_KEY);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(Cart.name) private readonly cartModel: Model<Cart>,
    @InjectModel(Tax.name) private readonly taxModel: Model<Tax>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    private readonly mailService: MailerService,
  ) {}

  private async getCartWithProducts(
    user_id: string,
  ): Promise<PopulatedCart> {
    const cart = await this.cartModel
      .findOne({ user: user_id })
      .populate<{ cartItems: PopulatedCartItem[]; user: (User & { _id: Types.ObjectId }) | null }>(
        'cartItems.productId user',
      );
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    return {
      user: cart.user,
      cartItems: cart.cartItems,
      totalPrice: cart.totalPrice,
    };
  }

  private buildProductLineItems(
    cart: PopulatedCart,
  ): Stripe.Checkout.SessionCreateParams.LineItem[] {
    return cart.cartItems.map(({ productId, quantity, color }) => {
      if (!productId) {
        throw new NotFoundException(
          'A product in your cart is no longer available',
        );
      }
      const unitPrice =
        productId.priceAfterDiscount && productId.priceAfterDiscount > 0
          ? productId.priceAfterDiscount
          : productId.price;
      return {
        price_data: {
          currency: 'egp',
          unit_amount: Math.round(unitPrice * 100),
          product_data: {
            name: productId.title,
            description: productId.description,
            images: [productId.imageCover, ...(productId.images ?? [])],
            metadata: { color },
          },
        },
        quantity,
      };
    });
  }

  private buildTaxAndShippingLine(
    taxPrice: number,
    shippingPrice: number,
  ): Stripe.Checkout.SessionCreateParams.LineItem | null {
    const total = taxPrice + shippingPrice;
    if (total <= 0) {
      return null;
    }
    return {
      price_data: {
        currency: 'egp',
        unit_amount: Math.round(total * 100),
        product_data: {
          name: 'Tax & Shipping',
        },
      },
      quantity: 1,
    };
  }

  private async applyStockDecrements(
    cart: PopulatedCart,
  ): Promise<{ productId: string; quantity: number }[]> {
    const applied: { productId: string; quantity: number }[] = [];
    await Promise.all(
      cart.cartItems.map(async (item) => {
        if (!item.productId) {
          throw new NotFoundException(
            'A product in your cart is no longer available',
          );
        }
        const updated = await this.productModel.findByIdAndUpdate(
          item.productId._id,
          { $inc: { quantity: -item.quantity, sold: item.quantity } },
          { new: true },
        );
        if (!updated) {
          throw new NotFoundException('Product not found');
        }
        applied.push({
          productId: String(item.productId._id),
          quantity: item.quantity,
        });
      }),
    );
    return applied;
  }

  private async compensateStockDecrements(
    applied: { productId: string; quantity: number }[],
  ): Promise<void> {
    await Promise.all(
      applied.map(({ productId, quantity }) =>
        this.productModel.findByIdAndUpdate(
          productId,
          { $inc: { quantity, sold: -quantity } },
          { new: true },
        ),
      ),
    );
  }

  private async resetCart(user_id: string): Promise<void> {
    await this.cartModel.findOneAndUpdate(
      { user: user_id },
      { cartItems: [], totalPrice: 0 },
    );
  }

  private async sendOrderConfirmationMail(
    email: string,
    name: string,
  ): Promise<void> {
    const htmlMessage = `
    <html>
      <body>
        <h1>Order Confirmation</h1>
        <p>Dear ${name},</p>
        <p>Thank you for your purchase! Your order has been successfully placed and paid.</p>
        <p>We appreciate your business and hope you enjoy your purchase!</p>
        <p>Best regards,</p>
        <p>The Ecommerce-Nest.JS Team</p>
      </body>
    </html>
    `;
    await this.mailService.sendMail({
      from: `Ecommerce-Nest.JS <${env.MAIL_USER}>`,
      to: email,
      subject: `Ecommerce-Nest.JS - Checkout Order`,
      html: htmlMessage,
    });
  }

  async create(
    user_id: string,
    paymentMethodType: 'card' | 'cash',
    createOrderDto: CreateOrderDto,
    dataAfterPayment: {
      success_url: string;
      cancel_url: string;
    },
  ) {
    const cart = await this.getCartWithProducts(user_id);
    const shippingAddress = cart.user?.address
      ? cart.user.address
      : createOrderDto.shippingAddress || false;

    if (!shippingAddress) {
      throw new NotFoundException('Shipping address not found');
    }

    const tax = await this.taxModel.findOne({});
    const taxPrice = tax?.taxPrice ?? 0;
    const shippingPrice = tax?.shippingPrice ?? 0;

    const orderData = {
      user: user_id,
      cartItems: cart.cartItems,
      taxPrice,
      shippingPrice,
      totalOrderPrice: cart.totalPrice + taxPrice + shippingPrice,
      paymentMethodType,
      shippingAddress,
    };

    if (paymentMethodType === 'cash') {
      const order = await this.orderModel.create({
        ...orderData,
        isPaid: orderData.totalOrderPrice === 0,
        paidAt: orderData.totalOrderPrice === 0 ? new Date() : null,
        isDelivered: false,
      });
      if (orderData.totalOrderPrice === 0) {
        await this.applyStockDecrements(cart);
        await this.resetCart(user_id);
      }

      return {
        status: 200,
        message: 'Order created successfully',
        data: order,
      };
    }

    const lineItems = this.buildProductLineItems(cart);
    const taxAndShippingLine = this.buildTaxAndShippingLine(
      taxPrice,
      shippingPrice,
    );
    const allLineItems = taxAndShippingLine
      ? [...lineItems, taxAndShippingLine]
      : lineItems;

    const session = await this.stripe.checkout.sessions.create({
      line_items: allLineItems,
      mode: 'payment',
      success_url: dataAfterPayment.success_url,
      cancel_url: dataAfterPayment.cancel_url,
      client_reference_id: user_id.toString(),
      customer_email: cart.user?.email,
      metadata: {
        address: orderData.shippingAddress,
      },
    });

    const order = await this.orderModel.create({
      ...orderData,
      sessionId: session.id,
      isPaid: false,
      isDelivered: false,
    });

    return {
      status: 200,
      message: 'Order created successfully',
      data: {
        url: session.url,
        success_url: `${session.success_url}?session_id=${session.id}`,
        cancel_url: session.cancel_url,
        expires_at: new Date(session.expires_at * 1000),
        sessionId: session.id,
        totalPrice: session.amount_total,
        data: order,
      },
    };
  }

  async updatePaidCash(orderId: string, updateOrderDto: AcceptOrderCashDto) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentMethodType !== 'cash') {
      throw new NotFoundException('This order not paid by cash');
    }

    if (order.isPaid) {
      throw new NotFoundException('Order already paid');
    }

    if (updateOrderDto.isPaid) {
      updateOrderDto.paidAt = new Date();
      const cart = await this.getCartWithProducts(order.user.toString());
      await this.applyStockDecrements(cart);
      await this.resetCart(order.user.toString());

      if (cart.user) {
        await this.sendOrderConfirmationMail(
          cart.user.email,
          cart.user.name,
        );
      }
    }

    if (updateOrderDto.isDelivered) {
      updateOrderDto.deliveredAt = new Date();
    }

    const updatedOrder = await this.orderModel.findByIdAndUpdate(
      orderId,
      { ...updateOrderDto },
      { new: true },
    );

    return {
      status: 200,
      message: 'Order updated successfully',
      data: updatedOrder,
    };
  }

  async updatePaidCard(
    payload: Buffer,
    sig: string,
    endpointSecret: string,
  ) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        sig,
        endpointSecret,
      );
    } catch (err) {
      this.logger.error({ err, eventId: undefined }, 'webhook signature invalid');
      throw new BadRequestException('Webhook signature verification failed');
    }

    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data.object.id;

      const order = await this.orderModel.findOne({ sessionId });
      if (!order) {
        this.logger.error(
          { sessionId, eventId: event.id },
          'webhook received for unknown order',
        );
        return { received: true };
      }

      if (order.isPaid) {
        return { received: true };
      }

      const cart = await this.getCartWithProducts(order.user.toString());

      let applied: { productId: string; quantity: number }[] = [];
      try {
        applied = await this.applyStockDecrements(cart);

        order.isPaid = true;
        order.isDelivered = true;
        order.paidAt = new Date();
        order.deliveredAt = new Date();
        await order.save();

        await this.resetCart(order.user.toString());

        if (cart.user) {
          await this.sendOrderConfirmationMail(cart.user.email, cart.user.name);
        }
      } catch (err) {
        await this.compensateStockDecrements(applied);
        this.logger.error(
          { err, eventId: event.id, sessionId },
          'webhook processing failed',
        );
        throw err;
      }
    } else {
      this.logger.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  }

  async findAllOrdersOnUser(user_id: string) {
    const orders = await this.orderModel.find({ user: user_id }).limit(MAX_ORDERS);
    return {
      status: 200,
      message: 'Orders found',
      length: orders.length,
      data: orders,
    };
  }

  async findAllOrders() {
    const orders = await this.orderModel.find({}).limit(MAX_ORDERS);
    return {
      status: 200,
      message: 'Orders found',
      length: orders.length,
      data: orders,
    };
  }
}