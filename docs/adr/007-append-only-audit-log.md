# ADR-007: Append-only audit log

- Status: Accepted
- Date: 2026-11-01

## Context

SRS BR-14: every create, update, approve, print and hand-over is logged with user, time and
old/new values. Records are legal documents.

## Decision

- One collection `auditLogs`, written only through `audit(req, action, entity, entityId, before,
after, session?)` from `src/utils/audit.js`.
- Update and delete operations on the collection throw (schema hooks). There is no update or
  delete route.
- Inside a transaction, the session is passed so the entry is saved or rolled back with the change.
- Password hashes are removed from stored snapshots.
- Actions live in `src/constants/auditActions.js` (CREATE, UPDATE, DELETE, ACCESS_DENIED,
  ACCESS_DENIED_RECORD; APPROVE, PRINT, HANDOVER added by the interns).

## Consequences

- Good: a complete, tamper-resistant history for the Principal and for audits.
- Bad: the collection only grows; retention (1 year, NFR-05) is a P3 job.
