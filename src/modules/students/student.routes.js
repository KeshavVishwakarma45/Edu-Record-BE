import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import { createStudentSchema } from './student.validation.js';
import * as controller from './student.controller.js';

const router = Router();

// Add a new student
router.post(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_WRITE),
  validate({ body: createStudentSchema }),
  controller.create,
);

export default router;
