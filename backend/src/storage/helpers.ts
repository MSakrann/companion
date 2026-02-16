/**
 * Firebase Storage helpers: download, upload, signed URLs.
 */

import { getStorage } from 'firebase-admin/storage';
import { getConfig } from '../config';
import { initFirebaseAdmin } from '../lib/firebase';

const bucketName = (): string => {
  const config = getConfig();
  if (config.FIREBASE_STORAGE_BUCKET) return config.FIREBASE_STORAGE_BUCKET;
  if (config.GOOGLE_CLOUD_PROJECT) return `${config.GOOGLE_CLOUD_PROJECT}.firebasestorage.app`;
  return '';
};

export function getBucket() {
  initFirebaseAdmin();
  return getStorage().bucket(bucketName());
}

/**
 * Check if a file exists (HEAD). Returns true if exists.
 */
export async function fileExists(path: string): Promise<boolean> {
  const file = getBucket().file(path);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Download file to buffer.
 */
export async function downloadToBuffer(path: string): Promise<Buffer> {
  const file = getBucket().file(path);
  const [contents] = await file.download();
  return Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
}

/**
 * Upload buffer to path.
 */
export async function uploadBuffer(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const file = getBucket().file(path);
  await file.save(buffer, {
    contentType,
    metadata: { cacheControl: 'private, max-age=3600' },
  });
}

/**
 * Get a signed download URL for private file. Default 1 hour.
 */
export async function getSignedDownloadUrl(
  path: string,
  expiresInMinutes = 60
): Promise<string> {
  const file = getBucket().file(path);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });
  return url;
}
