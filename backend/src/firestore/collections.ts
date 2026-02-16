/**
 * Firestore collection helpers with uid isolation.
 *
 * UID audit (recordings, jobs, transcripts, extractions, responses):
 * - Every document created in these collections includes field `uid` set to the
 *   authenticated Firebase uid. createRecording/createJob use req.uid from
 *   requireAuth; createTranscript/createExtraction/createResponse use job.uid
 *   from the job created for that user. updateJobStatus only updates status/error/result.
 *
 * Server-only collections (no client writes):
 * - whatsapp_sessions, whatsapp_messages: written only by backend (webhook handler,
 *   processRecording worker). Firestore rules should deny client write access.
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '../lib/firebase';
import { mergeMemory as mergeMemoryUtil } from '../lib/memoryMerge';
import type {
  UserRecord,
  MemoryProfileRecord,
  RecordingRecord,
  JobRecord,
  JobStatus,
  JobResult,
  TranscriptRecord,
  ExtractionRecord,
  ResponseRecord,
  WhatsAppSessionRecord,
  WhatsAppMessageRecord,
  WhatsAppMessageDirection,
} from './types';

initFirebaseAdmin();
const db = getFirestore();

const COLL = {
  users: 'users',
  memoryProfile: 'memory/profile',
  recordings: 'recordings',
  jobs: 'jobs',
  transcripts: 'transcripts',
  extractions: 'extractions',
  responses: 'responses',
  whatsappSessions: 'whatsapp_sessions',
  whatsappMessages: 'whatsapp_messages',
} as const;

// --- Users ---
export function getUserRef(uid: string) {
  return db.collection(COLL.users).doc(uid);
}

export async function getUser(uid: string): Promise<UserRecord | null> {
  const snap = await getUserRef(uid).get();
  return snap.exists ? (snap.data() as UserRecord) : null;
}

export async function getMemoryProfile(uid: string): Promise<MemoryProfileRecord | null> {
  const ref = getUserRef(uid).collection('memory').doc('profile');
  const snap = await ref.get();
  return snap.exists ? (snap.data() as MemoryProfileRecord) : null;
}

export async function setMemoryProfile(
  uid: string,
  memoryJson: Record<string, unknown>
): Promise<void> {
  const ref = getUserRef(uid).collection('memory').doc('profile');
  await ref.set(
    {
      memoryJson,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export { mergeMemoryUtil as mergeMemory };

// --- Recordings ---
export function getRecordingRef(recordingId: string) {
  return db.collection(COLL.recordings).doc(recordingId);
}

export async function getRecording(recordingId: string): Promise<RecordingRecord | null> {
  const snap = await getRecordingRef(recordingId).get();
  return snap.exists ? (snap.data() as RecordingRecord) : null;
}

export async function createRecording(
  recordingId: string,
  uid: string,
  audioPath: string,
  durationSec?: number
): Promise<void> {
  await getRecordingRef(recordingId).set({
    uid,
    audioPath,
    durationSec: durationSec ?? null,
    createdAt: FieldValue.serverTimestamp(),
  } as Omit<RecordingRecord, 'createdAt'> & { createdAt: FieldValue });
}

// --- Jobs ---
export function getJobRef(jobId: string) {
  return db.collection(COLL.jobs).doc(jobId);
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const snap = await getJobRef(jobId).get();
  return snap.exists ? (snap.data() as JobRecord) : null;
}

export async function createJob(
  jobId: string,
  uid: string,
  recordingId: string
): Promise<void> {
  const now = FieldValue.serverTimestamp();
  await getJobRef(jobId).set({
    uid,
    recordingId,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  } as Omit<JobRecord, 'createdAt' | 'updatedAt'> & {
    createdAt: FieldValue;
    updatedAt: FieldValue;
  });
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  error?: string,
  result?: JobResult
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (error !== undefined) update.error = error;
  if (result !== undefined) update.result = result;
  await getJobRef(jobId).update(update);
}

// --- Transcripts ---
export async function createTranscript(
  transcriptId: string,
  uid: string,
  recordingId: string,
  text: string,
  language: string
): Promise<void> {
  await db.collection(COLL.transcripts).doc(transcriptId).set({
    uid,
    recordingId,
    text,
    language,
    createdAt: FieldValue.serverTimestamp(),
  } as Omit<TranscriptRecord, 'createdAt'> & { createdAt: FieldValue });
}

// --- Extractions ---
export async function createExtraction(
  extractionId: string,
  uid: string,
  recordingId: string,
  extractionJson: Record<string, unknown>
): Promise<void> {
  await db.collection(COLL.extractions).doc(extractionId).set({
    uid,
    recordingId,
    extractionJson,
    createdAt: FieldValue.serverTimestamp(),
  } as Omit<ExtractionRecord, 'createdAt'> & { createdAt: FieldValue });
}

// --- Responses ---
export async function createResponse(
  responseId: string,
  uid: string,
  recordingId: string,
  responseText: string,
  whatsappOpener: string
): Promise<void> {
  await db.collection(COLL.responses).doc(responseId).set({
    uid,
    recordingId,
    responseText,
    whatsappOpener,
    createdAt: FieldValue.serverTimestamp(),
  } as Omit<ResponseRecord, 'createdAt'> & { createdAt: FieldValue });
}

// --- WhatsApp sessions ---
export function getWhatsAppSessionRef(sessionId: string) {
  return db.collection(COLL.whatsappSessions).doc(sessionId);
}

export async function getWhatsAppSession(
  sessionId: string
): Promise<WhatsAppSessionRecord | null> {
  const snap = await getWhatsAppSessionRef(sessionId).get();
  return snap.exists ? (snap.data() as WhatsAppSessionRecord) : null;
}

export async function findWhatsAppSessionByPhone(
  waPhoneE164: string
): Promise<{ sessionId: string; record: WhatsAppSessionRecord } | null> {
  const snap = await db
    .collection(COLL.whatsappSessions)
    .where('waPhoneE164', '==', waPhoneE164)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { sessionId: doc.id, record: doc.data() as WhatsAppSessionRecord };
}

export async function createOrUpdateWhatsAppSession(
  sessionId: string,
  uid: string,
  waPhoneE164: string,
  lastInboundAt: Timestamp,
  lastOutboundAt: Timestamp
): Promise<void> {
  const ref = getWhatsAppSessionRef(sessionId);
  const now = FieldValue.serverTimestamp();
  await ref.set(
    {
      uid,
      waPhoneE164,
      lastInboundAt,
      lastOutboundAt,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function updateWhatsAppSessionInbound(
  sessionId: string,
  lastInboundAt: Timestamp
): Promise<void> {
  await getWhatsAppSessionRef(sessionId).update({
    lastInboundAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateWhatsAppSessionOutbound(
  sessionId: string,
  lastOutboundAt: Timestamp
): Promise<void> {
  await getWhatsAppSessionRef(sessionId).update({
    lastOutboundAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// --- WhatsApp messages ---
export async function createWhatsAppMessage(
  messageId: string,
  sessionId: string,
  direction: WhatsAppMessageDirection,
  text: string,
  providerMessageId?: string
): Promise<void> {
  await db.collection(COLL.whatsappMessages).doc(messageId).set({
    sessionId,
    direction,
    text,
    providerMessageId: providerMessageId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  } as Omit<WhatsAppMessageRecord, 'createdAt'> & { createdAt: FieldValue });
}

export async function findMessageByProviderId(
  providerMessageId: string
): Promise<boolean> {
  const snap = await db
    .collection(COLL.whatsappMessages)
    .where('providerMessageId', '==', providerMessageId)
    .limit(1)
    .get();
  return !snap.empty;
}

// --- User WhatsApp fields (for lastInboundAt / opt-in) ---
export async function updateUserWhatsAppLastInbound(
  uid: string,
  lastInboundAt: Timestamp
): Promise<void> {
  await getUserRef(uid).update({
    'whatsapp.lastInboundAt': lastInboundAt,
    'whatsapp.updatedAt': FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateUserWhatsAppLastOutbound(
  uid: string,
  lastOutboundAt: Timestamp
): Promise<void> {
  await getUserRef(uid).update({
    'whatsapp.lastOutboundAt': lastOutboundAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export { Timestamp };
export type { UserRecord, RecordingRecord, JobRecord, JobResult };
