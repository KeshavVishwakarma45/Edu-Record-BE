# audit

The `AuditLog` model (collection `auditLogs`): append-only record of who changed what (SRS BR-14).

- Write entries only with `audit(req, action, entity, entityId, before, after, session?)` from `utils/audit.js`.
- Updates and deletes on this collection throw. There is no update or delete route, ever.
- Actions live in `constants/auditActions.js`; add APPROVE, PRINT, HANDOVER when those modules need them.
- `tenantScope` writes an `ACCESS_DENIED` entry for every refused institute (AC-10).
- `findScopedOr404` writes an `ACCESS_DENIED_RECORD` entry when an id belongs to another institute or tenant.
