import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import * as controller from './report.controller.js';

import {
  reportDocumentIdParams,
  notReceivedListQuery,
  updateNotReceivedFollowUpSchema,
} from './report.validation.js';

const router = Router();

// API 1: Get Not-Received Documents
router.get(
  '/not-received',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.REPORT_VIEW),
  validate({
    query: notReceivedListQuery,
  }),
  controller.getNotReceivedDocuments,
);

// API 2: Add / Update Follow-up Details
router.patch(
  '/not-received/:id/follow-up',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({
    params: reportDocumentIdParams,
    body: updateNotReceivedFollowUpSchema,
  }),
  controller.updateFollowUp,
);

export default router;
