import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import * as controller from './handover.controller.js';
import { uploadImageOrPdf, uploadJpegPng } from '../../middleware/upload.js';
import {
  studentIdParams,
  submitHandoverSchema,
  signatureUploadSchema,
  receiverPhotoUploadSchema,
  handoverHistoryQuerySchema,
} from './handover.validation.js';
const router = Router();

router.get(
  '/students/:studentId/documents',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.HANDOVER_ISSUE),
  validate({ params: studentIdParams }),
  controller.listStudentDocuments,
);
router.post(
  '/upload-signature',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.HANDOVER_ISSUE),
  uploadImageOrPdf('signature'),
  validate({ body: signatureUploadSchema }),
  controller.uploadSignature,
);
router.post(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.HANDOVER_ISSUE),
  validate({ body: submitHandoverSchema }),
  controller.submitHandover,
);
router.get(
  '/history',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.HANDOVER_ISSUE),
  validate({ query: handoverHistoryQuerySchema }),
  controller.listHandoverHistory,
);
router.post(
  '/upload-photo',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.HANDOVER_ISSUE),
  uploadJpegPng('photo'),
  validate({ body: receiverPhotoUploadSchema }),
  controller.uploadReceiverPhoto,
);

export default router;
