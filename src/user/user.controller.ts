import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { UserService, UserListQuery } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from './guard/Auth.guard';
import { Roles } from './decorator/Roles.decorator';
import { I18nContext, I18nLang } from 'nestjs-i18n';
import { CurrentUser } from './decorator/current-user.decorator';
import { AuthenticatedUser } from './guard/auth.types';

@Controller('v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  //  @docs   Create User
  //  @Route  POST /api/v1/user
  //  @access Admin
  @Post()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  create(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    createUserDto: CreateUserDto,
    @I18nLang() i18n: I18nContext,
  ) {
    return this.userService.create(createUserDto, i18n);
  }

  //  @docs   Find All Users
  //  @Route  GET /api/v1/user
  //  @access Admin
  @Get()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  findAll(@Query() query: UserListQuery, @I18nLang() i18n: I18nContext) {
    return this.userService.findAll(query, i18n);
  }

  //  @docs   Find All Users
  //  @Route  GET /api/v1/user/:id
  //  @access Admin
  @Get(':id')
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string, @I18nLang() i18n: I18nContext) {
    return this.userService.findOne(id, i18n);
  }

  //  @docs   Update User
  //  @Route  PATCH /api/v1/user/:id
  //  @access Admin
  @Patch(':id')
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ forbidNonWhitelisted: true }))
    updateUserDto: UpdateUserDto,
    @I18nLang() i18n: I18nContext,
  ) {
    return this.userService.update(id, updateUserDto, i18n);
  }

  //  @docs   Delete User
  //  @Route  DELETE /api/v1/user/:id
  //  @access Admin
  @Delete(':id')
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @I18nLang() i18n: I18nContext) {
    return this.userService.remove(id, i18n);
  }

  //  @docs   Get Me
  //  @Route  GET /api/v1/user/me
  //  @access Private for users=> admin, user (loged)
  @Get('me')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser, @I18nLang() i18n: I18nContext) {
    return this.userService.getMe(user, i18n);
  }

  //  @docs   Update Me
  //  @Route  PATCH /api/v1/user/me
  //  @access Private for users=> admin, user (loged)
  @Patch('me')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(
      new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }),
    )
    updateProfileDto: UpdateProfileDto,
    @I18nLang() i18n: I18nContext,
  ) {
    return this.userService.updateMe(user, updateProfileDto, i18n);
  }

  //  @docs   User Can UnActive Account
  //  @Route  DELETE /api/v1/user/me
  //  @access Private for users=> admin, user (loged)
  @Delete('me')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  @HttpCode(204)
  deleteMe(@CurrentUser() user: AuthenticatedUser, @I18nLang() i18n: I18nContext) {
    return this.userService.deleteMe(user, i18n);
  }
}
