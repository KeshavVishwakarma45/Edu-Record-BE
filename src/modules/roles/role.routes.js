import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { createRoleSchema, updateRoleSchema, listRolesQuery } from './role.validation.js';
import * as controller from './role.controller.js';

// Roles of the selected institute, or of its unit when institutes are combined
const router = Router();
const canManage = requirePermission(PERMISSIONS.ROLES_MANAGE);

router.get('/', auth, tenantScope, canManage, validate({ query: listRolesQuery }), controller.list);
router.get('/templates', auth, tenantScope, canManage, controller.templates);
router.post(
  '/',
  auth,
  tenantScope,
  canManage,
  validate({ body: createRoleSchema }),
  controller.create,
);
router.patch(
  '/:id',
  auth,
  tenantScope,
  canManage,
  validate({ params: idParams, body: updateRoleSchema }),
  controller.update,
);
router.delete(
  '/:id',
  auth,
  tenantScope,
  canManage,
  validate({ params: idParams }),
  controller.remove,
);

export default router;
