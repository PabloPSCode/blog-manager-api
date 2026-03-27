import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types';
import type { IPost } from '../domain/dtos/post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

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
}
