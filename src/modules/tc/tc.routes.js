import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { uploadImages } from '../../middleware/upload.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import * as controller from './tc.controller.js';

import { tcIdParams, rejectTcSchema, issueTcSchema, submitTcSchema } from './tc.validation.js';

const router = Router();

// 1. Submit TC for Principal Approval
router.post(
  '/:id/submit',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPLY),
  validate({
    params: tcIdParams,
    body: submitTcSchema,
  }),
  controller.submit,
);

// 2. Principal Approval
router.post(
  '/:id/approve',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPROVE),
  validate({
    params: tcIdParams,
  }),
  controller.approve,
);

// 3. Principal Rejection
router.post(
  '/:id/reject',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPROVE),
  validate({
    params: tcIdParams,
    body: rejectTcSchema,
  }),
  controller.reject,
);

// 4. Generate / Download TC PDF
router.get(
  '/:id/pdf',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({
    params: tcIdParams,
  }),
  controller.pdf,
);

// 5. Final TC Handover / Issue
router.post(
  '/:id/issue',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_ISSUE),
  uploadImages(),
  validate({
    params: tcIdParams,
    body: issueTcSchema,
  }),
  controller.issue,
);

// 6. TC History
router.get(
  '/:id/history',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({
    params: tcIdParams,
  }),
  controller.history,
);

export default router;
