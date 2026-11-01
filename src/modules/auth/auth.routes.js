import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginLimiter, setupLinkLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, setupTokenParams, setPasswordSchema } from './auth.validation.js';
import * as controller from './auth.controller.js';

// Auth routes are the only exception to the full middleware chain:
// they run before a user is known (login, refresh, logout, invite links), or are about the user
// rather than an institute (/me).
const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', auth, controller.me);

// Invite and password-reset links: GET shows who the link is for, POST sets the password
router.get(
  '/setup/:token',
  setupLinkLimiter,
  validate({ params: setupTokenParams }),
  controller.checkSetupLink,
);
router.post(
  '/setup/:token',
  setupLinkLimiter,
  validate({ params: setupTokenParams, body: setPasswordSchema }),
  controller.useSetupLink,
);

export default router;
