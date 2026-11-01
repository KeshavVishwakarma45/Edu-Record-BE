# Architecture Decision Records (ADR)

Each file records one decision: the situation, what we decided and what it costs us.
This is the decision log for the **whole EduRecords project** (frontend and backend).

| ADR                                                      | Decision                                                                     | Status   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| [ADR-001](001-two-repositories.md)                       | Two separate repositories for frontend and backend                           | Accepted |
| [ADR-002](002-javascript-node22-pinned-versions.md)      | Plain JavaScript on Node.js 22 with exact, current package versions          | Accepted |
| [ADR-003](003-tenant-isolation.md)                       | Tenant and institute isolation in the application layer                      | Accepted |
| [ADR-004](004-middleware-chain-and-modules.md)           | One fixed middleware chain and layered modules                               | Accepted |
| [ADR-005](005-auth-tokens-and-refresh-cookie.md)         | Login with short access tokens and an httpOnly refresh cookie                | Accepted |
| [ADR-006](006-cross-institute-404-audited.md)            | Another institute's record answers 404 and is audited                        | Accepted |
| [ADR-007](007-append-only-audit-log.md)                  | Append-only audit log                                                        | Accepted |
| [ADR-008](008-private-file-storage.md)                   | Private file storage behind an authenticated route                           | Accepted |
| [ADR-009](009-tc-numbering-series.md)                    | TC numbering at approval, with the Ref no. series keyed on course short code | Accepted |
| [ADR-010](010-replica-set-and-database-per-developer.md) | MongoDB replica set everywhere, one database per developer                   | Accepted |
| [ADR-011](011-shared-constants.md)                       | Shared constants are duplicated and checked by a test                        | Accepted |
| [ADR-012](012-student-model-in-skeleton.md)              | Only the Student model is part of the skeleton                               | Accepted |
| [ADR-013](013-frontend-patterns.md)                      | Frontend patterns: one route list, small hooks, shared components            | Accepted |
| [ADR-014](014-calendar-dates.md)                         | Calendar dates as YYYY-MM-DD, shown in IST as dd/mm/yyyy                     | Accepted |
| [ADR-015](015-code-quality-tooling.md)                   | Code quality: ESLint, Prettier, Husky and LF line endings                    | Accepted |

## Adding a decision

1. Copy [template.md](template.md) to the next number, e.g. `016-short-title.md`.
2. Fill in Context, Decision and Consequences in plain words. Keep it to one page.
3. Add a row to the table above and open a pull request. The faculty mentor approves it;
   decisions about login, roles, tenant security or TC numbering also need the project owner.
4. Never edit an accepted ADR to change the decision. Write a new ADR that says
   "Supersedes ADR-00X" and change the old one's status to "Superseded by ADR-0YY".
