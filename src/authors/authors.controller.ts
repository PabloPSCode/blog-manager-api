import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types';
import type {
  IAuthor,
  ICreateAuthorRequestDTO,
  IUpdateAuthorRequestDTO,
} from '../domain/dtos/author.dto';
import type { UploadedFile as UploadedBinaryFile } from '../types/uploaded-file.type';
import { AuthorsService } from './authors.service';

@Controller('authors')
@UseGuards(JwtAuthGuard)
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('avatarFile'))
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: ICreateAuthorRequestDTO,
    @UploadedFile() avatarFile?: UploadedBinaryFile,
  ): Promise<IAuthor> {
    return this.authorsService.createForSite(request.user.id, body, avatarFile);
  }

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

  @Patch(':id')
  @UseInterceptors(FileInterceptor('avatarFile'))
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: IUpdateAuthorRequestDTO,
    @UploadedFile() avatarFile?: UploadedBinaryFile,
  ): Promise<IAuthor> {
    return this.authorsService.updateForSite(
      request.user.id,
      id,
      body,
      avatarFile,
    );
  }

  @Delete(':id')
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<IAuthor> {
    return this.authorsService.deleteForSite(request.user.id, id);
  }
}
