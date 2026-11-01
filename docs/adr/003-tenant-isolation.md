# ADR-003: Tenant and institute isolation in the application layer

- Status: Accepted
- Date: 2026-11-01

## Context

One database holds several tenants (societies) and institutes (SSISM, SSEC). MongoDB has no
row-level security (SRS NFR-04). A user of SSISM must never read or change SSEC data (BR-01, AC-10).

## Decision

- Every collection except `tenants` and `universities` has `tenantId`; institute-level collections
  also have `instituteId`. Both are the first fields of every compound index.
- The client sends the selected institute in the `X-Institute-Id` header.
- `tenantScope` middleware checks the user has access to that institute and sets
  `req.scope = { tenantId, instituteId, role, departmentId }`. No access: 403 plus an audit entry.
- Services build every query from `scoped(req)`.
- The `tenantGuard` Mongoose plugin throws when find/update/delete/count/aggregate runs without
  `tenantId` in the filter. `populate()` must pass `match: { tenantId }`.

## Consequences

- Good: isolation is enforced in one place and a forgotten filter fails loudly in development.
- Good: tests prove an SSISM user gets 403 on SSEC list/read/update/delete.
- Bad: every query needs `scoped(req)`; populate needs the extra `match`.
- The guard bypass `.setOptions({ skipTenantGuard: true })` is allowed in exactly two places
  (ADR-006).
