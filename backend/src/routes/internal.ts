/**
 * Internal routes: processRecording (Cloud Tasks worker).
 */

import { Router, Request, Response } from 'express';
import { requireInternal } from '../middleware/internalAuth';
import { processRecordingBodySchema } from '../validators';
import { processRecording } from '../jobs';
import { getLogger } from '../lib/logger';

const logger = getLogger('api');

const router = Router();

router.post('/v1/internal/processRecording', requireInternal, async (req: Request, res: Response) => {
  try {
    const parsed = processRecordingBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
      return;
    }
    const { jobId } = parsed.data;
    const result = await processRecording(jobId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Process recording endpoint failed');
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
