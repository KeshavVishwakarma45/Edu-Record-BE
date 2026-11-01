import { ApiError } from '../utils/ApiError.js';

// Step 3 of every protected route: does the user's role in THIS institute allow the action?
//   requireRole(ROLES.PRINCIPAL)            one role
//   requireRole(...COURSE_WRITE_ROLES)      a list of roles
// Must come after tenantScope, because the role depends on the selected institute.
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.scope) {
      return next(new Error('requireRole must come after tenantScope'));
    }
    if (!allowedRoles.includes(req.scope.role)) {
      return next(ApiError.forbidden('Your role cannot do this'));
    }
    next();
  };
}
