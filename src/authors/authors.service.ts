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
import type {
  IAuthor,
  ICreateAuthorRequestDTO,
  IUpdateAuthorRequestDTO,
} from '../domain/dtos/author.dto';
import { FirebaseService } from '../firebase/firebase.service';
import type { UploadedFile } from '../types/uploaded-file.type';

type AuthorDocument = Omit<IAuthor, 'id'>;

const AUTHORS_COLLECTION = 'authors';

@Injectable()
export class AuthorsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async createForSite(
    siteId: string,
    data: ICreateAuthorRequestDTO,
    avatarFile?: UploadedFile,
  ): Promise<IAuthor> {
    const normalizedSiteId = this.requireValue(siteId, 'siteId');
    const authorRef = this.firebaseService
      .getFirestore()
      .collection(AUTHORS_COLLECTION)
      .doc();
    const timestamp = this.toISOString();
    let avatarUrl = '';

    if (avatarFile) {
      avatarUrl = await this.uploadAuthorAvatar(
        normalizedSiteId,
        authorRef.id,
        avatarFile,
      );
    }

    const author: AuthorDocument = {
      name: this.requireValue(data.name, 'name'),
      bio: this.requireValue(data.bio, 'bio'),
      siteId: normalizedSiteId,
      avatarUrl,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    try {
      await authorRef.set(author);
    } catch (error) {
      await this.deleteAuthorAvatar(avatarUrl);
      throw error;
    }

    return {
      id: authorRef.id,
      ...author,
    };
  }

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
      throw new NotFoundException('Autor não encontrado.');
    }

    return author;
  }

  async updateForSite(
    siteId: string,
    authorId: string,
    data: IUpdateAuthorRequestDTO,
    avatarFile?: UploadedFile,
  ): Promise<IAuthor> {
    const existingAuthor = await this.getByIdForSite(siteId, authorId);
    const nextAvatarUrl = avatarFile
      ? await this.uploadAuthorAvatar(siteId, authorId, avatarFile)
      : existingAuthor.avatarUrl;

    const updates: Partial<AuthorDocument> = {
      siteId: existingAuthor.siteId,
      updatedAt: this.toISOString(),
      avatarUrl: nextAvatarUrl,
    };

    if (data.name !== undefined) {
      updates.name = this.requireValue(data.name, 'name');
    }

    if (data.bio !== undefined) {
      updates.bio = this.requireValue(data.bio, 'bio');
    }

    try {
      await this.firebaseService
        .getFirestore()
        .collection(AUTHORS_COLLECTION)
        .doc(authorId)
        .update(updates);
    } catch (error) {
      if (avatarFile) {
        await this.deleteAuthorAvatar(nextAvatarUrl);
      }

      throw error;
    }

    if (avatarFile && existingAuthor.avatarUrl) {
      await this.deleteAuthorAvatar(existingAuthor.avatarUrl);
    }

    return {
      ...existingAuthor,
      ...updates,
      id: authorId,
    };
  }

  async deleteForSite(siteId: string, authorId: string): Promise<IAuthor> {
    const existingAuthor = await this.getByIdForSite(siteId, authorId);
    const timestamp = this.toISOString();

    await this.firebaseService
      .getFirestore()
      .collection(AUTHORS_COLLECTION)
      .doc(authorId)
      .update({
        deletedAt: timestamp,
        updatedAt: timestamp,
      });

    return {
      ...existingAuthor,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };
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

  private async uploadAuthorAvatar(
    siteId: string,
    authorId: string,
    file: UploadedFile,
  ): Promise<string> {
    return this.firebaseService.uploadFile({
      destination: `authors/${siteId}/${authorId}/${Date.now()}-${this.sanitizeFileName(file.originalname)}`,
      buffer: file.buffer,
      contentType: file.mimetype,
    });
  }

  private async deleteAuthorAvatar(avatarUrl: string): Promise<void> {
    try {
      await this.firebaseService.deleteFileByUrl(avatarUrl);
    } catch {
      // Ignore cleanup failures to avoid blocking the main author operation.
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private requireValue(value: string | undefined, fieldName: string): string {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      const translatedFieldName =
        fieldName === 'siteId'
          ? 'O site'
          : fieldName === 'authorId'
            ? 'O autor'
            : fieldName === 'name'
              ? 'O nome'
              : fieldName === 'bio'
                ? 'A biografia'
                : 'Este campo';

      throw new BadRequestException(`${translatedFieldName} é obrigatório.`);
    }

    return normalizedValue;
  }

  private toISOString(): string {
    return new Date().toISOString();
  }
}
