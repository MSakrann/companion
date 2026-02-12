/**
 * Firebase Admin SDK initialization. Call once at app startup.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getConfig } from '../config';

let app: App | null = null;

export function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }
  const config = getConfig();
  app = initializeApp({
    projectId: config.GOOGLE_CLOUD_PROJECT,
    storageBucket: config.FIREBASE_STORAGE_BUCKET,
  });
  return app;
}
