/**
 * Firebase Admin SDK initialization.
 * Uses Application Default Credentials in production (Cloud Run); no service-account file required.
 * Call initFirebaseAdmin() before any getFirestore() / getStorage() / getAuth() so the default app exists.
 */

import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getConfig } from '../config';

let app: App | null = null;

/**
 * Ensures the default Firebase app exists. Safe to call multiple times (getApps() guard).
 * Call at the top of any module that uses getFirestore(), getStorage(), or getAuth().
 */
export function initFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApps()[0] as App;
  }
  const config = getConfig();
  const storageBucket =
    config.FIREBASE_STORAGE_BUCKET ||
    (config.GOOGLE_CLOUD_PROJECT ? `${config.GOOGLE_CLOUD_PROJECT}.firebasestorage.app` : undefined);
  app = initializeApp({
    credential: applicationDefault(),
    ...(config.GOOGLE_CLOUD_PROJECT && { projectId: config.GOOGLE_CLOUD_PROJECT }),
    ...(storageBucket && { storageBucket }),
  });
  return app;
}

export function getFirebaseApp(): App {
  return initFirebaseAdmin();
}
