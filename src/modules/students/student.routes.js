import { Router } from 'express';
import { listStudentsQuery } from './student.validation.js';
import { auth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import * as controller from './student.controller.js';

const router = Router();

router.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_READ),
  validate({ query: listStudentsQuery }),
  controller.list,
);

export default router;
