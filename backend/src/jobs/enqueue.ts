/**
 * Enqueue Cloud Task to process a recording (POST /v1/internal/processRecording).
 */

import { CloudTasksClient } from '@google-cloud/tasks';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';

const logger = getLogger('jobs');

export interface EnqueueProcessRecordingOptions {
  jobId: string;
  queueName?: string;
  location?: string;
}

/**
 * Enqueue a task that calls POST /v1/internal/processRecording with { jobId }.
 * Uses OIDC token for Cloud Run or X-Internal-Token header.
 */
export async function enqueueProcessRecording(options: EnqueueProcessRecordingOptions): Promise<string | null> {
  const config = getConfig();
  const project = config.GOOGLE_CLOUD_PROJECT;
  const location = options.location ?? 'us-central1';
  const queue = options.queueName ?? 'default';
  const url = `${config.BASE_URL}/v1/internal/processRecording`;
  const client = new CloudTasksClient();

  const parent = client.queuePath(project, location, queue);
  const body = Buffer.from(JSON.stringify({ jobId: options.jobId })).toString('base64');

  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...(config.INTERNAL_TOKEN ? { 'X-Internal-Token': config.INTERNAL_TOKEN } : {}),
      },
      body,
      ...(config.INTERNAL_TOKEN
        ? {}
        : {
            oidcToken: {
              serviceAccountEmail: `${project}@appspot.gserviceaccount.com`,
            },
          }),
    },
  };

  try {
    const [response] = await client.createTask({ parent, task });
    const name = response.name ?? '';
    logger.info({ jobId: options.jobId, taskName: name }, 'Process recording task enqueued');
    return name;
  } catch (err) {
    logger.error({ err, jobId: options.jobId }, 'Failed to enqueue process recording task');
    return null;
  }
}
