import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { AcceptOrderCashDto, CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from 'src/user/guard/Auth.guard';
import { Roles } from 'src/user/decorator/Roles.decorator';
import { CurrentUser } from 'src/user/decorator/current-user.decorator';
import { AuthenticatedUser } from 'src/user/guard/auth.types';
import { Request } from 'express';
import { env } from 'src/config/env';

@Controller('v1/cart/checkout')
export class OrderCheckoutController {
  constructor(private readonly orderService: OrderService) {}

  //  @docs   User Can Create Order and Checkout session
  //  @Route  POST /api/v1/cart/checkout/:paymentMethodType?success_url=https://ecommerce-nestjs.com&cancel_url=https://ecommerce-nestjs.com
  //  @access Private [User]
  @Post(':paymentMethodType')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  create(
    @Param('paymentMethodType') paymentMethodType: 'card' | 'cash',
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    createOrderDto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string>,
  ) {
    if (!['card', 'cash'].includes(paymentMethodType)) {
      throw new BadRequestException('Invalid payment method');
    }
    const {
      success_url = 'https://ecommerce-nestjs.com',
      cancel_url = 'https://ecommerce-nestjs.com',
    } = query;

    const dataAfterPayment = {
      success_url,
      cancel_url,
    };

    return this.orderService.create(
      user._id,
      paymentMethodType,
      createOrderDto,
      dataAfterPayment,
    );
  }

  //  @docs   Admin Can Update Order payment cash
  //  @Route  PATCH /api/v1/cart/checkout/:orderId/cash
  //  @access Private [Admin]
  @Patch(':orderId/cash')
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  updatePaidCash(
    @Param('orderId') orderId: string,
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    updateOrderDto: AcceptOrderCashDto,
  ) {
    return this.orderService.updatePaidCash(orderId, updateOrderDto);
  }
}

@Controller('v1/checkout/session')
export class CheckoutCardController {
  constructor(private readonly orderService: OrderService) {}

  //  @docs   Webhook paid order true auto
  //  @Route  PATCH /api/v1/checkout/session
  //  @access Private [Stripe]
  @Post()
  updatePaidCard(
    @Headers('stripe-signature') sig: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const payload = request.rawBody;
    if (!payload) {
      throw new BadRequestException('Missing raw webhook body');
    }
    return this.orderService.updatePaidCard(
      payload,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  }
}

@Controller('v1/order/user')
export class OrderForUserController {
  constructor(private readonly orderService: OrderService) {}

  //  @docs   User Can get all order
  //  @Route  GET /api/v1/order/user
  //  @access Private [User]
  @Get()
  @Roles(['user'])
  @UseGuards(AuthGuard)
  findAllOrdersOnUser(@CurrentUser() user: AuthenticatedUser) {
    return this.orderService.findAllOrdersOnUser(user._id);
  }
}
@Controller('v1/order/admin')
export class OrderForAdminController {
  constructor(private readonly orderService: OrderService) {}

  //  @docs   Admin Can get all order
  //  @Route  GET /api/v1/order/admin
  //  @access Private [Admin]
  @Get()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  findAllOrders() {
    return this.orderService.findAllOrders();
  }
  //  @docs   Admin Can get all order
  //  @Route  GET /api/v1/order/admin/:userId
  //  @access Private [Admin]
  @Get(':userId')
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  findAllOrdersByUserId(@Param('userId') userId: string) {
    return this.orderService.findAllOrdersOnUser(userId);
  }
}

/*
stripe login
stripe listen --forward-to localhost:3000/api/v1/checkout/session
*/