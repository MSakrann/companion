/**
 * Internal worker: process recording pipeline.
 * Steps: load job+recording+memory -> transcribe -> extract -> merge memory -> generate response -> TTS -> WhatsApp -> done.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { getLogger } from '../lib/logger';
import {
  getJob,
  getRecording,
  getUser,
  getMemoryProfile,
  setMemoryProfile,
  mergeMemory,
  updateJobStatus,
  createTranscript,
  createExtraction,
  createResponse,
  createWhatsAppMessage,
  updateUserWhatsAppLastOutbound,
  Timestamp,
} from '../firestore';
import { fileExists, downloadToBuffer, uploadBuffer, getSignedDownloadUrl } from '../storage';
import { transcribeAudio } from '../openai/transcribe';
import { extractFromTranscript } from '../openai/extract';
import { generateResponse } from '../openai/response';
import { generateTtsAudio } from '../elevenlabs';
import {
  DefaultWhatsAppApiClient,
  canSendFreeForm,
  getOptInTemplateName,
  getCheckInTemplateName,
  buildCheckInComponents,
} from '../whatsapp';
import type { Extraction } from '../validators';
import { defaultExtraction } from '../validators';
import type OpenAI from 'openai';
import type { ElevenLabsClient } from '../elevenlabs';
import type { WhatsAppApiClient } from '../whatsapp';

const logger = getLogger('jobs');

const db = getFirestore();

export interface ProcessRecordingDeps {
  openai?: OpenAI;
  elevenlabs?: ElevenLabsClient;
  whatsapp?: WhatsAppApiClient;
}

export async function processRecording(
  jobId: string,
  deps: ProcessRecordingDeps = {}
): Promise<{ ok: boolean; error?: string }> {
  const job = await getJob(jobId);
  if (!job) {
    logger.warn({ jobId }, 'Job not found');
    return { ok: false, error: 'job_not_found' };
  }
  const { uid, recordingId } = job;
  if (job.status !== 'queued') {
    logger.warn({ jobId, status: job.status }, 'Job not queued');
    return { ok: false, error: 'invalid_status' };
  }

  try {
    await updateJobStatus(jobId, 'transcribing');

    const recording = await getRecording(recordingId);
    if (!recording) {
      await updateJobStatus(jobId, 'failed', 'recording_not_found');
      return { ok: false, error: 'recording_not_found' };
    }
    if (recording.uid !== uid) {
      await updateJobStatus(jobId, 'failed', 'forbidden');
      return { ok: false, error: 'forbidden' };
    }

    const exists = await fileExists(recording.audioPath);
    if (!exists) {
      await updateJobStatus(jobId, 'failed', 'audio_not_found');
      return { ok: false, error: 'audio_not_found' };
    }

    const user = await getUser(uid);
    const memoryDoc = await getMemoryProfile(uid);
    const memoryJson = memoryDoc?.memoryJson ?? {};

    const { text: transcriptText, language } = await transcribeAudio(recording.audioPath, { openai: deps.openai });
    const transcriptId = db.collection('transcripts').doc().id;
    await createTranscript(transcriptId, uid, recordingId, transcriptText, language);

    await updateJobStatus(jobId, 'extracting');
    let extraction: Extraction;
    try {
      extraction = await extractFromTranscript(transcriptText, { openai: deps.openai });
    } catch (err) {
      logger.warn({ err, jobId }, 'Extraction failed; using defaults and continuing');
      extraction = defaultExtraction;
    }
    const extractionId = db.collection('extractions').doc().id;
    await createExtraction(extractionId, uid, recordingId, extraction as unknown as Record<string, unknown>);

    const merged = mergeMemory(memoryJson, extraction as unknown as Record<string, unknown>);
    await setMemoryProfile(uid, merged);

    await updateJobStatus(jobId, 'generating');
    const { responseText, whatsappOpener } = await generateResponse(
      transcriptText,
      merged,
      extraction,
      { openai: deps.openai, detectedLanguage: language }
    );

    const responseId = db.collection('responses').doc().id;
    await createResponse(responseId, uid, recordingId, responseText, whatsappOpener);

    await updateJobStatus(jobId, 'tts');
    const ttsBuffer = await generateTtsAudio(responseText, deps.elevenlabs);
    const ttsPath = `tts/${uid}/${responseId}.mp3`;
    await uploadBuffer(ttsPath, ttsBuffer, 'audio/mpeg');

    await updateJobStatus(jobId, 'whatsapp');

    const waClient = deps.whatsapp ?? new DefaultWhatsAppApiClient();
    const userWhatsapp = user?.whatsapp;
    const waPhone = userWhatsapp?.waPhoneE164;
    const optInStatus = userWhatsapp?.optInStatus;
    const lastInboundAt = userWhatsapp?.lastInboundAt?.toDate?.() ?? null;

    if (waPhone && optInStatus === 'active') {
      if (canSendFreeForm(lastInboundAt)) {
        const providerId = await waClient.sendText(waPhone, whatsappOpener);
        const messageId = db.collection('whatsapp_messages').doc().id;
        await createWhatsAppMessage(messageId, `wa_${waPhone.replace(/\+/g, '')}`, 'outbound', whatsappOpener, providerId ?? undefined);
        await updateUserWhatsAppLastOutbound(uid, Timestamp.now());
      } else {
        const templateName = getCheckInTemplateName();
        const userName = extraction.identity?.name ?? 'there';
        const components = buildCheckInComponents(typeof userName === 'string' ? userName : 'there');
        await waClient.sendTemplate(waPhone, templateName, 'en', components);
        await updateUserWhatsAppLastOutbound(uid, Timestamp.now());
      }
    } else if (waPhone && optInStatus !== 'active') {
      const optInTemplate = getOptInTemplateName();
      await waClient.sendTemplate(waPhone, optInTemplate, 'en');
      logger.info({ uid, waPhone }, 'Sent OPTIN template');
    }

    await updateJobStatus(jobId, 'done', undefined, {
      transcriptId,
      responseId,
      ttsAudioPath: ttsPath,
      responseText,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, jobId }, 'Process recording failed');
    await updateJobStatus(jobId, 'failed', message);
    return { ok: false, error: message };
  }
}
