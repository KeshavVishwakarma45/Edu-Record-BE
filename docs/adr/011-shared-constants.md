# ADR-011: Shared constants are duplicated and checked by a test

- Status: Accepted
- Date: 2026-11-01

## Context

Roles, statuses, categories, course patterns and genders must have identical values on client
and server (no hard-coded strings). After ADR-001 there is no shared package.

## Decision

- `src/constants/{roles,statuses,categories,coursePatterns,genders}.js` exist in both repos and
  must be byte-identical.
- The backend test `tests/sharedConstants.test.js` compares them when the frontend is cloned next
  to the backend (`../edu-frontend`, or `FRONTEND_DIR`); otherwise it is skipped with a note.
- Changes are made in both repos on the same day, in two pull requests.

## Consequences

- Good: no extra package to publish or install.
- Bad: duplication; CI on GitHub skips the check unless both repos are checked out.
