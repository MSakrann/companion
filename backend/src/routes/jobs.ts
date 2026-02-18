/**
 * Jobs route: GET /v1/jobs/:jobId with signed URL for ttsAudioPath when done.
 */

import { Router, Response } from 'express';
import { requireAuth, type AuthRequest } from '../auth';
import { getJob } from '../firestore';
import { getSignedDownloadUrl } from '../storage';
import { getLogger } from '../lib/logger';

const logger = getLogger('api');

const router = Router();

router.get('/v1/jobs/:jobId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.uid!;
    const { jobId } = req.params;
    const job = await getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'job_not_found' });
      return;
    }
    if (job.uid !== uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const payload: Record<string, unknown> = {
      jobId,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
    if (job.error) payload.error = job.error;
    if (job.status === 'done' && job.result) {
      payload.responseText = job.result.responseText;
      try {
        payload.ttsAudioUrl = await getSignedDownloadUrl(job.result.ttsAudioPath, 60);
      } catch (e) {
        logger.warn(
          { jobId, path: job.result.ttsAudioPath, err: e instanceof Error ? e.message : String(e) },
          'Failed to get signed URL for TTS audio'
        );
      }
      payload.transcriptId = job.result.transcriptId;
      payload.responseId = job.result.responseId;
    }
    res.json(payload);
  } catch (err) {
    logger.error({ err }, 'Get job failed');
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
