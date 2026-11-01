import { Unit } from './unit.model.js';
import { Institute } from '../institutes/institute.model.js';
import { Department } from '../institutes/department.model.js';
import { Affiliation } from '../institutes/affiliation.model.js';
import { University } from '../institutes/university.model.js';
import { Role } from '../roles/role.model.js';
import { User } from '../users/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../utils/audit.js';
import { withTransaction } from '../../utils/transaction.js';
import { roleUsedIn } from '../../utils/access.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { OWNER_TYPES } from '../../constants/ownerTypes.js';
import { ROLE_TEMPLATES } from '../../constants/roleTemplates.js';
import { DEFAULT_DEPARTMENTS } from '../../constants/defaultDepartments.js';

// Super Admin only (ADR-016): add and edit institutes, combine institutes into a unit that shares
// roles and staff, add an institute to a unit or take it out, rename and separate units.
// Records never move between institutes: only roles and access change.
// Every change that touches several collections runs in one transaction: all or nothing.

const { INSTITUTE, UNIT } = OWNER_TYPES;
const key = (name) => name.trim().toLowerCase();

// Institutes, units and how many roles and users each owner has (the Organisation screen)
export async function overview(req) {
  const tenantId = req.scope.tenantId;
  const [institutes, units, roles, users, affiliations, universities] = await Promise.all([
    Institute.find({ tenantId }).sort({ name: 1 }).lean(),
    Unit.find({ tenantId }).sort({ name: 1 }).lean(),
    Role.find({ tenantId }).select('ownerId name instituteIds').sort({ name: 1 }).lean(),
    User.find({ tenantId }).select('access').lean(),
    Affiliation.find({ tenantId }).lean(),
    University.find().select('name').lean(),
  ]);
  const count = (items, getIds) => {
    const map = new Map();
    items.forEach((item) =>
      getIds(item).forEach((id) => map.set(String(id), (map.get(String(id)) ?? 0) + 1)),
    );
    return map;
  };
  const rolesPerOwner = count(roles, (r) => [r.ownerId]);
  const usersPerOwner = count(users, (u) => u.access.map((a) => a.ownerId));
  const stats = (id) => ({
    roleCount: rolesPerOwner.get(String(id)) ?? 0,
    userCount: usersPerOwner.get(String(id)) ?? 0,
  });
  const universityName = new Map(universities.map((u) => [String(u._id), u.name]));
  const universitiesOf = (instituteId) =>
    affiliations
      .filter((a) => String(a.instituteId) === String(instituteId))
      .map((a) => universityName.get(String(a.universityId)))
      .filter(Boolean);
  // A member of a unit: the unit roles it uses, and the unit staff who can open it
  const memberStats = (institute) => {
    const used = roles.filter(
      (r) => String(r.ownerId) === String(institute.unitId) && roleUsedIn(r, institute._id),
    );
    const usedIds = new Set(used.map((r) => String(r._id)));
    const staff = users.filter((u) =>
      u.access.some(
        (a) => String(a.ownerId) === String(institute.unitId) && usedIds.has(String(a.roleId)),
      ),
    );
    return { roleIds: used.map((r) => r._id), roleCount: used.length, userCount: staff.length };
  };
  return {
    institutes: institutes.map((i) => ({
      id: i._id,
      name: i.name,
      shortCode: i.shortCode,
      address: i.address,
      website: i.website,
      principalName: i.principalName,
      universities: universitiesOf(i._id),
      unitId: i.unitId,
      ...(i.unitId ? memberStats(i) : stats(i._id)),
    })),
    units: units.map((u) => ({
      id: u._id,
      name: u.name,
      instituteIds: u.instituteIds,
      // The unit's roles (each member institute ticks the ones it uses)
      roles: roles
        .filter((r) => String(r.ownerId) === String(u._id))
        .map((r) => ({ id: r._id, name: r.name })),
      ...stats(u._id),
    })),
  };
}

// The university choices for the Add institute form (a shared master, no tenant)
export async function universities() {
  const rows = await University.find().sort({ name: 1 }).lean();
  return rows.map((u) => ({ value: String(u._id), label: u.name }));
}

