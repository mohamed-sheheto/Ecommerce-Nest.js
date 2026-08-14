import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { RequestProductService } from './request-product.service';
import { CreateRequestProductDto } from './dto/create-request-product.dto';
import { UpdateRequestProductDto } from './dto/update-request-product.dto';
import { Roles } from 'src/user/decorator/Roles.decorator';
import { AuthGuard } from 'src/user/guard/Auth.guard';
import { CurrentUser } from 'src/user/decorator/current-user.decorator';
import { AuthenticatedUser } from 'src/user/guard/auth.types';

@Controller('v1/request-products')
export class RequestProductController {
  constructor(private readonly requestProductService: RequestProductService) {}

  //  @docs   User Can Create a Request Product
  //  @Route  POST /api/v1/request-product
  //  @access Private [user]
  @Post()
  @Roles(['user'])
  @UseGuards(AuthGuard)
  create(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    createRequestProductDto: CreateRequestProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requestProductService.create({
      ...createRequestProductDto,
      user: user._id,
    });
  }

  //  @docs   Admin Can get All Request Product
  //  @Route  GET /api/v1/request-product
  //  @access Private [Admin]
  @Get()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  findAll() {
    return this.requestProductService.findAll();
  }

  //  @docs   Admin Can get Any Single Request Product and User Can Get Only Their Request Product
  //  @Route  GET /api/v1/request-product
  //  @access Private [Admin, User]
  @Get(':id')
  @Roles(['admin', 'user'])
  @UseGuards(AuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requestProductService.findOne(id, {
      userId: user._id,
      role: user.role,
    });
  }

  //  @docs   User Can Update Only Their Request Product
  //  @Route  PATCH /api/v1/request-product
  //  @access Private [User]
  @Patch(':id')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    updateRequestProductDto: UpdateRequestProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requestProductService.update(id, {
      ...updateRequestProductDto,
      user: user._id,
    });
  }

  //  @docs   User Can Delete Only Their Request Product
  //  @Route  DELETE /api/v1/request-product
  //  @access Private [User]
  @Delete(':id')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requestProductService.remove(id, user._id);
  }
}