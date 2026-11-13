import { Router } from 'express';
import { listStudentsQuery } from './student.validation.js';
import { auth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { uploadExcel } from '../../middleware/uploadExcel.js';
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

// Upload and Import Students from Excel
router.post(
  '/import',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_IMPORT),
  uploadExcel('file'),
  controller.importStudents,
);

export default router;