// ---- Institutes ---------------------------------------------------------------------------

// A new institute: separate (with its own default roles) or straight into an existing unit
// (using the unit's roles). It also gets its affiliation and the default clearance departments.
export async function createInstitute(req, data) {
  const tenantId = req.scope.tenantId;
  const { universityId, affiliatedFrom, unitId, defaultDepartments, roleTemplates, ...fields } =
    data;
  return withTransaction(async (session) => {
    const unit = unitId ? await Unit.findOne({ tenantId, _id: unitId }).session(session) : null;
    if (unitId && !unit) throw ApiError.badRequest('That unit does not exist');

    const [institute] = await Institute.create(
      [{ ...fields, tenantId, unitId: unit?._id ?? null, createdBy: req.user.id }],
      { session },
    );
    const scope = { tenantId, instituteId: institute._id, createdBy: req.user.id };
    if (universityId) {
      await Affiliation.create([{ ...scope, universityId, fromYear: affiliatedFrom }], { session });
    }
    if (defaultDepartments) {
      await Department.create(
        DEFAULT_DEPARTMENTS.map((name, index) => ({ ...scope, name, order: index + 1 })),
        { session, ordered: true },
      );
    }
    if (unit) {
      await Unit.updateOne(
        { tenantId, _id: unit._id },
        { $addToSet: { instituteIds: institute._id } },
        { session },
      );
    } else if (roleTemplates.length > 0) {
      await Role.create(
        ROLE_TEMPLATES.filter((t) => roleTemplates.includes(t.name)).map((t) => ({
          tenantId,
          ownerType: INSTITUTE,
          ownerId: institute._id,
          ...t,
          createdBy: req.user.id,
        })),
        { session, ordered: true },
      );
    }
    await audit(req, AUDIT_ACTIONS.CREATE, 'institute', institute._id, null, institute, session);
    return institute;
  });
}

// Name, address, website and principal. The short code never changes: it is printed in TC numbers.
// roleIds (institutes in a unit only): which of the unit's roles this institute uses. Staff whose
// role is not ticked can no longer open this institute (they keep the other institutes).
export async function updateInstitute(req, id, { roleIds, ...changes }) {
  const tenantId = req.scope.tenantId;
  return withTransaction(async (session) => {
    const institute = await Institute.findOne({ tenantId, _id: id }).session(session);
    if (!institute) throw ApiError.notFound('Institute not found');
    const before = institute.toObject();
    institute.set({ ...changes, updatedBy: req.user.id });
    await institute.save({ session });
    let rolesUsed;
    if (roleIds) {
      if (!institute.unitId) {
        throw ApiError.badRequest('A separate institute changes its roles on the Roles page');
      }
      rolesUsed = await setRolesUsed(req, session, institute, roleIds.map(String));
    }
    await audit(
      req,
      AUDIT_ACTIONS.UPDATE,
      'institute',
      institute._id,
      before,
      { ...institute.toObject(), ...(rolesUsed ? { rolesUsed } : {}) },
      session,
    );
    return institute;
  });
}

// Ticks or unticks this member institute on each of its unit's roles
async function setRolesUsed(req, session, institute, roleIds) {
  const tenantId = req.scope.tenantId;
  const unit = await Unit.findOne({ tenantId, _id: institute.unitId }).session(session).lean();
  const members = unit.instituteIds.map(String);
  const roles = await Role.find({ tenantId, ownerType: UNIT, ownerId: unit._id }).session(session);
  const unknown = roleIds.filter((rid) => !roles.some((r) => String(r._id) === rid));
  if (unknown.length > 0) throw ApiError.badRequest('Choose roles of this unit');

  const here = String(institute._id);
  for (const role of roles) {
    const current = role.instituteIds.length ? role.instituteIds.map(String) : members;
    const wanted = roleIds.includes(String(role._id))
      ? [...new Set([...current, here])]
      : current.filter((m) => m !== here);
    if (wanted.length === 0) {
      throw ApiError.badRequest(
        `"${role.name}" would not be used in any institute. Keep it ticked, or delete the role on the Roles page.`,
      );
    }
    const stored = wanted.length === members.length ? [] : wanted;
    if (stored.join() !== role.instituteIds.map(String).join()) {
      role.instituteIds = stored;
      role.updatedBy = req.user.id;
      await role.save({ session });
    }
  }
  return roles.filter((r) => roleIds.includes(String(r._id))).map((r) => r.name);
}

