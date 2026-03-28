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
  ICreatePostRequestDTO,
  IPost,
  IUpdatePostRequestDTO,
} from '../domain/dtos/post.dto';
import type { UploadedFile as UploadedBinaryFile } from '../types/uploaded-file.type';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('backgroundFile'))
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: ICreatePostRequestDTO,
    @UploadedFile() backgroundFile?: UploadedBinaryFile,
  ): Promise<IPost> {
    return this.postsService.createForSite(
      request.user.id,
      body,
      backgroundFile,
    );
  }

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<IPost[]> {
    return this.postsService.listBySiteId(request.user.id);
  }

  @Get(':id')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<IPost> {
    return this.postsService.getByIdForSite(request.user.id, id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('backgroundFile'))
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: IUpdatePostRequestDTO,
    @UploadedFile() backgroundFile?: UploadedBinaryFile,
  ): Promise<IPost> {
    return this.postsService.updateForSite(
      request.user.id,
      id,
      body,
      backgroundFile,
    );
  }

  @Delete(':id')
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<IPost> {
    return this.postsService.deleteForSite(request.user.id, id);
  }
}
