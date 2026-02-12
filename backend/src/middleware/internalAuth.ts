/**
 * Service-to-service auth: Cloud Tasks OIDC token OR X-Internal-Token header.
 */

import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config';
import { getLogger } from '../lib/logger';

const logger = getLogger('auth');

export function requireInternal(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  const config = getConfig();
  if (config.INTERNAL_TOKEN && token === config.INTERNAL_TOKEN) {
    next();
    return;
  }
  if (req.headers['authorization']?.startsWith('Bearer ')) {
    next();
    return;
  }
  logger.warn('Internal endpoint unauthorized');
  res.status(401).json({ error: 'unauthorized' });
}

