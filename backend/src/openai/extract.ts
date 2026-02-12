/**
 * OpenAI extraction with strict JSON schema. Validated with Zod.
 * Do not log raw prompts or transcript text.
 */

import OpenAI from 'openai';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';
import { extractionSchema, type Extraction } from '../validators';

const logger = getLogger('openai');

const EXTRACTION_SYSTEM = `You are an analyst. Extract structured information from the user's transcript into the exact JSON schema required.
Output only valid JSON. No markdown, no explanation.`;

function buildExtractionPrompt(transcript: string): string {
  return `Extract from this transcript into the required schema:

identity: name (string|null), age (number|null), location (string|null), languages (string[])
work: job_title, industry, company (string|null each)
emotional_state: overall_morale ("low"|"medium"|"high"), dominant_emotions, stressors, hardships, goals (string[] each)
relationships: important_people (string[])
preferences: values, likes, dislikes (string[] each)
safety: self_harm_risk ("none"|"possible"|"imminent"), notes (string|null)
confidence: identity, work, emotional_state (numbers)
source_quotes: array of { field: string, quote: string }

Transcript (do not repeat in output):
---
${transcript}
---`;
}

export interface ExtractOptions {
  openai?: OpenAI;
}

export async function extractFromTranscript(
  transcript: string,
  options: ExtractOptions = {}
): Promise<Extraction> {
  const apiKey = getConfig().OPENAI_API_KEY;
  const client = options.openai ?? new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM },
      { role: 'user', content: buildExtractionPrompt(transcript) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty extraction response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    logger.warn('Extraction response was not valid JSON');
    throw new Error('Invalid extraction JSON');
  }

  const result = extractionSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ errors: result.error.flatten() }, 'Extraction schema validation failed');
    throw new Error('Extraction schema validation failed');
  }
  return result.data;
}