export async function renameUnit(req, id, { name }) {
  const unit = await Unit.findOne({ tenantId: req.scope.tenantId, _id: id });
  if (!unit) throw ApiError.notFound('Unit not found');
  const before = unit.toObject();
  unit.set({ name, updatedBy: req.user.id });
  await unit.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, 'unit', unit._id, before, unit);
  return unit;
}

// Works out what combining would do, without changing anything. Used by the preview and by
// combine itself, so the Super Admin sees exactly what will happen.
async function planCombine(req, { instituteIds, keepRolesFrom }, session = null) {
  const tenantId = req.scope.tenantId;
  const institutes = await Institute.find({ tenantId, _id: { $in: instituteIds } }).session(
    session,
  );
  if (institutes.length !== instituteIds.length) throw ApiError.notFound('Institute not found');
  const alreadyCombined = institutes.filter((i) => i.unitId);
  if (alreadyCombined.length > 0) {
    throw ApiError.conflict(
      `${alreadyCombined.map((i) => i.shortCode).join(', ')} is already in a unit. Separate it first.`,
    );
  }
  const fromTemplate = keepRolesFrom === 'template';
  if (!fromTemplate && !instituteIds.includes(String(keepRolesFrom))) {
    throw ApiError.badRequest(
      'Choose the roles of one of the selected institutes, or the default roles',
    );
  }

  const roles = await Role.find({ tenantId, ownerType: INSTITUTE, ownerId: { $in: instituteIds } })
    .session(session)
    .lean();
  const roleById = new Map(roles.map((r) => [String(r._id), r]));
  const keptRoles = fromTemplate
    ? ROLE_TEMPLATES.map((t) => ({ name: t.name }))
    : roles.filter((r) => String(r.ownerId) === String(keepRolesFrom));
  const keptByName = new Map(keptRoles.map((r) => [key(r.name), r]));
  const shortCode = new Map(institutes.map((i) => [String(i._id), i.shortCode]));

  const users = await User.find({ tenantId, 'access.ownerId': { $in: instituteIds } })
    .session(session)
    .lean();
  const isMember = (entry) =>
    entry.ownerType === INSTITUTE && instituteIds.includes(String(entry.ownerId));

  const assignments = users.map((user) => {
    const entries = user.access.filter(isMember);
    // Prefer the role the user has in the institute whose roles are kept
    const ordered = [...entries].sort(
      (a, b) =>
        Number(String(b.ownerId) === String(keepRolesFrom)) -
        Number(String(a.ownerId) === String(keepRolesFrom)),
    );
    const match = ordered
      .map((entry) => keptByName.get(key(roleById.get(String(entry.roleId))?.name ?? '')))
      .find(Boolean);
    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      otherAccess: user.access.filter((e) => !isMember(e)),
      from: entries.map((e) => ({
        institute: shortCode.get(String(e.ownerId)),
        roleName: roleById.get(String(e.roleId))?.name ?? '—',
      })),
      toRoleName: match?.name ?? null, // null: no role with the same name; access is removed
      departmentIds: [...new Set(entries.flatMap((e) => e.departmentIds.map(String)))],
    };
  });

  return { institutes, fromTemplate, keptRoles, assignments };
}

export async function previewCombine(req, data) {
  const plan = await planCombine(req, data);
  return {
    keptRoles: plan.keptRoles.map((r) => r.name),
    assignments: plan.assignments.map(({ userId, name, email, from, toRoleName }) => ({
      userId,
      name,
      email,
      from,
      toRoleName,
    })),
  };
}

