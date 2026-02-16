/**
 * Recordings routes: create, finalize.
 */

import { Router, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '../lib/firebase';
import { requireAuth, type AuthRequest } from '../auth';
import { createRecordingBodySchema } from '../validators';
import { createRecording as createRecordingDoc, getRecording, createJob } from '../firestore';
import { fileExists, getBucket } from '../storage';
import { enqueueProcessRecording } from '../jobs';
import { getLogger } from '../lib/logger';
import { getConfig } from '../config';

initFirebaseAdmin();
const logger = getLogger('api');
const db = getFirestore();

const router = Router();

router.post('/v1/recordings/create', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createRecordingBodySchema.safeParse(req.body ?? {});
    const { durationSec } = parsed.success ? parsed.data : {};
    const uid = req.uid!;
    const recordingId = db.collection('recordings').doc().id;
    const audioPath = `recordings/${uid}/${recordingId}.m4a`;
    await createRecordingDoc(recordingId, uid, audioPath, durationSec);
    res.status(201).json({
      recordingId,
      audioPath,
      uploadMethod: 'firebase',
      jobHint: 'upload via firebase sdk to audioPath then call finalize',
    });
  } catch (err) {
    logger.error({ err }, 'Create recording failed');
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/v1/recordings/:recordingId/finalize', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.uid!;
    const { recordingId } = req.params;
    const recording = await getRecording(recordingId);
    if (!recording) {
      res.status(404).json({ error: 'recording_not_found' });
      return;
    }
    if (recording.uid !== uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const bucket = getBucket();
    const bucketName = bucket?.name ?? getConfig().FIREBASE_STORAGE_BUCKET ?? 'unknown';
    logger.info({ recordingId, audioPath: recording.audioPath, bucket: bucketName }, 'Checking audio file exists');
    const exists = await fileExists(recording.audioPath);
    logger.info({ recordingId, exists }, 'fileExists result');
    if (!exists) {
      res.status(400).json({ error: 'audio_not_found' });
      return;
    }
    const jobId = db.collection('jobs').doc().id;
    await createJob(jobId, uid, recordingId);
    const taskName = await enqueueProcessRecording({ jobId });
    if (!taskName) {
      logger.warn({ jobId }, 'Enqueue failed; job still created');
    }
    res.status(201).json({ jobId });
  } catch (err) {
    logger.error({ err }, 'Finalize recording failed');
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
