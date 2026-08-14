import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { TaxService } from './tax.service';
import { CreateTaxDto } from './dto/create-tax.dto';
import { Roles } from 'src/user/decorator/Roles.decorator';
import { AuthGuard } from 'src/user/guard/Auth.guard';

@Controller('v1/tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  //  @docs  Can Admin Create Or Update Tax
  //  @Route  POST /api/v1/tax
  //  @access Private [admin]
  @Post()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  create(
    @Body(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }))
    createTaxDto: CreateTaxDto,
  ) {
    return this.taxService.createOrUpdate(createTaxDto);
  }

  //  @docs  Can Admin Get Tax
  //  @Route  GET /api/v1/tax
  //  @access Private [admin]
  @Get()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  find() {
    return this.taxService.find();
  }

  //  @docs  Can Admin Reset Tax
  //  @Route  DELETE /api/v1/tax
  //  @access Private [admin]
  @Delete()
  @Roles(['admin'])
  @UseGuards(AuthGuard)
  reSet() {
    return this.taxService.reSet();
  }
}