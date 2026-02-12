/**
 * OpenAI Whisper transcription. Does not log transcript text.
 */

import OpenAI from 'openai';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';
import { downloadToBuffer } from '../storage';

const logger = getLogger('openai');

export interface TranscribeOptions {
  openai?: OpenAI;
}

export async function transcribeAudio(
  audioStoragePath: string,
  options: TranscribeOptions = {}
): Promise<{ text: string; language: string }> {
  const apiKey = getConfig().OPENAI_API_KEY;
  const client = options.openai ?? new OpenAI({ apiKey });

  const buffer = await downloadToBuffer(audioStoragePath);
  const file = new File([buffer], 'audio.m4a', { type: 'audio/mp4' });

  const response = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    language: undefined,
  });

  const verbose = response as { text: string; language?: string };
  const text = verbose.text ?? '';
  const language = verbose.language ?? 'en';
  logger.info({ language, length: text.length }, 'Transcription completed');
  return { text, language };
}
