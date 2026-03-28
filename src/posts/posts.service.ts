import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { AuthorsService } from '../authors/authors.service';
import type {
  ICreatePostRequestDTO,
  IPost,
  IUpdatePostRequestDTO,
} from '../domain/dtos/post.dto';
import { FirebaseService } from '../firebase/firebase.service';
import type { UploadedFile } from '../types/uploaded-file.type';

type PostDocument = Omit<IPost, 'id'>;

const POSTS_COLLECTION = 'posts';

@Injectable()
export class PostsService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly authorsService: AuthorsService,
  ) {}

  async createForSite(
    siteId: string,
    data: ICreatePostRequestDTO,
    backgroundFile?: UploadedFile,
  ): Promise<IPost> {
    const normalizedSiteId = this.requireValue(siteId, 'siteId');
    const normalizedAuthorId = this.requireValue(data.authorId, 'authorId');

    await this.authorsService.getByIdForSite(
      normalizedSiteId,
      normalizedAuthorId,
    );

    const postRef = this.firebaseService
      .getFirestore()
      .collection(POSTS_COLLECTION)
      .doc();
    const timestamp = this.toISOString();
    let backgroundUrl = '';

    if (backgroundFile) {
      backgroundUrl = await this.uploadPostBackground(
        normalizedSiteId,
        postRef.id,
        backgroundFile,
      );
    }

    const post: PostDocument = {
      siteId: normalizedSiteId,
      title: this.requireValue(data.title, 'title'),
      htmlContent: this.requireValue(data.htmlContent, 'htmlContent'),
      backgroundUrl,
      authorId: normalizedAuthorId,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    try {
      await postRef.set(post);
    } catch (error) {
      await this.deletePostBackground(backgroundUrl);
      throw error;
    }

    return {
      id: postRef.id,
      ...post,
    };
  }

  async listBySiteId(siteId: string): Promise<IPost[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(POSTS_COLLECTION)
      .where('siteId', '==', this.requireValue(siteId, 'siteId'))
      .get();

    return snapshot.docs
      .map((postSnapshot) => this.mapPostSnapshot(postSnapshot))
      .filter((post): post is IPost => post !== null)
      .filter((post) => post.deletedAt === null)
      .sort((leftPost, rightPost) =>
        rightPost.createdAt.localeCompare(leftPost.createdAt),
      );
  }

  async getByIdForSite(siteId: string, postId: string): Promise<IPost> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(POSTS_COLLECTION)
      .doc(this.requireValue(postId, 'postId'))
      .get();
    const post = this.mapPostSnapshot(snapshot);

    if (
      !post ||
      post.siteId !== this.requireValue(siteId, 'siteId') ||
      post.deletedAt !== null
    ) {
      throw new NotFoundException(`Post ${postId} was not found.`);
    }

    return post;
  }

  async updateForSite(
    siteId: string,
    postId: string,
    data: IUpdatePostRequestDTO,
    backgroundFile?: UploadedFile,
  ): Promise<IPost> {
    const existingPost = await this.getByIdForSite(siteId, postId);
    const nextAuthorId =
      data.authorId !== undefined
        ? this.requireValue(data.authorId, 'authorId')
        : existingPost.authorId;

    await this.authorsService.getByIdForSite(siteId, nextAuthorId);

    const nextBackgroundUrl = backgroundFile
      ? await this.uploadPostBackground(siteId, postId, backgroundFile)
      : existingPost.backgroundUrl;

    const updates: Partial<PostDocument> = {
      siteId: existingPost.siteId,
      authorId: nextAuthorId,
      backgroundUrl: nextBackgroundUrl,
      updatedAt: this.toISOString(),
    };

    if (data.title !== undefined) {
      updates.title = this.requireValue(data.title, 'title');
    }

    if (data.htmlContent !== undefined) {
      updates.htmlContent = this.requireValue(data.htmlContent, 'htmlContent');
    }

    try {
      await this.firebaseService
        .getFirestore()
        .collection(POSTS_COLLECTION)
        .doc(postId)
        .update(updates);
    } catch (error) {
      if (backgroundFile) {
        await this.deletePostBackground(nextBackgroundUrl);
      }

      throw error;
    }

    if (backgroundFile && existingPost.backgroundUrl) {
      await this.deletePostBackground(existingPost.backgroundUrl);
    }

    return {
      ...existingPost,
      ...updates,
      id: postId,
    };
  }

  async deleteForSite(siteId: string, postId: string): Promise<IPost> {
    const existingPost = await this.getByIdForSite(siteId, postId);
    const timestamp = this.toISOString();

    await this.firebaseService
      .getFirestore()
      .collection(POSTS_COLLECTION)
      .doc(postId)
      .update({
        deletedAt: timestamp,
        updatedAt: timestamp,
      });

    return {
      ...existingPost,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private mapPostSnapshot(
    snapshot:
      | DocumentSnapshot<DocumentData>
      | QueryDocumentSnapshot<DocumentData>,
  ): IPost | null {
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as PostDocument;

    return {
      id: snapshot.id,
      ...data,
    };
  }

  private async uploadPostBackground(
    siteId: string,
    postId: string,
    file: UploadedFile,
  ): Promise<string> {
    return this.firebaseService.uploadFile({
      destination: `posts/${siteId}/${postId}/${Date.now()}-${this.sanitizeFileName(file.originalname)}`,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
  }

  private async deletePostBackground(backgroundUrl: string): Promise<void> {
    try {
      await this.firebaseService.deleteFileByUrl(backgroundUrl);
    } catch {
      // Ignore cleanup failures to avoid blocking the main post operation.
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private requireValue(value: string | undefined, fieldName: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return normalizedValue;
  }

  private toISOString(): string {
    return new Date().toISOString();
  }
}
