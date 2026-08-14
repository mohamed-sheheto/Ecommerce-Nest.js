import { Role } from './roles';

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  age?: number;
  phoneNumber?: string;
  address?: string;
  gender?: 'male' | 'female';
  active?: boolean;
  createdAt?: Date;
}

type UserLike = {
  _id: { toString(): string } | string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  age?: number;
  phoneNumber?: string;
  address?: string;
  gender?: 'male' | 'female';
  active?: boolean;
  createdAt?: Date;
};

export function toUserResponse(user: UserLike): UserResponse {
  return {
    _id:
      typeof user._id === 'string'
        ? user._id
        : user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    age: user.age,
    phoneNumber: user.phoneNumber,
    address: user.address,
    gender: user.gender,
    active: user.active,
    createdAt: user.createdAt,
  };
}