# ADR-001: Two separate repositories for frontend and backend

- Status: Accepted
- Date: 2026-11-01

## Context

The skeleton was first built as one repository with npm workspaces (`server/` and `client/`, then
`edu-backend/` and `edu-frontend/`) and one shared `node_modules`. The project owner wants the
frontend and backend to be independent projects: separate GitHub repositories, separate
dependencies, and each runnable on its own. The internship pairs work on one side at a time
(frontend or backend) and swap on Day 16.

## Decision

- Two Git repositories:
  - **Edu-Record** (folder `edu-frontend`): React app.
  - **Edu-Record-BE** (folder `edu-backend`): Express + MongoDB API.
- Each repo has its own `package.json`, `package-lock.json`, `node_modules`, ESLint, Prettier,
  `.editorconfig`, `.gitattributes`, `.nvmrc`, Husky pre-commit hook, PR template, `CLAUDE.md` and README.
- Developers clone both side by side in one folder (`edurecords/`). A VS Code workspace file
  (`edurecords.code-workspace`, not inside either repo) opens both in one window.
- The outer folder is not a Git repo and has no `package.json`.

## Consequences

- Good: clear ownership, smaller pull requests, each side deploys and installs independently.
- Good: a broken frontend dependency cannot break the backend install, and the other way round.
- Bad: a feature that touches both sides needs two pull requests (same SRS ID in both).
- Bad: shared constants are duplicated (see ADR-011), and `npm run dev` no longer starts both
  apps at once: two terminals are needed.

## Alternatives considered

- One repo with npm workspaces: simpler to run, rejected by the project owner.
- Git submodules: too confusing for beginner interns.
