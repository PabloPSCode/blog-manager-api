import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import type { IPost } from '../domain/dtos/post.dto';
import { FirebaseService } from '../firebase/firebase.service';

type PostDocument = Omit<IPost, 'id'>;

const POSTS_COLLECTION = 'posts';

@Injectable()
export class PostsService {
  constructor(private readonly firebaseService: FirebaseService) {}

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

  private requireValue(value: string | undefined, fieldName: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      throw new NotFoundException(`${fieldName} is required.`);
    }

    return normalizedValue;
  }
}
