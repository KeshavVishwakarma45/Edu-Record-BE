import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import { uploadExcel } from '../../middleware/uploadExcel.js';
import { uploadImage } from '../../middleware/upload.js';

import {
  listStudentsQuery,
  createStudentSchema,
  updateStudentStatusSchema,
} from './student.validation.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './student.controller.js';

const router = Router();

// Student Listing
router.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_READ),
  validate({ query: listStudentsQuery }),
  controller.list,
);

// Download Excel Import Template
router.get(
  '/import-template',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_IMPORT),
  controller.downloadImportTemplate,
);

// Get Student by ID
router.get(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_READ),
  validate({ params: idParams }),
  controller.getById,
);

// Upload and Import Students from Excel
router.post(
  '/import',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_IMPORT),
  uploadExcel('file'),
  controller.importStudents,
);

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
  validate({ body: updateStudentStatusSchema }),
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
