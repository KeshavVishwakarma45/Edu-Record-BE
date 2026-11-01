// Mongoose plugin: a safety net for tenant isolation.
// Any find / update / delete / count on a tenant collection WITHOUT tenantId in the filter
// throws, so a forgotten scoped(req) fails loudly in development instead of leaking data.
//
// Add it to every schema that has tenantId:   courseSchema.plugin(tenantGuard);
//
// populate() runs its own query, so pass the tenant along:
//   .populate({ path: 'affiliationId', match: { tenantId: req.scope.tenantId } })
//
// Only two places may bypass it, always explicitly with .setOptions({ skipTenantGuard: true }):
//   1. login (auth.service.js): the tenant is not known until the user is found
//   2. findScopedOr404 (utils/findScoped.js): only checks whether an id exists elsewhere,
//      to audit the attempt; it never returns that record
// Nowhere else. A pull request adding a third bypass needs the project owner's review.

const GUARDED_QUERIES = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
];

export function tenantGuard(schema) {
  schema.pre(GUARDED_QUERIES, function checkTenantFilter() {
    if (this.getOptions().skipTenantGuard) return;
    const filter = this.getFilter();
    if (!filter || filter.tenantId === undefined || filter.tenantId === null) {
      throw new Error(
        `tenantGuard: ${this.model.modelName}.${this.op}() was called without tenantId in the filter. ` +
          'Build the filter from scoped(req).',
      );
    }
  });

  // An aggregation must start with a $match on tenantId
  schema.pre('aggregate', function checkTenantMatch() {
    const firstStage = this.pipeline()[0];
    if (!firstStage?.$match?.tenantId) {
      throw new Error(
        `tenantGuard: ${this._model.modelName}.aggregate() must start with { $match: { tenantId, ... } }`,
      );
    }
  });

  // estimatedDocumentCount cannot take a filter, so it is never allowed on tenant data
  schema.pre('estimatedDocumentCount', function blockEstimatedCount() {
    throw new Error('tenantGuard: use countDocuments({ ...scoped(req) }) instead');
  });
}
