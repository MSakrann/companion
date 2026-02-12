import { z } from 'zod';

export const createRecordingBodySchema = z.object({
  durationSec: z.number().optional(),
});

export type CreateRecordingBody = z.infer<typeof createRecordingBodySchema>;

export const processRecordingBodySchema = z.object({
  jobId: z.string().min(1),
});

export type ProcessRecordingBody = z.infer<typeof processRecordingBodySchema>;
