/**
 * POV - Companion backend: Express server for Cloud Run.
 * Server always boots and listens on PORT even if some integrations are misconfigured.
 */

import express from 'express';
import pinoHttp from 'pino-http';
import { getLogger } from './lib/logger';
import { getConfig, loadConfig } from './config';
import { getFirebaseApp } from './lib/firebase';
import recordingsRouter from './routes/recordings';
import jobsRouter from './routes/jobs';
import internalRouter from './routes/internal';
import webhookRouter from './routes/webhook';

const logger = getLogger('server');

function main() {
  loadConfig();
  const config = getConfig();
  const port = Number(process.env.PORT || config.PORT || 8080) || 8080;

  // Log config presence (not values) to debug missing env vars in Cloud Run
  logger.info(
    {
      port,
      nodeEnv: config.NODE_ENV,
      config: {
        GOOGLE_CLOUD_PROJECT: !!config.GOOGLE_CLOUD_PROJECT,
        FIREBASE_STORAGE_BUCKET: !!config.FIREBASE_STORAGE_BUCKET,
        INTERNAL_TOKEN: !!config.INTERNAL_TOKEN,
        OPENAI_API_KEY: !!config.OPENAI_API_KEY,
        ELEVENLABS_API_KEY: !!config.ELEVENLABS_API_KEY,
        ELEVENLABS_VOICE_ID: !!config.ELEVENLABS_VOICE_ID,
        BASE_URL: !!config.BASE_URL,
      },
    },
    'Starting server'
  );

  let firebaseReady = false;
  try {
    getFirebaseApp();
    firebaseReady = true;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Firebase init skipped or failed');
  }

  const app = express();
  app.use(pinoHttp({ logger: logger as any }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(recordingsRouter);
  app.use(jobsRouter);
  app.use(internalRouter);
  app.use(webhookRouter);

  app.get('/health', (_req, res) => res.status(200).send('ok'));

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port, firebaseReady }, 'Server listening');
  });
}

main();
