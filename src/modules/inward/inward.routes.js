import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import {
  inwardBatchIdParams,
  receiptParams,
  missingReceiveParams,
  createReceiptSchema,
  updateReceiptSchema,
  receiveMissingSchema,
} from './inward.validation.js';

import * as controller from './inward.controller.js';

const router = Router();

router.get(
  '/:id/students',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ params: inwardBatchIdParams }),
  controller.getStudents,
);

router.post(
  '/:id/receipts',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({ params: inwardBatchIdParams, body: createReceiptSchema }),
  controller.createReceipt,
);

router.patch(
  '/:id/receipts/:receiptId',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({ params: receiptParams, body: updateReceiptSchema }),
  controller.updateReceipt,
);

router.post(
  '/:newBatchId/missing/:missingId/receive',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({
    params: missingReceiveParams,
    body: receiveMissingSchema,
  }),
  controller.receiveMissing,
);

export default router;