export async function combine(req, data) {
  const tenantId = req.scope.tenantId;
  const unit = await withTransaction(async (session) => {
    const plan = await planCombine(req, data, session);
    const [created] = await Unit.create(
      [{ tenantId, name: data.name, instituteIds: data.instituteIds, createdBy: req.user.id }],
      { session },
    );
    const unitOwner = { ownerType: UNIT, ownerId: created._id };

    // 1. The unit's roles: moved from the chosen institute, or made from the templates
    if (plan.fromTemplate) {
      await Role.create(
        ROLE_TEMPLATES.map((t) => ({ tenantId, ...unitOwner, ...t, createdBy: req.user.id })),
        { session, ordered: true }, // Mongoose needs ordered: true to create several documents in a transaction,
      );
    } else {
      await Role.updateMany(
        { tenantId, ownerType: INSTITUTE, ownerId: data.keepRolesFrom },
        { $set: unitOwner },
        { session },
      );
    }
    const unitRoles = await Role.find({ tenantId, ...unitOwner })
      .session(session)
      .lean();
    const unitRoleByName = new Map(unitRoles.map((r) => [key(r.name), r]));

    // 2. Each user's access to the member institutes becomes one access to the unit
    for (const a of plan.assignments) {
      const role = a.toRoleName && unitRoleByName.get(key(a.toRoleName));
      const access = role
        ? [...a.otherAccess, { ...unitOwner, roleId: role._id, departmentIds: a.departmentIds }]
        : a.otherAccess;
      await User.updateOne({ tenantId, _id: a.userId }, { $set: { access } }, { session });
    }

    // 3. The other institutes' own roles are no longer used
    await Role.deleteMany(
      { tenantId, ownerType: INSTITUTE, ownerId: { $in: data.instituteIds } },
      { session },
    );
    await Institute.updateMany(
      { tenantId, _id: { $in: data.instituteIds } },
      { $set: { unitId: created._id } },
      { session },
    );
    await audit(
      req,
      AUDIT_ACTIONS.COMBINE,
      'unit',
      created._id,
      null,
      {
        name: created.name,
        instituteIds: data.instituteIds,
        keepRolesFrom: data.keepRolesFrom,
        usersWithoutRole: plan.assignments.filter((a) => !a.toRoleName).map((a) => a.email),
      },
      session,
    );
    return created;
  });
  return unit;
}

// ---- Adding an institute to an existing unit -----------------------------------------------

// What adding a separate institute to a unit would do. The unit keeps its own roles; the
// institute's staff get the unit role with the same name (or keep their unit role if they
// already have one). Users without a matching role lose access to that institute.
async function planJoin(req, unitId, instituteId, session = null) {
  const tenantId = req.scope.tenantId;
  // One query at a time: queries inside a transaction must not run in parallel on one session
  const unit = await Unit.findOne({ tenantId, _id: unitId }).session(session);
  const institute = await Institute.findOne({ tenantId, _id: instituteId }).session(session);
  if (!unit) throw ApiError.notFound('Unit not found');
  if (!institute) throw ApiError.notFound('Institute not found');
  if (institute.unitId) {
    throw ApiError.conflict(`${institute.shortCode} is already in a unit. Take it out first.`);
  }
  const unitRoles = await Role.find({ tenantId, ownerType: UNIT, ownerId: unit._id })
    .session(session)
    .lean();
  const ownRoles = await Role.find({ tenantId, ownerType: INSTITUTE, ownerId: institute._id })
    .session(session)
    .lean();
  const unitRoleByName = new Map(unitRoles.map((r) => [key(r.name), r]));
  const unitRoleById = new Map(unitRoles.map((r) => [String(r._id), r]));
  const ownRoleById = new Map(ownRoles.map((r) => [String(r._id), r]));

  const users = await User.find({ tenantId, 'access.ownerId': institute._id })
    .session(session)
    .lean();
  const assignments = users.map((user) => {
    const own = user.access.find((e) => String(e.ownerId) === String(institute._id));
    const unitEntry = user.access.find((e) => String(e.ownerId) === String(unit._id));
    const ownRoleName = ownRoleById.get(String(own.roleId))?.name ?? '—';
    const target = unitEntry
      ? unitRoleById.get(String(unitEntry.roleId))
      : unitRoleByName.get(key(ownRoleName));
    return {
      user,
      own,
      unitEntry,
      userId: user._id,
      name: user.name,
      email: user.email,
      from: [{ institute: institute.shortCode, roleName: ownRoleName }],
      toRoleName: target?.name ?? null,
      targetRoleId: target?._id ?? null,
    };
  });
  return { unit, institute, unitRoles, assignments };
}

