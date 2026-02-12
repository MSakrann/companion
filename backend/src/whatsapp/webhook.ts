/**
 * WhatsApp webhook: GET verify, POST inbound messages.
 * On inbound: find/create session, link uid, update lastInboundAt, generate reply, send, store.
 * Idempotency: ignore duplicate providerMessageId.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { Request, Response } from 'express';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';
import {
  findMessageByProviderId,
  createWhatsAppMessage,
  findWhatsAppSessionByPhone,
  createOrUpdateWhatsAppSession,
  updateWhatsAppSessionInbound,
  updateWhatsAppSessionOutbound,
  updateUserWhatsAppLastInbound,
  updateUserWhatsAppLastOutbound,
  getMemoryProfile,
  Timestamp,
} from '../firestore';
import { DefaultWhatsAppApiClient } from './client';
import type { WhatsAppApiClient } from './client';

const logger = getLogger('whatsapp');

function getVerifyToken(): string {
  return getConfig().WHATSAPP_WEBHOOK_VERIFY_TOKEN;
}

/**
 * GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 */
export async function handleWebhookVerify(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode !== 'subscribe' || token !== getVerifyToken()) {
    res.status(403).send('Forbidden');
    return;
  }
  res.type('text/plain').send(challenge);
}

interface InboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WebhookEntry {
  id: string;
  changes?: Array<{
    value?: {
      messaging_product: string;
      metadata: { phone_number_id: string; display_phone_number: string };
      contacts?: Array<{ wa_id: string; profile: { name: string } }>;
      messages?: InboundMessage[];
    };
    field: string;
  }>;
}

/**
 * Find uid for wa_id: match users by whatsapp.waPhoneE164 or phoneE164.
 */
async function findUidForWaPhone(waPhoneE164: string): Promise<string | null> {
  const db = getFirestore();
  const normalized = waPhoneE164.startsWith('+') ? waPhoneE164 : `+${waPhoneE164}`;
  const snap = await db
    .collection('users')
    .where('whatsapp.waPhoneE164', '==', normalized)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  const snap2 = await db
    .collection('users')
    .where('phoneE164', '==', normalized)
    .limit(1)
    .get();
  if (!snap2.empty) return snap2.docs[0].id;
  return null;
}

/**
 * Generate AI reply from memory + last message. Do not log transcript text.
 */
async function generateReply(uid: string, lastMessageText: string): Promise<string> {
  const memory = await getMemoryProfile(uid);
  const memoryJson = memory?.memoryJson ?? {};
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: getConfig().OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a supportive companion. Reply briefly and empathetically. One short paragraph.',
      },
      {
        role: 'user',
        content: `Memory context: ${JSON.stringify(memoryJson).slice(0, 1500)}\n\nUser message: ${lastMessageText}`,
      },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });
  const content = completion.choices[0]?.message?.content ?? 'Thanks for reaching out. How can I support you today?';
  return content;
}

/**
 * POST webhook: parse inbound message, idempotency check, find/create session, reply, store.
 */
export async function handleWebhookPost(
  req: Request,
  res: Response,
  waClient?: WhatsAppApiClient
): Promise<void> {
  res.status(200).send('OK');
  const body = req.body as { object?: string; entry?: WebhookEntry[] };
  if (body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
    return;
  }
  const client = waClient ?? new DefaultWhatsAppApiClient();
  for (const entry of body.entry) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const value = change.value;
      if (!value || change.field !== 'messages') continue;
      const messages = value.messages ?? [];
      for (const msg of messages) {
        if (msg.type !== 'text' || !msg.text?.body) continue;
        const providerMessageId = msg.id;
        const exists = await findMessageByProviderId(providerMessageId);
        if (exists) {
          logger.info({ providerMessageId }, 'Duplicate inbound message ignored');
          continue;
        }
        const fromWa = msg.from;
        const waPhoneE164 = fromWa.startsWith('+') ? fromWa : `+${fromWa}`;
        const text = msg.text.body;
        const uid = await findUidForWaPhone(waPhoneE164);
        const sessionId = `wa_${fromWa}`;
        const now = Timestamp.now();
        let sessionUid = uid ?? '';
        const existing = await findWhatsAppSessionByPhone(waPhoneE164);
        if (existing) {
          await updateWhatsAppSessionInbound(existing.sessionId, now);
          sessionUid = existing.record.uid;
          if (uid) await updateUserWhatsAppLastInbound(uid, now);
        } else {
          await createOrUpdateWhatsAppSession(sessionId, sessionUid || 'unknown', waPhoneE164, now, now);
          if (uid) await updateUserWhatsAppLastInbound(uid, now);
        }
        const db = getFirestore();
        const inboundMessageId = db.collection('whatsapp_messages').doc().id;
        await createWhatsAppMessage(inboundMessageId, existing?.sessionId ?? sessionId, 'inbound', text, providerMessageId);
        let replyText: string;
        if (sessionUid && sessionUid !== 'unknown') {
          replyText = await generateReply(sessionUid, text);
        } else {
          replyText = 'Thanks for your message. To get personalized support, please sign up in our app and link your WhatsApp.';
        }
        const outboundId = await client.sendText(waPhoneE164, replyText);
        const outboundMessageId = db.collection('whatsapp_messages').doc().id;
        await createWhatsAppMessage(
          outboundMessageId,
          existing?.sessionId ?? sessionId,
          'outbound',
          replyText,
          outboundId ?? undefined
        );
        if (sessionUid && sessionUid !== 'unknown') {
          await updateWhatsAppSessionOutbound(existing?.sessionId ?? sessionId, now);
          await updateUserWhatsAppLastOutbound(sessionUid, now);
        }
      }
    }
  }
}
