/**
 * Firestore document types for POV - Companion.
 */

import type { Timestamp } from 'firebase-admin/firestore';

export type FirestoreTimestamp = Timestamp;

export interface UserWhatsApp {
  waPhoneE164: string;
  optInStatus: 'pending' | 'active' | 'inactive';
  lastInboundAt: Timestamp | null;
  lastOutboundAt: Timestamp | null;
}

export interface UserRecord {
  phoneE164: string;
  phoneVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  whatsapp?: UserWhatsApp;
}

export interface MemoryProfileRecord {
  memoryJson: Record<string, unknown>;
  updatedAt: Timestamp;
}

export interface RecordingRecord {
  uid: string;
  audioPath: string;
  durationSec?: number;
  createdAt: Timestamp;
}

export type JobStatus = 'queued' | 'transcribing' | 'extracting' | 'generating' | 'tts' | 'whatsapp' | 'done' | 'failed';

export interface JobResult {
  transcriptId: string;
  responseId: string;
  ttsAudioPath: string;
  responseText: string;
}

export interface JobRecord {
  uid: string;
  recordingId: string;
  status: JobStatus;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  result?: JobResult;
}

export interface TranscriptRecord {
  uid: string;
  recordingId: string;
  text: string;
  language: string;
  createdAt: Timestamp;
}

export interface ExtractionRecord {
  uid: string;
  recordingId: string;
  extractionJson: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface ResponseRecord {
  uid: string;
  recordingId: string;
  responseText: string;
  whatsappOpener: string;
  createdAt: Timestamp;
}

export interface WhatsAppSessionRecord {
  uid: string;
  waPhoneE164: string;
  lastInboundAt: Timestamp;
  lastOutboundAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type WhatsAppMessageDirection = 'inbound' | 'outbound';

export interface WhatsAppMessageRecord {
  sessionId: string;
  direction: WhatsAppMessageDirection;
  text: string;
  providerMessageId?: string;
  createdAt: Timestamp;
}
