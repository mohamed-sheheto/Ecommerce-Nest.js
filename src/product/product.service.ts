import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Product } from './product.schema';
import { Model } from 'mongoose';
import { Category } from 'src/category/category.schema';
import { SubCategory } from 'src/sub-category/sub-category.schema';
import { MAX_PAGE_SIZE } from 'src/common/pagination';

export interface ProductListQuery {
  page?: unknown;
  limit?: unknown;
  sort?: unknown;
  keyword?: unknown;
  category?: unknown;
  fields?: unknown;
  [key: string]: unknown;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Category.name)
    private readonly categoryModule: Model<Category>,
    @InjectModel(SubCategory.name)
    private readonly subCategoryModule: Model<SubCategory>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const product = await this.productModel.findOne({
      title: createProductDto.title,
    });
    const category = await this.categoryModule.findById(
      createProductDto.category,
    );

    if (product) {
      throw new HttpException('This Product already Exist', 400);
    }

    if (!category) {
      throw new HttpException('This Category not Exist', 400);
    }

    if (createProductDto.subCategory) {
      const subCategory = await this.subCategoryModule.findById(
        createProductDto.subCategory,
      );
      if (!subCategory) {
        throw new HttpException('This Sub Category not Exist', 400);
      }
    }
    const priceAfterDiscount = createProductDto?.priceAfterDiscount || 0;
    if (createProductDto.price < priceAfterDiscount) {
      throw new HttpException(
        'Must be price After discount greater than price',
        400,
      );
    }

    const newProduct = await (
      await this.productModel.create(createProductDto)
    ).populate('category subCategory brand', '-__v');
    return {
      status: 200,
      message: 'Product created successfully',
      data: newProduct,
    };
  }

  async findAll(query: ProductListQuery) {
    // 1) filter
    // eslint-disable-next-line prefer-const
    let requestQuery = { ...query };
    const removeQuery = [
      'page',
      'limit',
      'sort',
      'keyword',
      'category',
      'fields',
    ];
    removeQuery.forEach((singelQuery) => {
      delete requestQuery[singelQuery];
    });
    requestQuery = JSON.parse(
      JSON.stringify(requestQuery).replace(
        /\b(gte|lte|lt|gt)\b/g,
        (match) => `$${match}`,
      ),
    );

    // 2) pagenation
    const page = Math.max(Number(query?.page) || 1, 1);
    const limit = Math.min(Number(query?.limit) || 5, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    // 3) sorting
    if (query.sort && !['asc', 'desc'].includes(String(query.sort))) {
      throw new HttpException('Invalid sort', 400);
    }
    const sortValue: 'asc' | 'desc' =
      query?.sort === 'desc' ? 'desc' : 'asc';
    // 4) fields
    const fields = String(query?.fields || '') // description,title
      .split(',')
      .join(' ');

    // 5) search
    // eslint-disable-next-line prefer-const
    let findData = { ...requestQuery };

    if (query.keyword) {
      findData.$or = [
        { title: { $regex: String(query.keyword) } },
        { description: { $regex: String(query.keyword) } },
      ];
    }
    if (query.category) {
      findData.category = query.category.toString();
    }

    const products = await this.productModel
      .find(findData)
      .limit(limit)
      .skip(skip)
      .sort({ title: sortValue })
      .select(fields);
    return {
      status: 200,
      message: 'Found Product',
      isEmpty: products.length > 0 ? 'false' : 'true',
      length: products.length,
      data: products,
    };
  }

  async findOne(id: string) {
    const product = await this.productModel
      .findById(id)
      .select('-__v')
      .populate('category subCategory brand', '-__v');
    if (!product) {
      throw new NotFoundException('Procut Not Found');
    }

    return {
      status: 200,
      message: 'Found a Product',
      data: product,
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productModel.findById(id);

    if (!product) {
      throw new NotFoundException('Procut Not Found');
    }
    if (updateProductDto.category) {
      const category = await this.categoryModule.findById(
        updateProductDto.category,
      );
      if (!category) {
        throw new HttpException('This Category not Exist', 400);
      }
    }
    if (updateProductDto.subCategory) {
      const subCategory = await this.subCategoryModule.findById(
        updateProductDto.subCategory,
      );
      if (!subCategory) {
        throw new HttpException('This Sub Category not Exist', 400);
      }
    }

    if (updateProductDto.sold && product.quantity < updateProductDto.sold) {
      throw new HttpException('Thie Quantity is < sold', 400);
    }

    const price = updateProductDto?.price || product.price;
    const priceAfterDiscount =
      updateProductDto?.priceAfterDiscount || product.priceAfterDiscount;
    if (price < priceAfterDiscount) {
      throw new HttpException(
        'Must be price After discount greater than price',
        400,
      );
    }

    return {
      status: 200,
      message: 'Product Updated successfully',
      data: await this.productModel
        .findByIdAndUpdate(id, updateProductDto, {
          new: true,
        })
        .select('-__v')
        .populate('category subCategory brand', '-__v'),
    };
  }

  async remove(id: string): Promise<void> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Procut Not Found');
    }

    await this.productModel.findByIdAndDelete(id);
  }
}
