/**
 * Zod schema for LLM extraction output. Used for strict validation.
 */

import { z } from 'zod';

export const extractionIdentitySchema = z.object({
  name: z.string().nullable(),
  age: z.number().nullable(),
  location: z.string().nullable(),
  languages: z.array(z.string()),
});

export const extractionWorkSchema = z.object({
  job_title: z.string().nullable(),
  industry: z.string().nullable(),
  company: z.string().nullable(),
});

export const extractionEmotionalStateSchema = z.object({
  overall_morale: z.enum(['low', 'medium', 'high']),
  dominant_emotions: z.array(z.string()),
  stressors: z.array(z.string()),
  hardships: z.array(z.string()),
  goals: z.array(z.string()),
});

export const extractionRelationshipsSchema = z.object({
  important_people: z.array(z.string()),
});

export const extractionPreferencesSchema = z.object({
  values: z.array(z.string()),
  likes: z.array(z.string()),
  dislikes: z.array(z.string()),
});

export const extractionSafetySchema = z.object({
  self_harm_risk: z.enum(['none', 'possible', 'imminent']),
  notes: z.string().nullable(),
});

export const extractionConfidenceSchema = z.object({
  identity: z.number(),
  work: z.number(),
  emotional_state: z.number(),
});

export const sourceQuoteSchema = z.object({
  field: z.string(),
  quote: z.string(),
});

export const extractionSchema = z.object({
  identity: extractionIdentitySchema,
  work: extractionWorkSchema,
  emotional_state: extractionEmotionalStateSchema,
  relationships: z.object({ important_people: z.array(z.string()) }),
  preferences: extractionPreferencesSchema,
  safety: extractionSafetySchema,
  confidence: extractionConfidenceSchema,
  source_quotes: z.array(sourceQuoteSchema),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractionSafety = z.infer<typeof extractionSafetySchema>;
