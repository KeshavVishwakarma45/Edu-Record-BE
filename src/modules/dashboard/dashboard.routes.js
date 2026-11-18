import { Router } from 'express';

import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import {
  dashboardSummaryQuery,
  dashboardAttentionQuery,
  dashboardListQuery,
} from './dashboard.validation.js';

import * as controller from './dashboard.controller.js';

const router = Router();

// A user can open the dashboard if they can read at least one module.
// Individual sections are filtered by their own permissions in the service.
function requireAnyDashboardPermission(req, _res, next) {
  const readablePermissions = [
    PERMISSIONS.INWARD_READ,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.HANDOVER_ISSUE,
    PERMISSIONS.CLEARANCE_VIEW,
    PERMISSIONS.CLEARANCE_ACT,
    PERMISSIONS.TC_APPLY,
    PERMISSIONS.TC_READ,
    PERMISSIONS.TC_APPROVE,
    PERMISSIONS.TC_ISSUE,
  ];
  const hasAccess = readablePermissions.some((permission) =>
    req.scope.permissions.includes(permission),
  );

  if (!hasAccess) {
    return next(ApiError.forbidden('Your role cannot view dashboard records'));
  }

  next();
}

function requireAnyPermission(...permissions) {
  return (req, _res, next) => {
    const allowed = permissions.some((permission) => req.scope.permissions.includes(permission));

    if (!allowed) {
      return next(ApiError.forbidden('Your role cannot view these dashboard records'));
    }

    return next();
  };
}

// 1. Dashboard summary
router.get(
  '/summary',
  auth,
  tenantScope,
  requireAnyDashboardPermission,
  validate({ query: dashboardSummaryQuery }),
  controller.getSummary,
);

// 2. Needs your attention
router.get(
  '/attention',
  auth,
  tenantScope,
  requireAnyDashboardPermission,
  validate({ query: dashboardAttentionQuery }),
  controller.getAttention,
);

// 3. Recent inward batches
router.get(
  '/recent-inward',
  auth,
  tenantScope,
  requireAnyPermission(
    PERMISSIONS.INWARD_READ,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.HANDOVER_ISSUE,
  ),
  validate({ query: dashboardListQuery }),
  controller.getRecentInwardBatches,
);

// 4. Recently issued TCs
router.get(
  '/recent-tcs',
  auth,
  tenantScope,
  requireAnyPermission(
    PERMISSIONS.TC_READ,
    PERMISSIONS.TC_APPROVE,
    PERMISSIONS.TC_ISSUE,
    PERMISSIONS.REPORT_VIEW,
  ),
  validate({ query: dashboardListQuery }),
  controller.getRecentIssuedTcs,
);

export default router;
