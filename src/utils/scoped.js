// Start every database query in a service from scoped(req), for example:
//   Course.find({ ...scoped(req), name: 'BCA' })
// req.scope is set by the tenantScope middleware, so a query built this way can only
// ever see the selected institute's data (SRS BR-01).
export function scoped(req) {
  if (!req.scope) {
    throw new Error('scoped(req) needs the tenantScope middleware on this route');
  }
  return { tenantId: req.scope.tenantId, instituteId: req.scope.instituteId };
}
