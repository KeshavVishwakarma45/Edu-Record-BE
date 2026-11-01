import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission, requireSuperAdmin } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { inviteSchema, accessSchema, listUsersQuery } from './user.validation.js';
import * as controller from './user.controller.js';

// Staff of the selected institute, or of its unit when institutes are combined
const router = Router();
const canManage = requirePermission(PERMISSIONS.USERS_MANAGE);
const chain = [auth, tenantScope, canManage];

router.get('/', ...chain, validate({ query: listUsersQuery }), controller.list);
// validate({}) has nothing to check, but keeps the chain identical on every route
router.get('/options', ...chain, validate({}), controller.options);
router.post('/invite', ...chain, validate({ body: inviteSchema }), controller.invite);
router.patch(
  '/:id/access',
  ...chain,
  validate({ params: idParams, body: accessSchema }),
  controller.setAccess,
);
router.delete('/:id/access', ...chain, validate({ params: idParams }), controller.removeAccess);
router.post('/:id/setup-link', ...chain, validate({ params: idParams }), controller.setupLink);

// Blocking an account affects every institute, so only the Super Admin may do it
router.post(
  '/:id/disable',
  ...chain,
  requireSuperAdmin,
  validate({ params: idParams }),
  controller.disable,
);
router.post(
  '/:id/enable',
  ...chain,
  requireSuperAdmin,
  validate({ params: idParams }),
  controller.enable,
);

export default router;