export async function previewJoin(req, unitId, { instituteId }) {
  const plan = await planJoin(req, unitId, instituteId);
  return {
    keptRoles: plan.unitRoles.map((r) => r.name),
    assignments: plan.assignments.map(({ userId, name, email, from, toRoleName }) => ({
      userId,
      name,
      email,
      from,
      toRoleName,
    })),
  };
}

export async function joinUnit(req, unitId, { instituteId }) {
  const tenantId = req.scope.tenantId;
  await withTransaction(async (session) => {
    const plan = await planJoin(req, unitId, instituteId, session);
    const unitOwner = { ownerType: UNIT, ownerId: plan.unit._id };
    // A limited unit role given to this institute's staff is also used in this institute
    const limited = plan.unitRoles.filter(
      (r) =>
        r.instituteIds?.length &&
        plan.assignments.some((a) => !a.unitEntry && String(a.targetRoleId) === String(r._id)),
    );
    for (const role of limited) {
      await Role.updateOne(
        { tenantId, _id: role._id },
        { $addToSet: { instituteIds: plan.institute._id } },
        { session },
      );
    }
    for (const a of plan.assignments) {
      let access = a.user.access.filter((e) => e !== a.own);
      if (a.unitEntry) {
        // Already unit staff: their unit role now also covers this institute's departments
        access = access.map((e) =>
          e === a.unitEntry
            ? { ...e, departmentIds: [...e.departmentIds, ...a.own.departmentIds] }
            : e,
        );
      } else if (a.targetRoleId) {
        access.push({ ...unitOwner, roleId: a.targetRoleId, departmentIds: a.own.departmentIds });
      }
      await User.updateOne({ tenantId, _id: a.userId }, { $set: { access } }, { session });
    }
    await Role.deleteMany(
      { tenantId, ownerType: INSTITUTE, ownerId: plan.institute._id },
      { session },
    );
    await Institute.updateOne(
      { tenantId, _id: plan.institute._id },
      { $set: { unitId: plan.unit._id } },
      { session },
    );
    await Unit.updateOne(
      { tenantId, _id: plan.unit._id },
      { $addToSet: { instituteIds: plan.institute._id } },
      { session },
    );
    await audit(
      req,
      AUDIT_ACTIONS.COMBINE,
      'unit',
      plan.unit._id,
      null,
      {
        added: plan.institute.shortCode,
        usersWithoutRole: plan.assignments.filter((a) => !a.toRoleName).map((a) => a.email),
      },
      session,
    );
  });
}

// ---- Taking institutes out of a unit ------------------------------------------------------

