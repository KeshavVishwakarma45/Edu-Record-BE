import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { ERROR_CODES } from '../utils/errorCodes.js';

// Login: at most 5 failed attempts per mobile number in 15 minutes, to stop password guessing.
// Successful logins do not count. Requests without a mobile number are limited per IP address.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim() : '';
    return mobile ? `mobile:${mobile}` : `ip:${ipKeyGenerator(req.ip)}`;
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
