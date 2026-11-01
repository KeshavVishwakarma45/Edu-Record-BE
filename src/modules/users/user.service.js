import { User } from './user.model.js';
import { Role } from '../roles/role.model.js';
import { Department } from '../institutes/department.model.js';
import { Institute } from '../institutes/institute.model.js';
import { checkGrantable } from '../roles/role.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../utils/audit.js';
import {
  ownerFilter,
  ownerInstituteIds,
  ownerDirectory,
  ownerOfInstitute,
  usedInCodes,
} from '../../utils/access.js';
import { createSetupLink } from '../../utils/setupLink.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { USER_STATUSES } from '../../constants/statuses.js';

// Staff of the institute (or unit) the admin is working in. An admin manages only the access
// entry for their own owner; the Super Admin can also see everyone ("All institutes"), disable users and
// manage other admins.

const ENTITY = 'user';
const sameOwner = (req) => (entry) =>
  entry.ownerType === req.scope.ownerType && String(entry.ownerId) === String(req.scope.ownerId);

// One list row: a user and their access in one institute or unit.
// _id is unique per row (a user with access in two places has two rows); userId is the user.
function toRow(user, entry, roleById, owners) {
  const owner = entry && owners.get(String(entry.ownerId));
  const role = entry && roleById.get(String(entry.roleId));
  return {
    _id: entry ? `${user._id}:${entry.ownerId}` : String(user._id),
    userId: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    ownerName: user.isSuperAdmin ? 'All institutes' : (owner?.name ?? '—'),
    ownerInstituteId: owner?.instituteId ?? null,
    ownerType: entry?.ownerType ?? null,
    roleId: entry?.roleId ?? null,
    roleName: user.isSuperAdmin ? 'Super Admin' : (role?.name ?? '—'),
    // The institutes this access opens (a unit role can be limited to some institutes)
    institutes: user.isSuperAdmin ? [] : role ? usedInCodes(role, owner) : [],
    departmentIds: entry?.departmentIds ?? [],
    lastLoginAt: user.lastLoginAt,
  };
}

// Staff of the selected institute or unit. In the "All institutes" view: everyone, one row per
// place they work (paging counts users, so a page can hold a few more rows than the limit).
export async function list(req) {
  const { search, sort, page, limit } = req.query;
  const all = req.scope.allInstitutes;
  // "All institutes" with ?instituteId: only the staff of that institute's owner
  const onlyOwner =
    all && req.query.instituteId
      ? await ownerOfInstitute(req.scope.tenantId, req.query.instituteId)
      : null;
  const ownerId = all ? onlyOwner?.ownerId : req.scope.ownerId;
  const filter = {
    tenantId: req.scope.tenantId,
    ...(ownerId ? { 'access.ownerId': ownerId } : {}),
    ...searchFilter(search, ['name', 'email']),
  };
  const { skip } = pageOptions(req.query);
  const [users, total, roles, owners] = await Promise.all([
    User.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
    Role.find(ownerFilter(req)).select('name instituteIds').lean(),
    ownerDirectory(req.scope.tenantId),
  ]);
  const roleById = new Map(roles.map((r) => [String(r._id), r]));
  const rows = users.flatMap((user) => {
    const entries = ownerId
      ? user.access.filter((e) => String(e.ownerId) === String(ownerId))
      : user.access;
    return entries.length > 0
      ? entries.map((entry) => toRow(user, entry, roleById, owners))
      : [toRow(user, null, roleById, owners)];
  });
  return { rows, meta: { page, limit, total } };
}

// Choices for the invite / change-role form: this owner's roles and departments
export async function options(req) {
  if (req.scope.allInstitutes) throw ApiError.badRequest('Choose an institute or unit first');
  const instituteIds = await ownerInstituteIds(req);
  const [roles, departments, institutes] = await Promise.all([
    Role.find(ownerFilter(req)).sort({ name: 1 }).lean(),
    Department.find({ tenantId: req.scope.tenantId, instituteId: { $in: instituteIds } })
      .sort({ order: 1 })
      .lean(),
    Institute.find({ tenantId: req.scope.tenantId, _id: { $in: instituteIds } }).lean(),
  ]);
  const code = new Map(institutes.map((i) => [String(i._id), i.shortCode]));
  return {
    // A role used in only some institutes of a unit says where, e.g. "TC Clerk (SSEC)"
    roles: roles.map((r) => ({
      value: String(r._id),
      label: r.instituteIds?.length
        ? `${r.name} (${r.instituteIds.map((id) => code.get(String(id))).join(', ')})`
        : r.name,
      permissions: r.permissions,
    })),
    departments: departments.map((d) => ({
      value: String(d._id),
      label: instituteIds.length > 1 ? `${code.get(String(d.instituteId))} · ${d.name}` : d.name,
    })),
  };
}

