import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
  create(@Body() createSiteDto: ICreateSiteDTO): Promise<ISite> {
    return this.sitesService.create(createSiteDto);
  }
}
