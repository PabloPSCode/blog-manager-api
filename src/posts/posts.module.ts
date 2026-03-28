import { Module } from '@nestjs/common';
import { AuthorsModule } from '../authors/authors.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [FirebaseModule, AuthorsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