// The role must belong to this owner, its permissions must be grantable, and the departments
// must belong to this owner's institutes
async function checkAccessData(req, { roleId, departmentIds }) {
  const role = await Role.findOne({ ...ownerFilter(req), _id: roleId }).lean();
  if (!role) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'roleId', message: 'Choose a role of this institute' },
    ]);
  }
  checkGrantable(req, role.permissions);
  if (departmentIds.length > 0) {
    const instituteIds = await ownerInstituteIds(req);
    const found = await Department.countDocuments({
      tenantId: req.scope.tenantId,
      instituteId: { $in: instituteIds },
      _id: { $in: departmentIds },
    });
    if (found !== departmentIds.length) {
      throw ApiError.badRequest('Please correct the highlighted fields', [
        { field: 'departmentIds', message: 'Choose departments of this institute' },
      ]);
    }
  }
  return { ownerType: req.scope.ownerType, ownerId: req.scope.ownerId, roleId, departmentIds };
}

// A user the admin may change: in this tenant, not themselves, and not a Super Admin
// (unless the caller is the Super Admin)
async function getManageableUser(req, id) {
  const user = await User.findOne({ tenantId: req.scope.tenantId, _id: id });
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(req.user.id)) {
    throw ApiError.badRequest('You cannot change your own access');
  }
  if (user.isSuperAdmin && !req.user.isSuperAdmin) {
    throw ApiError.forbidden('Only the Super Admin can change a Super Admin');
  }
  const inThisOwner = user.access.some(sameOwner(req));
  if (!inThisOwner && !req.user.isSuperAdmin) throw ApiError.notFound('User not found');
  return user;
}

function newSetupLink(user) {
  const { link, tokenHash, expiresAt } = createSetupLink();
  user.setupTokenHash = tokenHash;
  user.setupTokenExpiresAt = expiresAt;
  return { link, expiresAt };
}

// Invite a new person, or give an existing user access to this institute / unit.
// Returns the invite link for a new person (the admin copies it and sends it).
export async function invite(req, data) {
  const access = await checkAccessData(req, data);
  const existing = await User.findOne({ tenantId: req.scope.tenantId, email: data.email });

  if (existing) {
    if (existing.access.some(sameOwner(req)) || existing.isSuperAdmin) {
      throw ApiError.conflict('This person already has access here. Change their role instead.', [
        { field: 'email', message: 'Already has access' },
      ]);
    }
    const before = existing.toObject();
    existing.access.push(access);
    const setup = existing.status === USER_STATUSES.INVITED ? newSetupLink(existing) : null;
    await existing.save();
    await audit(req, AUDIT_ACTIONS.INVITE, ENTITY, existing._id, before, existing);
    return { user: existing, inviteLink: setup?.link ?? null, expiresAt: setup?.expiresAt ?? null };
  }

  const user = new User({
    tenantId: req.scope.tenantId,
    name: data.name,
    email: data.email,
    mobile: data.mobile ?? '',
    status: USER_STATUSES.INVITED,
    access: [access],
    createdBy: req.user.id,
  });
  const setup = newSetupLink(user);
  await user.save(); // an email used by another organisation fails here with 409 (unique index)
  await audit(req, AUDIT_ACTIONS.INVITE, ENTITY, user._id, null, user);
  return { user, inviteLink: setup.link, expiresAt: setup.expiresAt };
}

// Change the user's role (and departments) in this institute / unit
export async function setAccess(req, id, data) {
  const user = await getManageableUser(req, id);
  const access = await checkAccessData(req, data);
  const before = user.toObject();
  user.access = [...user.access.filter((e) => !sameOwner(req)(e)), access];
  await user.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, user._id, before, user);
  return user;
}

// Remove the user's access to this institute / unit (the account stays)
export async function removeAccess(req, id) {
  const user = await getManageableUser(req, id);
  const before = user.toObject();
  user.access = user.access.filter((e) => !sameOwner(req)(e));
  await user.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, user._id, before, user);
}

// A new invite link (invited user) or password reset link (active user)
export async function setupLink(req, id) {
  const user = await getManageableUser(req, id);
  if (user.status === USER_STATUSES.DISABLED) {
    throw ApiError.badRequest('Enable this user first');
  }
  const setup = newSetupLink(user);
  await user.save();
  await audit(req, AUDIT_ACTIONS.SETUP_LINK, ENTITY, user._id, null, { status: user.status });
  return { link: setup.link, expiresAt: setup.expiresAt };
}

// Super Admin only: block or unblock an account everywhere
export async function setDisabled(req, id, disabled) {
  const user = await getManageableUser(req, id);
  const before = user.toObject();
  if (disabled) {
    user.status = USER_STATUSES.DISABLED;
    user.tokenVersion += 1; // logs the user out at once
  } else {
    const withPassword = await User.findOne({ tenantId: user.tenantId, _id: user._id })
      .select('+passwordHash')
      .lean();
    user.status = withPassword.passwordHash ? USER_STATUSES.ACTIVE : USER_STATUSES.INVITED;
  }
  await user.save();
  const action = disabled ? AUDIT_ACTIONS.DISABLE : AUDIT_ACTIONS.ENABLE;
  await audit(req, action, ENTITY, user._id, before, user);
  return user;
}
