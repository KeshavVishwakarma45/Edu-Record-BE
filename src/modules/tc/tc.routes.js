import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import { createTcSchema, listTcsQuery, tcIdParams, updateTcSchema } from './tc.validation.js';
import * as tcController from './tc.controller.js';
const router = Router();

// Create a new TC draft
router.post(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_APPLY),
  validate({ body: createTcSchema }),
  tcController.createTC,
);

// Get TC list
router.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({ query: listTcsQuery }),
  tcController.listTCs,
);

// Get individual TC details
router.get(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_READ),
  validate({ params: tcIdParams }),
  tcController.getTCById,
);

// Update an existing TC draft
router.patch(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.TC_DRAFT),
  validate({ params: tcIdParams, body: updateTcSchema }),
  tcController.updateTC,
);
export default router;
