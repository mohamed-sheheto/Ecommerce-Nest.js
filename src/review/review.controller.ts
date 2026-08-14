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
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Roles } from 'src/user/decorator/Roles.decorator';
import { AuthGuard } from 'src/user/guard/Auth.guard';
import { CurrentUser } from 'src/user/decorator/current-user.decorator';
import { AuthenticatedUser } from 'src/user/guard/auth.types';

@Controller('v1/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  //  @docs   Any User logged Can Create Review on any product
  //  @Route  POST /api/v1/review
  //  @access Private [User]
  @Post()
  @Roles(['user'])
  @UseGuards(AuthGuard)
  create(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    createReviewDto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.create(createReviewDto, user._id);
  }

  //  @docs   Any User Can Get All Reviews On Product
  //  @Route  GET /api/v1/review
  //  @access Public
  @Get(':id')
  findAll(@Param('id') product_id: string) {
    return this.reviewService.findAll(product_id);
  }

  //  @docs   User logged Can Only update Their Review
  //  @Route  PATCH /api/v1/review
  //  @access Private [User]
  @Patch(':id')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.update(id, updateReviewDto, user._id);
  }

  //  @docs   User logged Can Only delete Their Review
  //  @Route  DELETE /api/v1/review
  //  @access Private [User]
  @Delete(':id')
  @Roles(['user'])
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewService.remove(id, user._id);
  }
}
@Controller('v1/dashboard/reviews')
export class ReviewDashboardController {
  constructor(private readonly reviewService: ReviewService) {}

  //  @docs   Any User Can Get All Reviews On User
  //  @Route  GET /api/v1/review
  //  @access Private [Admin]
  @Get(':id')
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  findOne(@Param('id') user_id: string) {
    return this.reviewService.findOne(user_id);
  }
}