import { Router } from 'express';
import { listStudentsQuery, studentIdParam, updateStudentSchema } from './student.validation.js';
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

// ----- NEW: UPDATE -----
router.patch(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_UPDATE),
  validate({ params: { id: studentIdParam }, body: updateStudentSchema }),
  controller.update,
);
// ----- NEW: DELETE -----
router.delete(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_DELETE),
  validate({ params: { id: studentIdParam } }),
  controller.remove,
);

export default router;
