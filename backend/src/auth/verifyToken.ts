/**
 * Firebase ID token verification middleware.
 * Client sends Authorization: Bearer <idToken>. Backend verifies and sets req.uid.
 */

import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getLogger } from '../lib/logger';

const logger = getLogger('auth');

export interface AuthRequest extends Request {
  uid?: string;
}

/**
 * Verify Firebase ID token from Authorization header and set req.uid.
 * All app endpoints must use this to enforce uid isolation.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_or_invalid_authorization' });
    return;
  }
  const idToken = authHeader.slice(7);
  getAuth()
    .verifyIdToken(idToken)
    .then((decoded) => {
      req.uid = decoded.uid;
      next();
    })
    .catch((err) => {
      logger.warn({ err: err.message }, 'Token verification failed');
      res.status(401).json({ error: 'invalid_token' });
    });
}