// Takes `leavingIds` out of the unit. Each leaving institute gets its own copy of the unit's
// roles, and every unit user also gets access to it with the same role (and that institute's
// departments). If fewer than 2 institutes would remain, the whole unit is separated.
async function detach(req, session, unit, leavingIds) {
  const tenantId = req.scope.tenantId;
  const remaining = unit.instituteIds.filter((id) => !leavingIds.includes(String(id)));
  const dissolve = remaining.length < 2;
  const leaving = dissolve ? unit.instituteIds.map(String) : leavingIds;
  const unitOwner = { ownerType: UNIT, ownerId: unit._id };
  const unitRoles = await Role.find({ tenantId, ...unitOwner })
    .session(session)
    .lean();

  // Role copies per leaving institute: newRoleId[instituteId][oldRoleId]
  // Only the roles the institute used (a unit role can be limited to some institutes)
  const newRoleId = {};
  for (const instituteId of leaving) {
    const used = unitRoles.filter((r) => roleUsedIn(r, instituteId));
    if (used.length === 0) {
      newRoleId[instituteId] = {};
      continue;
    }
    const copies = await Role.create(
      used.map(({ name, description, permissions }) => ({
        tenantId,
        ownerType: INSTITUTE,
        ownerId: instituteId,
        name,
        description,
        permissions,
        createdBy: req.user.id,
      })),
      { session, ordered: true },
    );
    newRoleId[instituteId] = Object.fromEntries(
      used.map((r, index) => [String(r._id), copies[index]._id]),
    );
  }

  // Unit roles limited to leaving institutes only are of no use to the unit any more
  const leftover = dissolve
    ? []
    : unitRoles.filter(
        (r) => r.instituteIds?.length && r.instituteIds.every((id) => leaving.includes(String(id))),
      );
  const leftoverIds = new Set(leftover.map((r) => String(r._id)));

  const departments = await Department.find({ tenantId, instituteId: { $in: leaving } })
    .session(session)
    .lean();
  const instituteOfDepartment = new Map(
    departments.map((d) => [String(d._id), String(d.instituteId)]),
  );

  const users = await User.find({ tenantId, 'access.ownerId': unit._id }).session(session).lean();
  for (const user of users) {
    const access = user.access.flatMap((entry) => {
      if (String(entry.ownerId) !== String(unit._id)) return [entry];
      const copies = leaving
        .filter((instituteId) => newRoleId[instituteId][String(entry.roleId)])
        .map((instituteId) => ({
          ownerType: INSTITUTE,
          ownerId: instituteId,
          roleId: newRoleId[instituteId][String(entry.roleId)],
          departmentIds: entry.departmentIds.filter(
            (d) => instituteOfDepartment.get(String(d)) === instituteId,
          ),
        }));
      if (dissolve || leftoverIds.has(String(entry.roleId))) return copies;
      // Still unit staff for the institutes that stay; their departments move with the institute
      const stays = {
        ...entry,
        departmentIds: entry.departmentIds.filter((d) => !instituteOfDepartment.has(String(d))),
      };
      return [stays, ...copies];
    });
    await User.updateOne({ tenantId, _id: user._id }, { $set: { access } }, { session });
  }

  await Institute.updateMany(
    { tenantId, _id: { $in: leaving } },
    { $set: { unitId: null } },
    { session },
  );
  if (dissolve) {
    await Role.deleteMany({ tenantId, ...unitOwner }, { session });
    await Unit.deleteOne({ tenantId, _id: unit._id }, { session });
  } else {
    await Unit.updateOne(
      { tenantId, _id: unit._id },
      { $pull: { instituteIds: { $in: leaving } } },
      { session },
    );
    if (leftover.length > 0) {
      await Role.deleteMany({ tenantId, _id: { $in: [...leftoverIds] } }, { session });
    }
    await Role.updateMany(
      { tenantId, ...unitOwner },
      { $pull: { instituteIds: { $in: leaving } } },
      { session },
    );
  }
  return { dissolved: dissolve };
}

// Separate the whole unit: every institute becomes separate again
export async function separate(req, unitId) {
  const tenantId = req.scope.tenantId;
  await withTransaction(async (session) => {
    const unit = await Unit.findOne({ tenantId, _id: unitId }).session(session);
    if (!unit) throw ApiError.notFound('Unit not found');
    await detach(req, session, unit, unit.instituteIds.map(String));
    await audit(req, AUDIT_ACTIONS.SEPARATE, 'unit', unit._id, unit, null, session);
  });
}

// Take one institute out of a unit (the unit is separated if only one institute would remain)
export async function removeFromUnit(req, unitId, { instituteId }) {
  const tenantId = req.scope.tenantId;
  return withTransaction(async (session) => {
    const unit = await Unit.findOne({ tenantId, _id: unitId }).session(session);
    if (!unit) throw ApiError.notFound('Unit not found');
    if (!unit.instituteIds.map(String).includes(String(instituteId))) {
      throw ApiError.badRequest('That institute is not in this unit');
    }
    const result = await detach(req, session, unit, [String(instituteId)]);
    await audit(
      req,
      AUDIT_ACTIONS.SEPARATE,
      'unit',
      unit._id,
      unit,
      { removed: String(instituteId), ...result },
      session,
    );
    return result;
  });
}
