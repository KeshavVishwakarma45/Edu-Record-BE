# ADR-004: One fixed middleware chain and layered modules

- Status: Accepted
- Date: 2026-11-01

## Context

Interns copy whatever pattern they see first. Security checks must never be skipped by accident.

## Decision

- Every protected route runs, in this order:
  `auth → tenantScope → requireRole(...) → validate(schema) → controller`.
- Each backend module has five files: `<entity>.model.js`, `.validation.js`, `.service.js`,
  `.controller.js`, `.routes.js`. `modules/courses` is the example to copy.
- Controllers contain no business logic. Services throw `ApiError`; one error middleware formats
  every error as `{ success: false, error: { code, message, details? } }`.
- Successful answers are `{ success: true, data, meta? }` (`sendSuccess`, `sendList`).
- Every model is registered in `src/config/models.js` (a test checks it), because populate()
  looks models up by name.

## Consequences

- Good: every endpoint looks the same; the frontend can call any module the same way.
- Good: reviewers check one chain, not a different design per intern.
- Bad: small endpoints still need five files and `validate({})` even when there is nothing to check.
- Only the auth routes skip part of the chain (they run before an institute is chosen).
