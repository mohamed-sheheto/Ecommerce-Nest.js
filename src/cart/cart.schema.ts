import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Coupon } from 'src/coupon/coupon.schema';
import { Product } from 'src/product/product.schema';
import { User } from 'src/user/user.schema';

export type cartDocument = HydratedDocument<Cart>;

export interface CartItem {
  productId: Types.ObjectId;
  quantity: number;
  color: string;
}

export interface PopulatedCartItem {
  productId: (Product & { _id: Types.ObjectId }) | null;
  quantity: number;
  color: string;
}

export interface CartCoupon {
  name: string;
  couponId: Types.ObjectId;
}

@Schema({ timestamps: true })
export class Cart {
  @Prop({
    type: [
      {
        productId: {
          type: MongooseSchema.Types.ObjectId,
          require: true,
          ref: Product.name,
        },
        quantity: {
          type: Number,
          default: 1,
        },
        color: {
          type: String,
          default: '',
        },
      },
    ],
  })
  cartItems!: CartItem[];

  @Prop({
    type: Number,
    required: true,
  })
  totalPrice!: number;

  @Prop({
    type: Number,
  })
  totalPriceAfterDiscount?: number;

  @Prop({
    type: [
      {
        name: {
          type: String,
        },
        couponId: {
          type: MongooseSchema.Types.ObjectId,
          ref: Coupon.name,
        },
      },
    ],
  })
  coupons!: CartCoupon[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
  })
  user!: User;
}

export const cartSchema = SchemaFactory.createForClass(Cart);