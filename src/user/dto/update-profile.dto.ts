import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UpdateProfileDto {
  // Name
  @IsOptional()
  @IsString({ message: i18nValidationMessage('dto.IS_STRING') })
  @MinLength(3, { message: i18nValidationMessage('dto.MinLength') })
  @MaxLength(30, { message: i18nValidationMessage('dto.MaxLength') })
  name?: string;
  // Avatar
  @IsOptional()
  @IsString({ message: 'avatar must be a string' })
  @IsUrl({}, { message: 'avatar must be a valid URL' })
  avatar?: string;
  //   Age
  @IsOptional()
  @IsNumber({}, { message: 'age must be a number' })
  age?: number;
  // PhoneNumber
  @IsOptional()
  @IsString({ message: 'phoneNumber must be a string' })
  @IsPhoneNumber('EG', {
    message: 'phoneNumber must be a Egyptian phone number',
  })
  phoneNumber?: string;
  // Address
  @IsOptional()
  @IsString({ message: 'address must be a string' })
  address?: string;
  // Gender
  @IsOptional()
  @IsEnum(['male', 'female'], { message: 'gender must be male or female' })
  gender?: 'male' | 'female';
}