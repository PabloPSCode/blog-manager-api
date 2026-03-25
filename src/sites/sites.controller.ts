import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ICreateSiteDTO, ISite } from '../domain/dtos/site.dto';
import { SitesService } from './sites.service';

@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  list(): Promise<ISite[]> {
    return this.sitesService.list();
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<ISite> {
    return this.sitesService.getById(id);
  }

  @Post()
  async create(
    @Body() createSiteDto: ICreateSiteDTO,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ISite> {
    const { site, created } = await this.sitesService.create(createSiteDto);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return site;
  }
}
