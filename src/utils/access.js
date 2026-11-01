import { Institute } from '../modules/institutes/institute.model.js';
import { Unit } from '../modules/organisation/unit.model.js';
import { Role } from '../modules/roles/role.model.js';
import { OWNER_TYPES } from '../constants/ownerTypes.js';
import { PERMISSION_LIST } from '../constants/permissions.js';

// How a user's role is found (ADR-016):
//   a separate institute owns its own roles;
//   an institute in a unit uses the unit's roles, so one assignment works in every member.
// Records still belong to one institute; this only decides who may do what.

export const SUPER_ADMIN_ROLE_NAME = 'Super Admin';

// { ownerType, ownerId } that holds the roles and staff of this institute
export function ownerOf(institute) {
  return institute.unitId
    ? { ownerType: OWNER_TYPES.UNIT, ownerId: institute.unitId }
    : { ownerType: OWNER_TYPES.INSTITUTE, ownerId: institute._id };
}

const sameOwner = (a, b) => a.ownerType === b.ownerType && String(a.ownerId) === String(b.ownerId);

// Is the role used in this institute? A unit role can be limited to some member institutes
// (role.instituteIds); an empty list means every institute of its owner.
export function roleUsedIn(role, instituteId) {
  return (
    !role.instituteIds?.length || role.instituteIds.some((id) => String(id) === String(instituteId))
  );
}

// The user's assignment for the owner of this institute, or undefined
export function assignmentFor(user, institute) {
  const owner = ownerOf(institute);
  return user.access.find((entry) => sameOwner(entry, owner));
}

// Every institute the user can open, with their role and permissions in each.
// Used by /auth/me (institute switcher and menus).
export async function accessibleInstitutes(user) {
  const tenantId = user.tenantId;
  const institutes = await Institute.find({ tenantId }).sort({ name: 1 }).lean();
  const unitIds = institutes.map((i) => i.unitId).filter(Boolean);
  const units = await Unit.find({ tenantId, _id: { $in: unitIds } }).lean();
  const unitName = new Map(units.map((u) => [String(u._id), u.name]));

  const roleIds = user.access.map((entry) => entry.roleId);
  const roles = await Role.find({ tenantId, _id: { $in: roleIds } }).lean();
  const roleById = new Map(roles.map((r) => [String(r._id), r]));

  const result = [];
  for (const institute of institutes) {
    const base = {
      id: institute._id,
      name: institute.name,
      shortCode: institute.shortCode,
      unit: institute.unitId
        ? { id: institute.unitId, name: unitName.get(String(institute.unitId)) }
        : null,
    };
    if (user.isSuperAdmin) {
      result.push({
        ...base,
        roleId: null,
        roleName: SUPER_ADMIN_ROLE_NAME,
        permissions: PERMISSION_LIST,
        departmentIds: [],
      });
      continue;
    }
    const assignment = assignmentFor(user, institute);
    const role = assignment && roleById.get(String(assignment.roleId));
    if (role && roleUsedIn(role, institute._id)) {
      result.push({
        ...base,
        roleId: role._id,
        roleName: role.name,
        permissions: role.permissions,
        departmentIds: assignment.departmentIds,
      });
    }
  }
  return result;
}

// Filter for the roles of the owner the user is working in (from req.scope, set by tenantScope).
// In the Super Admin's "All institutes" view (read only) it covers every owner of the tenant.
export function ownerFilter(req) {
  if (req.scope.allInstitutes) return { tenantId: req.scope.tenantId };
  return {
    tenantId: req.scope.tenantId,
    ownerType: req.scope.ownerType,
    ownerId: req.scope.ownerId,
  };
}

// Every owner of the tenant: id -> { name, instituteId, members }.
//   name: the unit's name, or the institute's short code
//   instituteId: one institute of the owner, which the client sends as X-Institute-Id to change
//                that owner's roles or staff
//   members: [{ id, shortCode }] the institutes of the owner
export async function ownerDirectory(tenantId) {
  const [institutes, units] = await Promise.all([
    Institute.find({ tenantId }).sort({ name: 1 }).lean(),
    Unit.find({ tenantId }).lean(),
  ]);
  const short = (i) => ({ id: i._id, shortCode: i.shortCode });
  const directory = new Map();
  for (const unit of units) {
    const members = institutes.filter((i) => String(i.unitId) === String(unit._id));
    directory.set(String(unit._id), {
      name: unit.name,
      instituteId: members[0]?._id ?? null,
      members: members.map(short),
    });
  }
  for (const institute of institutes.filter((i) => !i.unitId)) {
    directory.set(String(institute._id), {
      name: institute.shortCode,
      instituteId: institute._id,
      members: [short(institute)],
    });
  }
  return directory;
}

// Short codes of the owner's institutes where the role is used, e.g. ['SSEC']
export function usedInCodes(role, owner) {
  return (owner?.members ?? []).filter((m) => roleUsedIn(role, m.id)).map((m) => m.shortCode);
}

// The list filter for "roles / staff of this institute" in the Super Admin's All institutes view
export async function ownerOfInstitute(tenantId, instituteId) {
  const institute = await Institute.findOne({ tenantId, _id: instituteId }).lean();
  return institute ? ownerOf(institute) : null;
}

// The ids of the institutes that share the current owner's roles and staff
export async function ownerInstituteIds(req) {
  if (req.scope.ownerType === OWNER_TYPES.INSTITUTE) return [req.scope.instituteId];
  const institutes = await Institute.find({
    tenantId: req.scope.tenantId,
    unitId: req.scope.unitId,
  })
    .select('_id')
    .lean();
  return institutes.map((i) => i._id);
}
