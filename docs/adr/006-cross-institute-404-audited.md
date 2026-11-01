# ADR-006: Another institute's record answers 404 and is audited

- Status: Accepted
- Date: 2026-11-01

## Context

With the correct `X-Institute-Id`, a user may still request an id that belongs to another
institute or tenant. Answering 403 would confirm the record exists. Silently answering 404 hides
a suspicious action from the Principal (AC-10 asks that access attempts are logged).

## Decision

- Services load one record with `findScopedOr404(req, Model, id, entity)` (`src/utils/findScoped.js`).
- If the id is not in the selected institute, the answer is 404, byte-for-byte the same as for a
  missing id.
- If the id exists elsewhere, an audit entry `ACCESS_DENIED_RECORD` is written with entity,
  entityId, user and requested institute. A truly missing id is not logged.
- This helper is the second (and last) place allowed to bypass `tenantGuard`, only to test whether
  the id exists; it never returns that record.

## Consequences

- Good: no information leak, and suspicious requests are visible in the audit log.
- Bad: one extra query on every 404. Acceptable for this traffic.
