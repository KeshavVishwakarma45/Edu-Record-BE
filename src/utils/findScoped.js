import { ApiError } from './ApiError.js';
import { scoped } from './scoped.js';
import { audit } from './audit.js';
import { AUDIT_ACTIONS } from '../constants/auditActions.js';

// Finds ONE record by id inside the selected institute, or throws 404.
//   const course = await findScopedOr404(req, Course, id, 'course');
//
// A record of another institute or tenant also answers 404, so we never confirm it exists.
// But asking for someone else's record by id is suspicious, so that case is written to the
// audit log as ACCESS_DENIED_RECORD (SRS AC-10). A truly missing id is not logged.
export async function findScopedOr404(req, Model, id, entity) {
  const record = await Model.findOne({ ...scoped(req), _id: id });
  if (record) return record;

  // The second allowed tenantGuard bypass (login is the first): only to know whether to log
  const existsElsewhere = await Model.exists({ _id: id }).setOptions({ skipTenantGuard: true });
  if (existsElsewhere) {
    await audit(req, AUDIT_ACTIONS.ACCESS_DENIED_RECORD, entity, id, null, {
      requestedInstituteId: req.scope.instituteId,
      method: req.method,
      path: req.originalUrl,
    });
  }
  throw ApiError.notFound(`${entity[0].toUpperCase()}${entity.slice(1)} not found`);
}
