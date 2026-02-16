/**
 * ElevenLabs TTS: generate audio from text, return buffer.
 */

import { getConfig } from '../config';
import { getLogger } from '../lib/logger';

const logger = getLogger('elevenlabs');

export interface ElevenLabsClient {
  generate(text: string, languageCode?: string): Promise<Buffer>;
}

export class DefaultElevenLabsClient implements ElevenLabsClient {
  private apiKey: string;
  private voiceId: string;

  constructor(apiKey?: string, voiceId?: string) {
    const config = getConfig();
    this.apiKey = apiKey ?? config.ELEVENLABS_API_KEY;
    this.voiceId = voiceId ?? config.ELEVENLABS_VOICE_ID;
  }

  async generate(text: string, languageCode = 'ar'): Promise<Buffer> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        language_code: languageCode,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.warn({ status: res.status, body: errText }, 'ElevenLabs TTS failed');
      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.detail?.message) detail = parsed.detail.message;
      } catch {
        /* keep errText */
      }
      throw new Error(`ElevenLabs TTS failed: ${res.status} - ${detail}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export async function generateTtsAudio(
  text: string,
  client?: ElevenLabsClient,
  languageCode = 'ar'
): Promise<Buffer> {
  const c = client ?? new DefaultElevenLabsClient();
  return c.generate(text, languageCode);
}
