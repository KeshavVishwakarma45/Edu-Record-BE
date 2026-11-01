import { AuditLog } from '../modules/audit/auditLog.model.js';

// Turn a Mongoose document into a plain object without secrets, so it is safe to store.
function toPlain(value) {
  if (!value) return null;
  const plain = typeof value.toObject === 'function' ? value.toObject() : { ...value };
  delete plain.passwordHash;
  delete plain.setupTokenHash;
  return plain;
}

// Write one audit entry (SRS BR-14). Services call this on every create, update and delete:
//   await audit(req, AUDIT_ACTIONS.UPDATE, 'course', course._id, before, course);
// Inside a transaction, pass the session so the entry is saved or rolled back with the change.
export async function audit(req, action, entity, entityId, before, after, session) {
  const entry = {
    tenantId: req.scope?.tenantId ?? req.user.tenantId,
    instituteId: req.scope?.instituteId ?? null,
    userId: req.user?.id ?? null,
    action,
    entity,
    entityId: entityId ?? null,
    before: toPlain(before),
    after: toPlain(after),
    ip: req.ip ?? '',
  };
  // create() with an array is the form that accepts a session
  await AuditLog.create([entry], session ? { session } : undefined);
}
