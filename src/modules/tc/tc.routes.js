import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { uploadImages } from '../../middleware/upload.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
  createTcSchema,
  listTcsQuery,
  tcIdParams,
  updateTcSchema,
  rejectTcSchema,
  issueTcSchema,
  submitTcSchema,
} from './tc.validation.js';
import * as controller from './tc.controller.js';

const router = Router();

// Draft creation, listing and retrieval.
router.post(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPLY),
  validate({ body: createTcSchema }),
  controller.createTC,
);

router.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({ query: listTcsQuery }),
  controller.listTCs,
);

router.get(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({ params: tcIdParams }),
  controller.getTCById,
);

router.patch(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_DRAFT),
  validate({ params: tcIdParams, body: updateTcSchema }),
  controller.updateTC,
);

// Submit TC for Principal Approval.
router.post(
  '/:id/submit',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPLY),
  validate({ params: tcIdParams, body: submitTcSchema }),
  controller.submit,
);

router.post(
  '/:id/approve',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPROVE),
  validate({ params: tcIdParams }),
  controller.approve,
);

router.post(
  '/:id/reject',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPROVE),
  validate({ params: tcIdParams, body: rejectTcSchema }),
  controller.reject,
);

router.get(
  '/:id/pdf',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({ params: tcIdParams }),
  controller.pdf,
);

router.post(
  '/:id/issue',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_ISSUE),
  uploadImages(),
  validate({ params: tcIdParams, body: issueTcSchema }),
  controller.issue,
);

router.get(
  '/:id/history',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({ params: tcIdParams }),
  controller.history,
);

export default router;
