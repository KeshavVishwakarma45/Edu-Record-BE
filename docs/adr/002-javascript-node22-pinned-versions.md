# ADR-002: Plain JavaScript on Node.js 22 with exact, current package versions

- Status: Accepted
- Date: 2026-11-01

## Context

Five beginner interns must read and copy every file. The architecture document fixes the MERN stack
and asks for current stable versions pinned in `package.json`.

## Decision

- Plain JavaScript with ES modules (`"type": "module"`), no TypeScript.
- Node.js 22 LTS in `.nvmrc` (Node 24 could not be installed on the setup machine; moving to 24 is
  a one-line change once tested).
- `.npmrc` has `save-exact=true`, so every dependency is pinned to an exact version.
- Current majors at setup time: Express 5, Mongoose 9, React 19, MUI 9, MUI X 9, Vite 8,
  React Router 7, Jest 30.
- ESLint stays on 9 because `eslint-plugin-react` does not support ESLint 10 yet.

## Consequences

- Good: everyone runs the same versions; no type tooling to learn.
- Bad: tutorials for Express 4, MUI 5–7 and older Mongoose are partly wrong for this code
  (e.g. MUI `slotProps`, Express 5 read-only `req.query`). CLAUDE.md lists the traps.
- Bad: `npm audit` reports moderate issues in ESLint 9's dev dependencies (not in production code).
