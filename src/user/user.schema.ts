import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role, ROLES } from './roles';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({
    type: String,
    required: true,
    min: [3, 'Name must be at least 3 characters'],
    max: [30, 'Name must be at most 30 characters'],
  })
  name!: string;
  @Prop({
    type: String,
    required: true,
    unique: true,
  })
  email!: string;
  @Prop({
    type: String,
    required: true,
    min: [3, 'password must be at least 3 characters'],
    max: [20, 'password must be at most 20 characters'],
    select: false,
  })
  password!: string;
  @Prop({
    type: String,
    required: true,
    enum: ROLES,
    default: 'user',
  })
  role!: Role;
  @Prop({
    type: String,
  })
  avatar!: string;
  @Prop({
    type: Number,
  })
  age!: number;
  @Prop({
    type: String,
  })
  phoneNumber!: string;
  @Prop({
    type: String,
  })
  address!: string;
  @Prop({
    type: Boolean,
  })
  active!: boolean;
  @Prop({
    type: String,
    select: false,
  })
  verificationCode!: string;
  @Prop({
    type: Date,
    select: false,
  })
  verificationCodeExpiresAt!: Date;
  @Prop({
    type: Number,
    default: 0,
    select: false,
  })
  verificationAttempts!: number;
  @Prop({
    type: Date,
  })
  passwordResetVerifiedAt!: Date;
  @Prop({
    type: String,
    enum: ['male', 'female'],
  })
  gender!: 'male' | 'female';
}

export const userSchema = SchemaFactory.createForClass(User);