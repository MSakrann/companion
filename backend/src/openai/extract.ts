/**
 * OpenAI extraction with strict JSON schema. Validated with Zod.
 * Do not log raw prompts or transcript text.
 */

import OpenAI from 'openai';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';
import { extractionSchema, defaultExtraction, type Extraction } from '../validators';

const logger = getLogger('openai');

/** Coerce null/undefined LLM output to valid defaults before Zod validation */
function normalizeExtractionForValidation(raw: unknown): unknown {
  if (raw === null || raw === undefined || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;

  const emotional = obj.emotional_state as Record<string, unknown> | null | undefined;
  if (emotional && typeof emotional === 'object') {
    if (emotional.overall_morale == null) emotional.overall_morale = 'medium';
    if (emotional.dominant_emotions == null) emotional.dominant_emotions = [];
    if (emotional.stressors == null) emotional.stressors = [];
    if (emotional.hardships == null) emotional.hardships = [];
    if (emotional.goals == null) emotional.goals = [];
  } else {
    obj.emotional_state = {
      overall_morale: 'medium',
      dominant_emotions: [],
      stressors: [],
      hardships: [],
      goals: [],
    };
  }

  const safety = obj.safety as Record<string, unknown> | null | undefined;
  if (safety && typeof safety === 'object') {
    if (safety.self_harm_risk == null) safety.self_harm_risk = 'none';
  } else {
    obj.safety = { self_harm_risk: 'none', notes: null };
  }

  return obj;
}

const EXTRACTION_SYSTEM = `You are an analyst. Extract structured information from the user's transcript into the exact JSON schema required.
Output only valid JSON. No markdown, no explanation.
IMPORTANT: Never output null for enum fields (overall_morale, self_harm_risk). If unsure, use the default: overall_morale defaults to "medium", self_harm_risk defaults to "none". Always output one of the allowed enum values.`;

function buildExtractionPrompt(transcript: string): string {
  return `Extract from this transcript into the required schema:

identity: name (string|null), age (number|null), location (string|null), languages (string[])
work: job_title, industry, company (string|null each)
emotional_state: overall_morale ("low"|"medium"|"high") - NEVER null, use "medium" if unsure; dominant_emotions, stressors, hardships, goals (string[] each)
relationships: important_people (string[])
preferences: values, likes, dislikes (string[] each)
safety: self_harm_risk ("none"|"possible"|"imminent") - NEVER null, use "none" if unsure; notes (string|null)
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

  // Normalize LLM output before validation - LLM often returns null for optional enum fields
  parsed = normalizeExtractionForValidation(parsed);

  const result = extractionSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ errors: result.error.flatten() }, 'Extraction schema validation failed; using defaults and continuing');
    return defaultExtraction;
  }
  return result.data;
}
