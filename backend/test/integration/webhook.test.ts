/**
 * Integration test: WhatsApp webhook GET verify, POST inbound (idempotency).
 */

import request from 'supertest';
import express from 'express';
import webhookRouter from '../src/routes/webhook';
import { loadConfig, resetConfig } from '../src/config';
import { getFirebaseApp } from '../src/lib/firebase';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'demo-test';
process.env.FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'demo-test.appspot.com';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'verify-me';
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'test';
process.env.WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || 'test';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'test';
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test';
process.env.ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'test';
process.env.TEMPLATE_OPTIN_NAME = process.env.TEMPLATE_OPTIN_NAME || 'optin';
process.env.TEMPLATE_CHECKIN_NAME = process.env.TEMPLATE_CHECKIN_NAME || 'checkin';
process.env.INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || 'internal';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

resetConfig();
getFirebaseApp();
loadConfig();

const app = express();
app.use(express.json());
app.use(webhookRouter);

describe('WhatsApp webhook', () => {
  it('GET /webhook/whatsapp returns 403 when verify_token wrong', async () => {
    const res = await request(app)
      .get('/webhook/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'ch123' })
      .expect(403);
    expect(res.text).toBe('Forbidden');
  });

  it('GET /webhook/whatsapp returns challenge when verify_token correct', async () => {
    const res = await request(app)
      .get('/webhook/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': 'ch123' })
      .expect(200);
    expect(res.text).toBe('ch123');
  });

  it('POST /webhook/whatsapp returns 200 and processes payload', async () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '1', display_phone_number: '1' },
                messages: [
                  {
                    from: '1234567890',
                    id: 'wamid.unique1',
                    timestamp: '123',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const res = await request(app)
      .post('/webhook/whatsapp')
      .send(body)
      .expect(200);
    expect(res.text).toBe('OK');
  });
});
