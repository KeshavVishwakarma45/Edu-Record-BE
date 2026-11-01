# ADR-015: Code quality: ESLint, Prettier, Husky and LF line endings

- Status: Accepted
- Date: 2026-11-01

## Context

Interns use Windows, macOS and Ubuntu laptops. Style arguments and CRLF line endings waste
review time.

## Decision

- ESLint (flat config) + Prettier in each repo; `no-console` forbids `console.log`.
- Husky pre-commit runs lint-staged: ESLint with zero warnings and a Prettier check on staged files.
- `.gitattributes` forces LF line endings; `.editorconfig` sets editors to LF and 2 spaces.
- Commits follow `INW-03: mark document received`; branches `feature/<SRS-ID>-<short-name>`.

## Consequences

- Good: reviews focus on behaviour, not formatting.
- Bad: Windows users must commit from a terminal (Git Bash / VS Code) for the hook to run.
