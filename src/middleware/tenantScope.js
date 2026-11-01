import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';
import { audit } from '../utils/audit.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

// Step 2 of every protected route: which institute is the user working in, and may they?
// This is the one piece that keeps SSISM and SSEC data apart (SRS BR-01, AC-10).
//
// Reads the X-Institute-Id header (sent by the institute switcher in the client) and sets
//   req.scope = { tenantId, instituteId, role, departmentId }
// Services then build every query from scoped(req).
export async function tenantScope(req, _res, next) {
  const instituteId = req.headers['x-institute-id'];

  if (!instituteId) {
    return next(new ApiError(400, ERROR_CODES.INSTITUTE_REQUIRED, 'Select an institute first'));
  }
  if (!mongoose.isValidObjectId(instituteId)) {
    return next(ApiError.badRequest('X-Institute-Id is not a valid id'));
  }

  const access = req.user.access.find((entry) => String(entry.instituteId) === instituteId);

  if (!access) {
    // Denied attempts are recorded so the Principal can see who tried what (AC-10)
    await audit(req, AUDIT_ACTIONS.ACCESS_DENIED, 'institute', instituteId, null, {
      method: req.method,
      path: req.originalUrl,
    });
    return next(ApiError.forbidden('You do not have access to this institute'));
  }

  req.scope = {
    tenantId: req.user.tenantId,
    instituteId: access.instituteId,
    role: access.role,
    departmentId: access.departmentId ?? null,
  };
  next();
}
