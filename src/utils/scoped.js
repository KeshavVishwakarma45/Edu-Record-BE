import mongoose from 'mongoose';

// Start every database query in a service from scoped(req), for example:
//   Course.find({ ...scoped(req), name: 'BCA' })
// req.scope is set by the tenantScope middleware, so a query built this way can only
// ever see the selected institute's data (SRS BR-01).
//
// "All institutes" (the Super Admin's read-only view) gives { tenantId } only, so lists show every
// institute of the tenant; the list's ?instituteId= filter (see listQuery) narrows it to one.
// Writes never run in that view (tenantScope refuses them), so creating a record with
// { ...data, ...scoped(req) } always gets a real instituteId.
export function scoped(req) {
  if (!req.scope) {
    throw new Error('scoped(req) needs the tenantScope middleware on this route');
  }
  if (req.scope.allInstitutes) {
    const filter = req.query?.instituteId;
    return mongoose.isValidObjectId(filter)
      ? { tenantId: req.scope.tenantId, instituteId: filter }
      : { tenantId: req.scope.tenantId };
  }
  return { tenantId: req.scope.tenantId, instituteId: req.scope.instituteId };
}
