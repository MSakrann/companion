/**
 * OpenAI response generation: responseText + whatsappOpener.
 * Empathetic, specific; no promises of permanence/exclusivity.
 * Safety: if extraction.safety.self_harm_risk is possible/imminent, use safety response.
 */

import OpenAI from 'openai';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';
import type { Extraction } from '../validators';

const logger = getLogger('openai');

const SYSTEM_RESPONSE = `You are a supportive companion. Generate two outputs:
1. responseText: A spoken reply (max ~120 seconds when read aloud). Be empathetic and specific. Use the user's name and context. Do NOT promise permanence, exclusivity, or that you will "always" be there. Keep it human and supportive.
2. whatsappOpener: A short 1-2 sentence version suitable for WhatsApp, same tone.

CRITICAL - Response language: You MUST respond ONLY in Egyptian Arabic (عامية مصرية). Use Egyptian Colloquial Arabic. Do not use English words—use Arabic equivalents even for commonly borrowed terms. Match the user's dialect (Egyptian) regardless of whether they mixed English into their message.

If the user's emotional state suggests self-harm risk (possible or imminent), prioritize a safety response: encourage real-world support (crisis line, trusted person, professional). Still provide responseText and whatsappOpener but lead with care and resources.`;

function buildResponsePrompt(
  transcript: string,
  memoryJson: Record<string, unknown>,
  extractionJson: Record<string, unknown>,
  safetyLevel: string,
  detectedLanguage: string
): string {
  const langNote =
    detectedLanguage === 'ar'
      ? 'The user spoke in Arabic (possibly with some English mixed in). Respond ONLY in Egyptian Arabic (عامية مصرية).'
      : `The user spoke in ${detectedLanguage}. Respond ONLY in Egyptian Arabic (عامية مصرية)—translate your response into Egyptian Colloquial Arabic.`;

  return `Transcript summary and extraction are below. Memory context (merged) is also provided.

Memory (relevant keys only, no raw PII in logs): ${JSON.stringify(memoryJson)}
Extraction summary: ${JSON.stringify(extractionJson)}
Safety self_harm_risk: ${safetyLevel}

${langNote}

Generate responseText and whatsappOpener in Egyptian Arabic only. Output valid JSON only: { "responseText": "...", "whatsappOpener": "..." }

Transcript (excerpt): ${transcript.slice(0, 4000)}`;
}

export interface GenerateResponseResult {
  responseText: string;
  whatsappOpener: string;
}

export interface GenerateResponseOptions {
  openai?: OpenAI;
  /** Detected language from transcription (e.g. 'ar', 'en') */
  detectedLanguage?: string;
}

export async function generateResponse(
  transcript: string,
  memoryJson: Record<string, unknown>,
  extraction: Extraction,
  options: GenerateResponseOptions = {}
): Promise<GenerateResponseResult> {
  const apiKey = getConfig().OPENAI_API_KEY;
  const client = options.openai ?? new OpenAI({ apiKey });

  const safetyLevel = extraction.safety?.self_harm_risk ?? 'none';
  const detectedLanguage = options.detectedLanguage ?? 'en';

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_RESPONSE },
      {
        role: 'user',
        content: buildResponsePrompt(
          transcript,
          memoryJson,
          extraction as unknown as Record<string, unknown>,
          safetyLevel,
          detectedLanguage
        ),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response generation');
  }

  let parsed: { responseText?: string; whatsappOpener?: string };
  try {
    parsed = JSON.parse(content) as { responseText?: string; whatsappOpener?: string };
  } catch {
    throw new Error('Invalid response JSON');
  }

  const responseText = typeof parsed.responseText === 'string' ? parsed.responseText : '';
  const whatsappOpener = typeof parsed.whatsappOpener === 'string' ? parsed.whatsappOpener : responseText.slice(0, 200);
  if (!responseText) {
    throw new Error('Missing responseText in generated response');
  }
  logger.info('Response generation completed');
  return { responseText, whatsappOpener };
}
