import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types';
import type { IAuthor } from '../domain/dtos/author.dto';
import { AuthorsService } from './authors.service';

@Controller('authors')
@UseGuards(JwtAuthGuard)
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<IAuthor[]> {
    return this.authorsService.listBySiteId(request.user.id);
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<IAuthor> {
    return this.authorsService.getByIdForSite(request.user.id, id);
  }
}
