/**
 * Zod schema for LLM extraction output. Used for strict validation.
 */

import { z } from 'zod';

export const extractionIdentitySchema = z.object({
  name: z.string().nullable(),
  age: z.number().nullable(),
  location: z.string().nullable(),
  languages: z.preprocess((v) => v ?? [], z.array(z.string())),
});

export const extractionWorkSchema = z.object({
  job_title: z.string().nullable(),
  industry: z.string().nullable(),
  company: z.string().nullable(),
});

const defaultEmotionalState = {
  overall_morale: 'medium' as const,
  dominant_emotions: [] as string[],
  stressors: [] as string[],
  hardships: [] as string[],
  goals: [] as string[],
};

const moraleEnum = z.enum(['low', 'medium', 'high']);
/** Accepts null and defaults to 'medium' - emotional_state can never fail validation */
const moraleWithDefault = z.union([moraleEnum, z.null()]).transform((v) => v ?? 'medium');
const rawEmotionalStateSchema = z.object({
  overall_morale: moraleWithDefault,
  dominant_emotions: z.preprocess((v) => v ?? [], z.array(z.string())),
  stressors: z.preprocess((v) => v ?? [], z.array(z.string())),
  hardships: z.preprocess((v) => v ?? [], z.array(z.string())),
  goals: z.preprocess((v) => v ?? [], z.array(z.string())),
});

export const extractionEmotionalStateSchema = z.preprocess(
  (v) => (v === null || v === undefined || typeof v !== 'object' ? defaultEmotionalState : v),
  rawEmotionalStateSchema,
);

export const extractionRelationshipsSchema = z.object({
  important_people: z.preprocess((v) => v ?? [], z.array(z.string())),
});

export const extractionPreferencesSchema = z.object({
  values: z.preprocess((v) => v ?? [], z.array(z.string())),
  likes: z.preprocess((v) => v ?? [], z.array(z.string())),
  dislikes: z.preprocess((v) => v ?? [], z.array(z.string())),
});

const selfHarmEnum = z.enum(['none', 'possible', 'imminent']);
/** Accepts null and defaults to 'none' - safety.self_harm_risk can never fail validation */
const selfHarmWithDefault = z.union([selfHarmEnum, z.null()]).transform((v) => v ?? 'none');
const defaultSafety = { self_harm_risk: 'none' as const, notes: null as string | null };
const rawSafetySchema = z.object({
  self_harm_risk: selfHarmWithDefault,
  notes: z.string().nullable(),
});
export const extractionSafetySchema = z.preprocess(
  (v) => (v === null || v === undefined || typeof v !== 'object' ? defaultSafety : v),
  rawSafetySchema,
);

export const extractionConfidenceSchema = z.object({
  identity: z.preprocess((v) => (v === null || v === undefined ? 0 : v), z.number()),
  work: z.preprocess((v) => (v === null || v === undefined ? 0 : v), z.number()),
  emotional_state: z.preprocess((v) => (v === null || v === undefined ? 0 : v), z.number()),
});

export const sourceQuoteSchema = z.object({
  field: z.string(),
  quote: z.string(),
});

/** Normalize extraction JSON before validation - LLM often returns null for entire sections */
function normalizeExtraction(raw: unknown): unknown {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return raw;
  }
  const obj = raw as Record<string, unknown>;
  return {
    ...obj,
    emotional_state: obj.emotional_state ?? defaultEmotionalState,
    safety: obj.safety ?? defaultSafety,
    identity: obj.identity ?? { name: null, age: null, location: null, languages: [] },
    work: obj.work ?? { job_title: null, industry: null, company: null },
    relationships: obj.relationships ?? { important_people: [] },
    preferences: obj.preferences ?? { values: [], likes: [], dislikes: [] },
    confidence: obj.confidence ?? { identity: 0, work: 0, emotional_state: 0 },
    source_quotes: obj.source_quotes ?? [],
  };
}

export const extractionSchema = z.preprocess(
  normalizeExtraction,
  z.object({
    identity: extractionIdentitySchema,
    work: extractionWorkSchema,
    emotional_state: rawEmotionalStateSchema,
    relationships: z.object({
      important_people: z.preprocess((v) => v ?? [], z.array(z.string())),
    }),
    preferences: extractionPreferencesSchema,
    safety: rawSafetySchema,
    confidence: extractionConfidenceSchema,
    source_quotes: z.preprocess((v) => v ?? [], z.array(sourceQuoteSchema)),
  }),
);

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractionSafety = z.infer<typeof extractionSafetySchema>;

/** Minimal valid extraction with defaults - use when LLM output cannot be validated */
export const defaultExtraction: Extraction = {
  identity: { name: null, age: null, location: null, languages: [] },
  work: { job_title: null, industry: null, company: null },
  emotional_state: {
    overall_morale: 'medium',
    dominant_emotions: [],
    stressors: [],
    hardships: [],
    goals: [],
  },
  relationships: { important_people: [] },
  preferences: { values: [], likes: [], dislikes: [] },
  safety: { self_harm_risk: 'none', notes: null },
  confidence: { identity: 0, work: 0, emotional_state: 0 },
  source_quotes: [],
};
