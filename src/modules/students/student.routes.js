import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { uploadExcel } from '../../middleware/uploadExcel.js';
import * as controller from './student.controller.js';
const router = Router();
// Download Excel template
router.get(
  '/import-template',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_IMPORT),
  controller.downloadImportTemplate,
);

// Upload and import students from Excel
router.post(
  '/import',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.STUDENT_IMPORT),
  uploadExcel('file'),
  controller.importStudents,
);
export default router;
