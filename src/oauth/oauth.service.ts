import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'src/user/user.schema';

import * as bcrypt from 'bcrypt';
import { env } from 'src/config/env';
import { Role } from 'src/user/roles';
import { toUserResponse } from 'src/user/user.mapper';

type UserData = {
  userId: string;
  email: string;
  name: string;
  photo?: string;
};

function generateRandomPassword() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]\\:;?><,./-=';
  let password = '';
  const passwordLength = Math.floor(Math.random() * (20 - 4 + 1)) + 4;

  for (let i = 0; i < passwordLength; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }

  return password;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  private async issueTokens(user: {
    _id: string | Types.ObjectId;
    email: string;
    role: Role;
  }): Promise<{ access_token: string; refresh_token: string }> {
    const payload = {
      _id: user._id,
      email: user.email,
      role: user.role,
    };
    const access_token = await this.jwtService.signAsync(payload, {
      secret: env.JWT_SECRET,
    });
    const refresh_token = await this.jwtService.signAsync(
      { ...payload, countEX: 5 },
      {
        secret: env.JWT_SECRET_REFRESHTOKEN,
        expiresIn: '7d',
      },
    );
    return { access_token, refresh_token };
  }

  async validateUser(userData: UserData) {
    const user = await this.userModel.findOne({ email: userData.email });
    if (!user) {
      const password = await bcrypt.hash(
        generateRandomPassword(),
        env.BCRYPT_ROUNDS,
      );
      const newUser = await this.userModel.create({
        email: userData.email,
        name: userData.name,
        avatar: userData.photo,
        password,
        role: 'user',
      });
      const tokens = await this.issueTokens(newUser);
      return {
        status: 200,
        message: 'User created successfully',
        data: toUserResponse(newUser),
        ...tokens,
      };
    }

    const tokens = await this.issueTokens(user);
    return {
      status: 200,
      message: 'User logged in successfully',
      data: toUserResponse(user),
      ...tokens,
    };
  }
}