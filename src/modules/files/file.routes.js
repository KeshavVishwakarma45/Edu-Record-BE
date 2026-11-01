import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './file.controller.js';

// Files are uploaded by each module's own routes (see middleware/upload.js and utils/storage.js).
// This module only serves them back, after the usual checks.
const router = Router();

router.get(
  '/:id',
  auth,
  tenantScope,
  requirePermission() /* any member of the institute */,
  validate({ params: idParams }),
  controller.download,
);

export default router;
