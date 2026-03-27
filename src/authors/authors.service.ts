import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import type { IAuthor } from '../domain/dtos/author.dto';
import { FirebaseService } from '../firebase/firebase.service';

type AuthorDocument = Omit<IAuthor, 'id'>;

const AUTHORS_COLLECTION = 'authors';

@Injectable()
export class AuthorsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async listBySiteId(siteId: string): Promise<IAuthor[]> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(AUTHORS_COLLECTION)
      .where('siteId', '==', this.requireValue(siteId, 'siteId'))
      .get();

    return snapshot.docs
      .map((authorSnapshot) => this.mapAuthorSnapshot(authorSnapshot))
      .filter((author): author is IAuthor => author !== null)
      .filter((author) => author.deletedAt === null)
      .sort((leftAuthor, rightAuthor) =>
        rightAuthor.createdAt.localeCompare(leftAuthor.createdAt),
      );
  }

  async getByIdForSite(siteId: string, authorId: string): Promise<IAuthor> {
    const snapshot = await this.firebaseService
      .getFirestore()
      .collection(AUTHORS_COLLECTION)
      .doc(this.requireValue(authorId, 'authorId'))
      .get();
    const author = this.mapAuthorSnapshot(snapshot);

    if (
      !author ||
      author.siteId !== this.requireValue(siteId, 'siteId') ||
      author.deletedAt !== null
    ) {
      throw new NotFoundException(`Author ${authorId} was not found.`);
    }

    return author;
  }

  private mapAuthorSnapshot(
    snapshot:
      | DocumentSnapshot<DocumentData>
      | QueryDocumentSnapshot<DocumentData>,
  ): IAuthor | null {
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as AuthorDocument;

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
