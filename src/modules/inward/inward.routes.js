import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import {
  inwardBatchIdParams,
  createInwardBatchSchema,
  listInwardBatchesQuery,
  markMissingDocumentSchema,
  receiptParams,
  missingReceiveParams,
  missingUpdateParams,
  createReceiptSchema,
  updateReceiptSchema,
  receiveMissingSchema,
  updateMissingSchema,
  inwardPendingQuery,
} from './inward.validation.js';

import * as controller from './inward.controller.js';

const router = Router();
export const pendingRouter = Router();

// API 5: Get expected students
router.get(
  '/:id/students',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ params: inwardBatchIdParams }),
  controller.getStudents,
);

// API 6: Create receipt
router.post(
  '/:id/receipts',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({ params: inwardBatchIdParams, body: createReceiptSchema }),
  controller.createReceipt,
);

// API 7: Update receipt
router.patch(
  '/:id/receipts/:receiptId',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({ params: receiptParams, body: updateReceiptSchema }),
  controller.updateReceipt,
);

// API 8: Receive missing document
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

// API 11: Update missing document details
router.patch(
  '/:id/missing/:missingId',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({
    params: missingUpdateParams,
    body: updateMissingSchema,
  }),
  controller.updateMissing,
);

// API 12: Get pending documents
pendingRouter.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ query: inwardPendingQuery }),
  controller.getPending,
);

// List all inward batches
router.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ query: listInwardBatchesQuery }),
  controller.list,
);

// Get counts for an inward batch
router.get(
  '/:id/counts',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ params: inwardBatchIdParams }),
  controller.getCounts,
);

// Get missing documents for an inward batch
router.get(
  '/:id/missing',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ params: inwardBatchIdParams }),
  controller.getMissingDocuments,
);

// Mark a document as missing
router.post(
  '/:id/missing',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({
    params: inwardBatchIdParams,
    body: markMissingDocumentSchema,
  }),
  controller.markDocumentMissing,
);

// Get one inward batch
router.get(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_READ),
  validate({ params: inwardBatchIdParams }),
  controller.getById,
);

// Create a new inward batch
router.post(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.INWARD_MANAGE),
  validate({ body: createInwardBatchSchema }),
  controller.create,
);

export default router;
