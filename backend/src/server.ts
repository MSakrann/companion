/**
 * POV - Companion backend: Express server for Cloud Run.
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
  getFirebaseApp();
  const config = getConfig();
  const app = express();
  app.use(pinoHttp({ logger: logger as any }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(recordingsRouter);
  app.use(jobsRouter);
  app.use(internalRouter);
  app.use(webhookRouter);

  app.get('/health', (_req, res) => res.status(200).send('ok'));

  const port = parseInt(config.PORT, 10) || 8080;
  app.listen(port, () => {
    logger.info({ port }, 'Server listening');
  });
}

main();
