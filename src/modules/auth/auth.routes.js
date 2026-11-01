import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { loginSchema } from './auth.validation.js';
import * as controller from './auth.controller.js';

// Auth routes are the only exception to the full middleware chain:
// login/refresh/logout happen before a user is known, and /me is about the user, not an institute.
const router = Router();

router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', auth, controller.me);

export default router;
