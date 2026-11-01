import crypto from 'node:crypto';
import { env } from '../config/env.js';

// One-time links for invites and password resets.
// The token is shown ONCE (in the link the admin copies); only its SHA-256 hash is stored, so a
// database leak does not leak working links. Links expire after 7 days and work only once.

export const SETUP_LINK_DAYS = 7;

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function createSetupLink() {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    link: `${env.CLIENT_URL}/set-password/${token}`,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SETUP_LINK_DAYS * 24 * 60 * 60 * 1000),
  };
}
