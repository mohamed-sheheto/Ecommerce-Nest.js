import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRequestProductDto {
  @IsString({ message: 'title must be a string' })
  titleNeed!: string;

  @IsString({ message: 'details must be a string' })
  @MinLength(5, { message: 'Details must be at least 5 characters' })
  details!: string;
  @IsNumber({}, { message: 'quantity must be a number' })
  @Min(1, { message: 'Qauntity must be at least 1 product' })
  quantity!: number;
  @IsOptional()
  @IsString({ message: 'category must be a string' })
  category!: string;
}
