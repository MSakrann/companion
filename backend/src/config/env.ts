/**
 * Environment and secret loading for POV - Companion backend.
 * Prefer env vars; optionally load from Secret Manager in production.
 */

export interface EnvConfig {
  GOOGLE_CLOUD_PROJECT: string;
  FIREBASE_STORAGE_BUCKET: string;
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_BUSINESS_ACCOUNT_ID: string;
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
  TEMPLATE_OPTIN_NAME: string;
  TEMPLATE_CHECKIN_NAME: string;
  INTERNAL_TOKEN: string;
  BASE_URL: string;
  NODE_ENV: string;
  PORT: string;
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_STORAGE_EMULATOR_HOST?: string;
}

const required = [
  'GOOGLE_CLOUD_PROJECT',
  'FIREBASE_STORAGE_BUCKET',
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'TEMPLATE_OPTIN_NAME',
  'TEMPLATE_CHECKIN_NAME',
  'INTERNAL_TOKEN',
  'BASE_URL',
] as const;

function getEnv(key: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (required.includes(key as any)) {
      throw new Error(`Missing required env: ${key}`);
    }
    return '';
  }
  return v;
}

/**
 * Load config from environment. In production, secrets can be injected
 * by Cloud Run (Secret Manager) or set in env.
 */
export function loadConfig(): EnvConfig {
  return {
    GOOGLE_CLOUD_PROJECT: getEnv('GOOGLE_CLOUD_PROJECT'),
    FIREBASE_STORAGE_BUCKET: getEnv('FIREBASE_STORAGE_BUCKET'),
    OPENAI_API_KEY: getEnv('OPENAI_API_KEY'),
    ELEVENLABS_API_KEY: getEnv('ELEVENLABS_API_KEY'),
    ELEVENLABS_VOICE_ID: getEnv('ELEVENLABS_VOICE_ID'),
    WHATSAPP_ACCESS_TOKEN: getEnv('WHATSAPP_ACCESS_TOKEN'),
    WHATSAPP_PHONE_NUMBER_ID: getEnv('WHATSAPP_PHONE_NUMBER_ID'),
    WHATSAPP_BUSINESS_ACCOUNT_ID: getEnv('WHATSAPP_BUSINESS_ACCOUNT_ID'),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: getEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN'),
    TEMPLATE_OPTIN_NAME: getEnv('TEMPLATE_OPTIN_NAME'),
    TEMPLATE_CHECKIN_NAME: getEnv('TEMPLATE_CHECKIN_NAME'),
    INTERNAL_TOKEN: getEnv('INTERNAL_TOKEN'),
    BASE_URL: getEnv('BASE_URL'),
    NODE_ENV: getEnv('NODE_ENV') || 'development',
    PORT: getEnv('PORT') || '8080',
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  };
}

let cached: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

/** Reset cached config (for tests). */
export function resetConfig(): void {
  cached = null;
}
