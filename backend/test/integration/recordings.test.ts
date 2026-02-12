/**
 * Integration tests: create recording -> finalize -> job queued.
 * Uses Firestore + Storage emulators when FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST are set.
 */

import request from 'supertest';
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { loadConfig, resetConfig } from '../src/config';
import { getFirebaseApp } from '../src/lib/firebase';
import recordingsRouter from '../src/routes/recordings';
import jobsRouter from '../src/routes/jobs';
import internalRouter from '../src/routes/internal';
import { createRecording } from '../src/firestore';

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
app.use(recordingsRouter);
app.use(jobsRouter);
app.use(internalRouter);

const testUid = 'test-uid-123';
const mockVerifyIdToken = jest.fn();
mockVerifyIdToken.mockResolvedValue({ uid: testUid });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mockVerifyIdToken }) }));

describe('Recordings API', () => {
  beforeAll(() => {
    mockVerifyIdToken.mockResolvedValue({ uid: testUid });
  });

  it('POST /v1/recordings/create returns 401 without auth', async () => {
    const res = await request(app)
      .post('/v1/recordings/create')
      .send({})
      .expect(401);
    expect(res.body.error).toBeDefined();
  });

  it('POST /v1/recordings/create creates recording and returns path', async () => {
    const res = await request(app)
      .post('/v1/recordings/create')
      .set('Authorization', 'Bearer fake-token')
      .send({ durationSec: 10 })
      .expect(201);
    expect(res.body.recordingId).toBeDefined();
    expect(res.body.audioPath).toMatch(new RegExp(`recordings/${testUid}/.+\\.m4a`));
    expect(res.body.uploadMethod).toBe('firebase');
    expect(res.body.jobHint).toContain('finalize');
  });

  it('POST /v1/recordings/:id/finalize returns 404 when recording not found', async () => {
    await request(app)
      .post('/v1/recordings/nonexistent-id/finalize')
      .set('Authorization', 'Bearer fake-token')
      .expect(404);
  });

  it('POST /v1/recordings/:id/finalize returns 400 when audio not in storage', async () => {
    const db = getFirestore();
    const recordingId = db.collection('recordings').doc().id;
    const uid = testUid;
    const audioPath = `recordings/${uid}/${recordingId}.m4a`;
    await createRecording(recordingId, uid, audioPath, 5);
    const res = await request(app)
      .post(`/v1/recordings/${recordingId}/finalize`)
      .set('Authorization', 'Bearer fake-token')
      .expect(400);
    expect(res.body.error).toBe('audio_not_found');
  });
});
