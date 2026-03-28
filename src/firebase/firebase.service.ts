import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

type StorageBucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

@Injectable()
export class FirebaseService {
  private firebaseApp: App | null = null;
  private firestoreDb: Firestore | null = null;
  private storageBucket: StorageBucket | null = null;

  constructor(private readonly configService: ConfigService) {}

  getFirestore(): Firestore {
    if (this.firestoreDb) {
      return this.firestoreDb;
    }

    this.firestoreDb = getFirestore(this.getFirebaseApp());

    return this.firestoreDb;
  }

  getStorageBucket(): StorageBucket {
    if (this.storageBucket) {
      return this.storageBucket;
    }

    this.storageBucket = getStorage(this.getFirebaseApp()).bucket();

    return this.storageBucket;
  }

  async uploadFile(input: {
    destination: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<string> {
    const bucket = this.getStorageBucket();
    const file = bucket.file(input.destination);
    const downloadToken = randomUUID();

    await file.save(input.buffer, {
      resumable: false,
      metadata: {
        contentType: input.contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    return this.buildDownloadUrl(bucket.name, input.destination, downloadToken);
  }

  async deleteFileByUrl(fileUrl: string | null | undefined): Promise<void> {
    if (!fileUrl) {
      return;
    }

    const bucket = this.getStorageBucket();
    const filePath = this.extractStoragePath(fileUrl, bucket.name);

    if (!filePath) {
      return;
    }

    await bucket.file(filePath).delete({ ignoreNotFound: true });
  }

  private getFirebaseApp(): App {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    const config = this.readFirebaseConfig();

    this.firebaseApp =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            credential: cert({
              projectId: config.projectId,
              clientEmail: config.clientEmail,
              privateKey: config.privateKey,
            }),
          });

    return this.firebaseApp;
  }

  private readFirebaseConfig(): FirebaseAdminConfig {
    const storageBucket = this.readEnvValue('FIREBASE_STORAGE_BUCKET');
    const projectId =
      this.readEnvValue('FIREBASE_ADMIN_PROJECT_ID') ??
      this.readEnvValue('FIREBASE_PROJECT_ID') ??
      storageBucket
        ?.replace('.appspot.com', '')
        .replace('.firebasestorage.app', '');
    const clientEmail = this.readEnvValue('FIREBASE_ADMIN_CLIENT_EMAIL');
    const privateKey = this.readPrivateKeyEnvValue(
      'FIREBASE_ADMIN_PRIVATE_KEY',
    );

    const config = {
      projectId,
      clientEmail,
      privateKey,
      storageBucket:
        storageBucket ??
        (projectId ? `${projectId}.firebasestorage.app` : undefined),
    };

    const missingConfig = Object.entries(config)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingConfig.length > 0) {
      throw new Error(
        `Missing Firebase admin config: ${missingConfig.join(', ')}. Fill the value in .env and restart the API.`,
      );
    }

    return config as FirebaseAdminConfig;
  }

  private readEnvValue(key: string): string | undefined {
    const value = this.configService.get<string>(key);

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return undefined;
    }

    return this.stripWrappingQuotes(normalizedValue);
  }

  private readPrivateKeyEnvValue(key: string): string | undefined {
    const value = this.readEnvValue(key);

    return value?.replace(/\\n/g, '\n');
  }

  private stripWrappingQuotes(value: string): string {
    const normalizedValue = value.endsWith(',')
      ? value.slice(0, -1).trim()
      : value;

    if (
      (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) ||
      (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
    ) {
      return normalizedValue.slice(1, -1);
    }

    return normalizedValue;
  }

  private buildDownloadUrl(
    bucketName: string,
    filePath: string,
    token: string,
  ): string {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
  }

  private extractStoragePath(
    fileUrl: string,
    bucketName: string,
  ): string | null {
    try {
      if (fileUrl.startsWith('gs://')) {
        const prefix = `gs://${bucketName}/`;
        return fileUrl.startsWith(prefix) ? fileUrl.slice(prefix.length) : null;
      }

      const parsedUrl = new URL(fileUrl);

      if (parsedUrl.hostname === 'firebasestorage.googleapis.com') {
        const objectPath = parsedUrl.pathname.split('/o/')[1];
        return objectPath ? decodeURIComponent(objectPath) : null;
      }

      if (parsedUrl.hostname === 'storage.googleapis.com') {
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        const [bucket, ...objectPath] = pathSegments;

        if (bucket !== bucketName || objectPath.length === 0) {
          return null;
        }

        return objectPath.join('/');
      }

      if (parsedUrl.hostname === `${bucketName}.storage.googleapis.com`) {
        return parsedUrl.pathname.replace(/^\/+/, '') || null;
      }
    } catch {
      return null;
    }

    return null;
  }
}
