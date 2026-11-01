import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { ERROR_CODES } from '../utils/errorCodes.js';

// Login: at most 5 failed attempts per email address in 15 minutes, to stop password guessing.
// Successful logins do not count. Requests without an email are limited per IP address.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return email ? `email:${email}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.TOO_MANY_REQUESTS,
        message: 'Too many login attempts. Please wait 15 minutes and try again.',
      },
    });
  },
});

// Invite / set-password links: 20 tries per IP address in 15 minutes, so tokens cannot be guessed
export const setupLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.TOO_MANY_REQUESTS,
        message: 'Too many tries. Please wait 15 minutes.',
      },
    });
  },
});
