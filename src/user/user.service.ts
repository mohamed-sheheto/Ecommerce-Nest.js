import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './user.schema';
import { FilterQuery, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { I18nContext } from 'nestjs-i18n';
import { env } from 'src/config/env';
import { AuthenticatedUser } from './guard/auth.types';
import { toUserResponse } from './user.mapper';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from 'src/common/pagination';

export interface UserListQuery {
  _limit?: unknown;
  skip?: unknown;
  sort?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
}

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}
  async create(
    createUserDto: CreateUserDto,
    i18n: I18nContext,
  ): Promise<{ status: number; message: string; data: ReturnType<typeof toUserResponse> }> {
    const ifUserExist = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (ifUserExist) {
      throw new ConflictException(
        await i18n.t('service.ALREADY_EXIST', {
          args: { module_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    const password = await bcrypt.hash(createUserDto.password, env.BCRYPT_ROUNDS);
    const user = {
      password,
      role: createUserDto.role ?? 'user',
      active: true,
    };
    const newUser = await this.userModel.create({ ...createUserDto, ...user });
    return {
      status: 200,
      message: await i18n.t('service.CREATED_SUCCESS', {
        args: { module_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
      }),
      data: toUserResponse(newUser),
    };
  }

  async findAll(query: UserListQuery, i18n: I18nContext) {
    const rawLimit = Number(query._limit ?? DEFAULT_PAGE_SIZE);
    if (Number.isNaN(rawLimit) || rawLimit < 1) {
      throw new BadRequestException(
        await i18n.t('service.INVALID', { args: { invalid_name: 'limit' } }),
      );
    }
    const limit = Math.min(rawLimit, MAX_PAGE_SIZE);

    const rawSkip = Number(query.skip ?? 0);
    if (Number.isNaN(rawSkip) || rawSkip < 0) {
      throw new BadRequestException(
        await i18n.t('service.INVALID', { args: { invalid_name: 'skip' } }),
      );
    }
    const skip = rawSkip;

    const sort = query.sort === 'desc' ? 'desc' : 'asc';

    const filter: FilterQuery<User> = {};
    if (query.name) {
      filter.name = { $regex: new RegExp(String(query.name), 'i') };
    }
    if (query.email) {
      filter.email = { $regex: new RegExp(String(query.email), 'i') };
    }
    if (query.role) {
      filter.role = { $regex: new RegExp(String(query.role), 'i') };
    }

    const users = await this.userModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ name: sort })
      .select('-password -__v')
      .exec();
    return {
      status: 200,
      message: await i18n.t('service.FOUND_SUCCESS', {
        args: { found_name: i18n.lang === 'en' ? 'Users' : 'المستخدمين' },
      }),
      length: users.length,
      data: users.map(toUserResponse),
    };
  }

  async findOne(
    id: string,
    i18n: I18nContext,
  ): Promise<{ status: number; data: ReturnType<typeof toUserResponse> }> {
    const user = await this.userModel.findById(id).select('-password -__v');
    if (!user) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    return {
      status: 200,
      data: toUserResponse(user),
    };
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    i18n: I18nContext,
  ): Promise<{
    status: number;
    message: string;
    data: ReturnType<typeof toUserResponse>;
  }> {
    const userExist = await this.userModel.findById(id).select('-password -__v');
    if (!userExist) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    const user: Record<string, unknown> = { ...updateUserDto };
    if (updateUserDto.password) {
      const password = await bcrypt.hash(updateUserDto.password, env.BCRYPT_ROUNDS);
      user.password = password;
    }
    const updated = await this.userModel
      .findByIdAndUpdate(id, user, { new: true })
      .select('-password -__v');
    if (!updated) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    return {
      status: 200,
      message: await i18n.t('service.UPDATED_SUCCESS', {
        args: { updated_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
      }),
      data: toUserResponse(updated),
    };
  }

  async remove(
    id: string,
    i18n: I18nContext,
  ): Promise<{ status: number; message: string }> {
    const user = await this.userModel.findById(id).select('-password -__v');
    if (!user) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    await this.userModel.findByIdAndDelete(id);
    return {
      status: 200,
      message: await i18n.t('service.DELETED_SUCCESS', {
        args: { deleted_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
      }),
    };
  }

  // ===================== For User =====================
  async getMe(payload: AuthenticatedUser, i18n: I18nContext) {
    const user = await this.userModel
      .findById(payload._id)
      .select('-password -__v');
    if (!user) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    return {
      status: 200,
      message: await i18n.t('service.FOUND_SUCCESS', {
        args: { found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
      }),
      data: toUserResponse(user),
    };
  }

  async updateMe(
    payload: AuthenticatedUser,
    updateProfileDto: UpdateProfileDto,
    i18n: I18nContext,
  ) {
    const user = await this.userModel
      .findById(payload._id)
      .select('-password -__v');
    if (!user) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    const updated = await this.userModel
      .findByIdAndUpdate(payload._id, updateProfileDto, { new: true })
      .select('-password -__v');
    if (!updated) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    return {
      status: 200,
      message: await i18n.t('service.UPDATED_SUCCESS', {
        args: { updated_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
      }),
      data: toUserResponse(updated),
    };
  }

  // User Can unActive Account
  async deleteMe(payload: AuthenticatedUser, i18n: I18nContext) {
    const user = await this.userModel
      .findById(payload._id)
      .select('-password -__v');
    if (!user) {
      throw new NotFoundException(
        await i18n.t('service.NOT_FOUND', {
          args: { not_found_name: i18n.lang === 'en' ? 'User' : 'المستخدم' },
        }),
      );
    }
    await this.userModel.findByIdAndUpdate(payload._id, { active: false });
  }
}