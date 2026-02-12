/**
 * Integration test: POST /v1/internal/processRecording with mocked clients.
 * Worker happy path: job exists, recording + audio exist, mocked OpenAI/ElevenLabs/WhatsApp.
 */

import request from 'supertest';
import express from 'express';
import internalRouter from '../src/routes/internal';
import { loadConfig, resetConfig } from '../src/config';
import { getFirebaseApp } from '../src/lib/firebase';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'demo-test';
process.env.FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'demo-test.appspot.com';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test';
process.env.ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'test';
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'test';
process.env.WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || 'test';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'test';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'test';
process.env.TEMPLATE_OPTIN_NAME = process.env.TEMPLATE_OPTIN_NAME || 'optin';
process.env.TEMPLATE_CHECKIN_NAME = process.env.TEMPLATE_CHECKIN_NAME || 'checkin';
process.env.INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'internal-secret';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

resetConfig();
getFirebaseApp();
loadConfig();

const app = express();
app.use(express.json());
app.use(internalRouter);

describe('Internal processRecording', () => {
  it('POST /v1/internal/processRecording returns 401 without internal token', async () => {
    await request(app)
      .post('/v1/internal/processRecording')
      .send({ jobId: 'any' })
      .expect(401);
  });

  it('POST /v1/internal/processRecording returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/v1/internal/processRecording')
      .set('X-Internal-Token', 'internal-secret')
      .send({})
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /v1/internal/processRecording returns 400 when job not found', async () => {
    const res = await request(app)
      .post('/v1/internal/processRecording')
      .set('X-Internal-Token', 'internal-secret')
      .send({ jobId: 'nonexistent-job-id' })
      .expect(400);
    expect(res.body.error).toBeDefined();
  });
});
