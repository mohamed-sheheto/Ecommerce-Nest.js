import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Review } from './review.schema';
import { Model } from 'mongoose';
import { Product } from 'src/product/product.schema';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModule: Model<Review>,
    @InjectModel(Product.name) private readonly productModule: Model<Product>,
  ) {}

  private async recomputeProductRating(productId: string): Promise<void> {
    const reviewsOnSingleProduct = await this.reviewModule
      .find({
        product: productId,
      })
      .select('rating');
    const ratingsQuantity = reviewsOnSingleProduct.length;
    let ratingsAverage = 0;
    if (ratingsQuantity > 0) {
      let totalRatings = 0;
      for (const review of reviewsOnSingleProduct) {
        totalRatings += review.rating;
      }
      ratingsAverage = totalRatings / ratingsQuantity;
    }

    await this.productModule.findByIdAndUpdate(productId, {
      ratingsAverage,
      ratingsQuantity,
    });
  }

  async create(createReviewDto: CreateReviewDto, user_id: string) {
    const review = await this.reviewModule.findOne({
      user: user_id,
      product: createReviewDto.product,
    });

    if (review) {
      throw new ConflictException(
        'This User already Created Review On this Product',
      );
    }

    const newReview = await (
      await this.reviewModule.create({
        ...createReviewDto,
        user: user_id,
      })
    ).populate('product user', 'name email title description imageCover');

    // Rating in product module
    await this.recomputeProductRating(createReviewDto.product);

    return {
      status: 200,
      message: 'Review Created successfully',
      data: newReview,
    };
  }

  async findAll(product_id: string) {
    const review = await this.reviewModule
      .find({ product: product_id })
      .populate('user product', 'name email title')
      .select('-__v');
    return {
      status: 200,
      message: 'Reviews Found',
      length: review.length,
      data: review,
    };
  }

  async findOne(user_id: string) {
    const review = await this.reviewModule
      .find({ user: user_id })
      .populate('user product', 'name role email title')
      .select('-__v');
    return {
      status: 200,
      message: 'Reviews Found',
      length: review.length,
      data: review,
    };
  }

  async update(id: string, updateReviewDto: UpdateReviewDto, user_id: string) {
    const findReview = await this.reviewModule.findById(id);

    if (!findReview) {
      throw new NotFoundException('Not Found Review On this Id');
    }

    if (user_id.toString() !== findReview.user.toString()) {
      throw new UnauthorizedException();
    }

    const updateReview = await this.reviewModule
      .findByIdAndUpdate(
        id,
        {
          ...updateReviewDto,
          user: user_id,
          product: updateReviewDto.product,
        },
        { new: true },
      )
      .select('-__v');
    // Rating in product module
    await this.recomputeProductRating(findReview.product.toString());

    return {
      status: 200,
      message: 'Review Updated successfully',
      data: updateReview,
    };
  }

  async remove(id: string, user_id: string): Promise<void> {
    const findReview = await this.reviewModule.findById(id);

    if (!findReview) {
      throw new NotFoundException('Not Found Review On this Id');
    }
    if (user_id.toString() !== findReview.user.toString()) {
      throw new UnauthorizedException();
    }
    await this.reviewModule.findByIdAndDelete(id);
    // Rating in product module
    await this.recomputeProductRating(findReview.product.toString());
  }
}