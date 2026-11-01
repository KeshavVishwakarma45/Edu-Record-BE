import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { organisationScope } from '../../middleware/tenantScope.js';
import { requireSuperAdmin } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import {
  combineSchema,
  createInstituteSchema,
  updateInstituteSchema,
  renameUnitSchema,
  instituteIdSchema,
} from './organisation.validation.js';
import * as controller from './organisation.controller.js';

// Super Admin only: how the institutes are organised (ADR-016).
// These screens change the organisation, not one institute, so organisationScope replaces
// tenantScope: they work with any institute selected, including "All institutes".
// validate({}) has nothing to check, but keeps the chain identical on every route.
const router = Router();
const chain = [auth, requireSuperAdmin, organisationScope];

router.get('/', ...chain, validate({}), controller.overview);
router.get('/universities', ...chain, validate({}), controller.universities);

// Institutes
router.post(
  '/institutes',
  ...chain,
  validate({ body: createInstituteSchema }),
  controller.createInstitute,
);
router.patch(
  '/institutes/:id',
  ...chain,
  validate({ params: idParams, body: updateInstituteSchema }),
  controller.updateInstitute,
);

// Units: combine separate institutes, rename, add or take out one institute, separate all
router.post(
  '/units/preview',
  ...chain,
  validate({ body: combineSchema }),
  controller.previewCombine,
);
router.post('/units', ...chain, validate({ body: combineSchema }), controller.combine);
router.patch(
  '/units/:id',
  ...chain,
  validate({ params: idParams, body: renameUnitSchema }),
  controller.renameUnit,
);
router.post(
  '/units/:id/join/preview',
  ...chain,
  validate({ params: idParams, body: instituteIdSchema }),
  controller.previewJoin,
);
router.post(
  '/units/:id/join',
  ...chain,
  validate({ params: idParams, body: instituteIdSchema }),
  controller.joinUnit,
);
router.post(
  '/units/:id/remove',
  ...chain,
  validate({ params: idParams, body: instituteIdSchema }),
  controller.removeFromUnit,
);
router.post('/units/:id/separate', ...chain, validate({ params: idParams }), controller.separate);

export default router;
