import { ApiError } from '../utils/ApiError.js';

// Step 3 of every protected route: does the user's role in THIS institute allow the action?
//   requirePermission(PERMISSIONS.COURSE_WRITE)      one permission
//   requirePermission(PERMISSIONS.A, PERMISSIONS.B)  all of these
//   requirePermission()                              any member of the institute (e.g. files)
// Must come after tenantScope, because the role depends on the selected institute.
// The code checks permissions, never role names: admins can rename and create roles freely.
export function requirePermission(...needed) {
  return (req, _res, next) => {
    if (!req.scope) {
      return next(new Error('requirePermission must come after tenantScope'));
    }
    if (!needed.every((permission) => req.scope.permissions.includes(permission))) {
      return next(ApiError.forbidden('Your role cannot do this'));
    }
    next();
  };
}

// For organisation-wide actions (combine institutes, create admins): only the Super Admin.
export function requireSuperAdmin(req, _res, next) {
  if (!req.user?.isSuperAdmin) {
    return next(ApiError.forbidden('Only the Super Admin can do this'));
  }
  next();
}
