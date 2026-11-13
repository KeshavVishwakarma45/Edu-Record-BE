import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import { createStudentSchema } from './student.validation.js';
import * as controller from './student.controller.js';
import { updateStudentStatusSchema } from './student.validation.js';
import { uploadImage } from '../../middleware/upload.js';
import { idParams } from '../../utils/validators.js';

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

// Update student status
router.patch(
  '/:studentId/status',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_WRITE),
  validate({
    body: updateStudentStatusSchema,
  }),
  controller.updateStatus,
);

// Upload or update student photo
router.patch(
  '/:id/photo',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_WRITE),
  validate({ params: idParams }),
  uploadImage('photo'),
  controller.uploadPhoto,
);

export default router;
