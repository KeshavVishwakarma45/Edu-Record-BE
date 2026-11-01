import { Role } from './role.model.js';
import { User } from '../users/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../utils/audit.js';
import {
  ownerFilter,
  ownerDirectory,
  ownerInstituteIds,
  ownerOfInstitute,
  usedInCodes,
} from '../../utils/access.js';
import { OWNER_TYPES } from '../../constants/ownerTypes.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { ROLE_TEMPLATES } from '../../constants/roleTemplates.js';

// Roles of the institute (or unit) the admin is working in. Every query starts from
// ownerFilter(req), so an SSISM admin never sees or changes SSEC roles while they are separate.

const ENTITY = 'role';
const ADMIN_PERMISSIONS = [PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE];

// An admin can only hand out permissions they have themselves (the Super Admin has all)
export function checkGrantable(req, permissions) {
  const missing = permissions.filter((p) => !req.scope.permissions.includes(p));
  if (missing.length > 0) {
    throw ApiError.forbidden(`You cannot give permissions you do not have: ${missing.join(', ')}`);
  }
}

// How many users of this owner hold each role
async function userCounts(req, roleIds) {
  const rows = await User.aggregate([
    { $match: { tenantId: req.scope.tenantId, 'access.roleId': { $in: roleIds } } },
    { $unwind: '$access' },
    { $match: { 'access.roleId': { $in: roleIds } } },
    { $group: { _id: '$access.roleId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

// "All institutes" view with ?instituteId: the roles that institute uses
async function instituteFilter(req) {
  const { instituteId } = req.query;
  if (!req.scope.allInstitutes || !instituteId) return {};
  const owner = await ownerOfInstitute(req.scope.tenantId, instituteId);
  if (!owner) return { _id: null }; // unknown institute: nothing
  // 'instituteIds.0' missing = an empty list or no list (roles made before the field existed)
  return {
    ...owner,
    $or: [{ 'instituteIds.0': { $exists: false } }, { instituteIds: instituteId }],
  };
}

export async function list(req) {
  const { search, sort, page, limit } = req.query;
  const filter = {
    ...ownerFilter(req),
    ...(await instituteFilter(req)),
    ...searchFilter(search, ['name', 'description']),
  };
  const { skip } = pageOptions(req.query);
  const [roles, total] = await Promise.all([
    Role.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),
    Role.countDocuments(filter),
  ]);
  const counts = await userCounts(
    req,
    roles.map((r) => r._id),
  );
  // Which institute or unit each role belongs to (shown in the "All institutes" view)
  const owners = await ownerDirectory(req.scope.tenantId);
  const rows = roles.map((role) => {
    const owner = owners.get(String(role.ownerId));
    return {
      ...role,
      userCount: counts.get(String(role._id)) ?? 0,
      ownerName: owner?.name ?? '—',
      ownerInstituteId: owner?.instituteId ?? null,
      usedIn: usedInCodes(role, owner), // e.g. ['SSISM', 'SSEC']
    };
  });
  return { rows, meta: { page, limit, total } };
}

// The built-in roles, offered as a starting point when an admin adds a role
export function templates() {
  return ROLE_TEMPLATES;
}

async function getOwnRole(req, id) {
  const role = await Role.findOne({ ...ownerFilter(req), _id: id });
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

// A unit role may be limited to some member institutes. Only ids of members are allowed, and
// "all members" is stored as [] so an institute added to the unit later also gets the role.
async function usedInFor(req, instituteIds) {
  if (req.scope.ownerType !== OWNER_TYPES.UNIT || !instituteIds) return [];
  const members = (await ownerInstituteIds(req)).map(String);
  if (instituteIds.some((id) => !members.includes(String(id)))) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'instituteIds', message: 'Choose institutes of this unit' },
    ]);
  }
  return instituteIds.length === members.length ? [] : instituteIds;
}

export async function create(req, data) {
  checkGrantable(req, data.permissions);
  const role = await Role.create({
    ...data,
    instituteIds: await usedInFor(req, data.instituteIds),
    ...ownerFilter(req),
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });
  await audit(req, AUDIT_ACTIONS.CREATE, ENTITY, role._id, null, role);
  return role;
}

export async function update(req, id, changes) {
  const role = await getOwnRole(req, id);
  if (changes.permissions) {
    checkGrantable(req, changes.permissions);
    // Stops an admin from locking themselves (and everyone with their role) out of admin screens
    const isOwnRole = String(role._id) === String(req.scope.roleId);
    if (isOwnRole && !ADMIN_PERMISSIONS.every((p) => changes.permissions.includes(p))) {
      throw ApiError.badRequest('You cannot remove user or role management from your own role');
    }
  }
  if (changes.instituteIds) {
    changes.instituteIds = await usedInFor(req, changes.instituteIds);
    const isOwnRole = String(role._id) === String(req.scope.roleId);
    const stillHere =
      !changes.instituteIds.length ||
      changes.instituteIds.map(String).includes(String(req.scope.instituteId));
    if (isOwnRole && !stillHere) {
      throw ApiError.badRequest(
        'You cannot take your own role away from the institute you are working in',
      );
    }
  }
  const before = role.toObject();
  role.set({ ...changes, updatedBy: req.user.id });
  await role.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, role._id, before, role);
  return role;
}

export async function remove(req, id) {
  const role = await getOwnRole(req, id);
  const inUse = (await userCounts(req, [role._id])).get(String(role._id)) ?? 0;
  if (inUse > 0) {
    throw ApiError.conflict(
      `${inUse} user(s) have this role. Give them another role first, then delete it.`,
    );
  }
  await Role.deleteOne({ ...ownerFilter(req), _id: role._id });
  await audit(req, AUDIT_ACTIONS.DELETE, ENTITY, role._id, role, null);
}
