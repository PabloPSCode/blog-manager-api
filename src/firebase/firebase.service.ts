import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore/lite';

type FirebaseConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

@Injectable()
export class FirebaseService {
  private firebaseApp: FirebaseApp | null = null;
  private firestoreDb: Firestore | null = null;

  constructor(private readonly configService: ConfigService) {}

  getFirestore(): Firestore {
    if (this.firestoreDb) {
      return this.firestoreDb;
    }

    this.firestoreDb = getFirestore(this.getFirebaseApp());

    return this.firestoreDb;
  }

  private getFirebaseApp(): FirebaseApp {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    const config = this.readFirebaseConfig();

    this.firebaseApp =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          });

    return this.firebaseApp;
  }

  private readFirebaseConfig(): FirebaseConfig {
    const apiKey = this.readEnvValue('FIREBASE_API_KEY');
    const authDomain = this.readEnvValue('FIREBASE_AUTH_DOMAIN');
    const storageBucket = this.readEnvValue('FIREBASE_STORAGE_BUCKET');
    const projectId =
      this.readEnvValue('FIREBASE_PROJECT_ID') ??
      authDomain?.replace('.firebaseapp.com', '') ??
      storageBucket
        ?.replace('.appspot.com', '')
        .replace('.firebasestorage.app', '');

    const config = {
      apiKey,
      authDomain:
        authDomain ?? (projectId ? `${projectId}.firebaseapp.com` : undefined),
      projectId,
      storageBucket:
        storageBucket ??
        (projectId ? `${projectId}.firebasestorage.app` : undefined),
      messagingSenderId: this.readEnvValue('FIREBASE_MESSAGING_SENDER_ID'),
      appId: this.readEnvValue('FIREBASE_APP_ID'),
    };

    const missingConfig = Object.entries(config)
      .filter(([key, value]) => ['apiKey', 'projectId'].includes(key) && !value)
      .map(([key]) => key);

    if (missingConfig.length > 0) {
      throw new Error(
        `Missing Firebase config: ${missingConfig.join(', ')}. Fill the value in .env and restart the API.`,
      );
    }

    return config as FirebaseConfig;
  }

  private readEnvValue(key: string): string | undefined {
    return this.configService.get<string>(key) ?? undefined;
  }
}
