import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
  createClearanceApplicationSchema,
  listClearanceApplicationsQuery,
  listClearanceQueueQuery,
  listPendingDuesQuery,
  updateClearanceItemSchema,
  updateClearanceDuesSchema,
  clearanceItemIdParams,
  clearanceStudentIdParams,
} from './clearance.validation.js';

import * as controller from './clearance.controller.js';

const router = Router();

// CLR-02: List TC clearance applications.
router.get(
  '/applications',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.CLEARANCE_VIEW),
  validate({ query: listClearanceApplicationsQuery }),
  controller.listApplications,
);

// CLR-03: Department's assigned clearance queue.
router.get(
  '/queue',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.CLEARANCE_VIEW),
  validate({ query: listClearanceQueueQuery }),
  controller.listDepartmentQueue,
);

// CLR-03: Update department clearance status.
router.patch(
  '/items/:itemId',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.CLEARANCE_ACT),
  validate({
    params: clearanceItemIdParams,
    body: updateClearanceItemSchema,
  }),
  controller.updateClearanceItem,
);

// CLR-04: Get student-wise clearance status.
router.get(
  '/students/:studentId',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.CLEARANCE_VIEW),
  validate({ params: clearanceStudentIdParams }),
  controller.getStudentClearance,
);

// CLR-05: Accounts pending dues list.
router.get(
  '/accounts/pending-dues',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.CLEARANCE_ACT),
  validate({ query: listPendingDuesQuery }),
  controller.listPendingDues,
);

// CLR-05: Update accounts dues.
router.patch(
  '/items/:itemId/dues',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.CLEARANCE_ACT),
  validate({
    params: clearanceItemIdParams,
    body: updateClearanceDuesSchema,
  }),
  controller.updateClearanceDues,
);

// CLR-01: Create TC clearance application.
router.post(
  '/applications',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPLY),
  validate({ body: createClearanceApplicationSchema }),
  controller.createApplication,
);

export default router;
