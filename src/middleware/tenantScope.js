import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';
import { audit } from '../utils/audit.js';
import { ownerOf, assignmentFor, roleUsedIn, SUPER_ADMIN_ROLE_NAME } from '../utils/access.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';
import { PERMISSION_LIST } from '../constants/permissions.js';
import { Institute } from '../modules/institutes/institute.model.js';
import { Role } from '../modules/roles/role.model.js';

// Step 2 of every protected route: which institute is the user working in, and may they?
// This is the one piece that keeps SSISM and SSEC data apart (SRS BR-01, AC-10).
//
// Reads the X-Institute-Id header (sent by the institute switcher in the client), finds the
// user's role for that institute (directly, or through the institute's unit, ADR-016) and sets
//   req.scope = { tenantId, instituteId, unitId, ownerType, ownerId,
//                 roleId, roleName, permissions, departmentIds }
// Services then build every query from scoped(req).
//
// X-Institute-Id: all  ("All institutes", the Super Admin's default view) is allowed only for the
// Super Admin and only for reading (GET): lists then show every institute of the tenant. Every
// change is still sent to one institute, so all the normal checks apply to it.
export const ALL_INSTITUTES = 'all';

async function allInstitutesScope(req, next) {
  if (!req.user.isSuperAdmin) {
    await audit(req, AUDIT_ACTIONS.ACCESS_DENIED, 'institute', null, null, {
      method: req.method,
      path: req.originalUrl,
      requested: ALL_INSTITUTES,
    });
    return next(ApiError.forbidden('Only the Super Admin can view all institutes together'));
  }
  if (req.method !== 'GET') {
    return next(
      new ApiError(400, ERROR_CODES.INSTITUTE_REQUIRED, 'Choose one institute to make this change'),
    );
  }
  req.scope = wholeTenantScope(req);
  next();
}

function wholeTenantScope(req) {
  return {
    tenantId: req.user.tenantId,
    allInstitutes: true,
    instituteId: null,
    unitId: null,
    ownerType: null,
    ownerId: null,
    roleId: null,
    roleName: SUPER_ADMIN_ROLE_NAME,
    permissions: PERMISSION_LIST,
    departmentIds: [],
  };
}

// For the Super Admin's Organisation screens: they change the organisation itself (institutes,
// units), not one institute's records, so they work whichever institute is selected, including
// "All institutes". Use after requireSuperAdmin.
export function organisationScope(req, _res, next) {
  req.scope = wholeTenantScope(req);
  next();
}

export async function tenantScope(req, _res, next) {
  const instituteId = req.headers['x-institute-id'];

  if (!instituteId) {
    return next(new ApiError(400, ERROR_CODES.INSTITUTE_REQUIRED, 'Select an institute first'));
  }
  if (instituteId === ALL_INSTITUTES) return allInstitutesScope(req, next);
  if (!mongoose.isValidObjectId(instituteId)) {
    return next(ApiError.badRequest('X-Institute-Id is not a valid id'));
  }

  const institute = await Institute.findOne({
    tenantId: req.user.tenantId,
    _id: instituteId,
  }).lean();
  const assignment = institute && assignmentFor(req.user, institute);
  const role =
    assignment &&
    (await Role.findOne({ tenantId: req.user.tenantId, _id: assignment.roleId }).lean());

  // A unit role can be limited to some of the unit's institutes (role.instituteIds)
  const usable = role && roleUsedIn(role, institute._id);
  if (!institute || (!req.user.isSuperAdmin && !usable)) {
    // Denied attempts are recorded so the admins can see who tried what (AC-10)
    await audit(req, AUDIT_ACTIONS.ACCESS_DENIED, 'institute', instituteId, null, {
      method: req.method,
      path: req.originalUrl,
    });
    return next(ApiError.forbidden('You do not have access to this institute'));
  }

  const owner = ownerOf(institute);
  req.scope = {
    tenantId: req.user.tenantId,
    instituteId: institute._id,
    unitId: institute.unitId ?? null,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    roleId: req.user.isSuperAdmin ? null : role._id,
    roleName: req.user.isSuperAdmin ? SUPER_ADMIN_ROLE_NAME : role.name,
    permissions: req.user.isSuperAdmin ? PERMISSION_LIST : role.permissions,
    departmentIds: assignment?.departmentIds ?? [],
  };
  next();
}
