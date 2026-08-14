import { Injectable } from '@nestjs/common';
import { CreateTaxDto } from './dto/create-tax.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Tax } from './tax.schema';
import { Model } from 'mongoose';

@Injectable()
export class TaxService {
  constructor(@InjectModel(Tax.name) private readonly taxModel: Model<Tax>) {}
  async createOrUpdate(createTaxDto: CreateTaxDto) {
    const tax = await this.taxModel.findOne({});
    if (!tax) {
      // Create New Tax
      const newTax = await this.taxModel.create(createTaxDto);
      return {
        status: 200,
        message: 'Tax created successfully',
        data: newTax,
      };
    }
    // Update Tax
    const updateTax = await this.taxModel
      .findOneAndUpdate({}, createTaxDto, {
        new: true,
      })
      .select('-__v');
    return {
      status: 200,
      message: 'Tax Updated successfully',
      data: updateTax,
    };
  }

  async find() {
    const tax = await this.taxModel.findOne({}).select('-__v');

    return {
      status: 200,
      message: 'Tax found successfully',
      data: tax,
    };
  }

  async reSet(): Promise<void> {
    await this.taxModel.findOneAndUpdate({}, { taxPrice: 0, shippingPrice: 0 });
  }
}
/*
tax table:
{ taxPrice: 3, shippingPrice: 2 }
*/