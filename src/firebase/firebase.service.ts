import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

@Injectable()
export class FirebaseService {
  private firebaseApp: App | null = null;
  private firestoreDb: Firestore | null = null;

  constructor(private readonly configService: ConfigService) {}

  getFirestore(): Firestore {
    if (this.firestoreDb) {
      return this.firestoreDb;
    }

    this.firestoreDb = getFirestore(this.getFirebaseApp());

    return this.firestoreDb;
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
}
