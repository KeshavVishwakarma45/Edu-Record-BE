# ADR-016: Separate institutes, optional units, custom roles and three admin levels

- Status: Accepted and built (1 Nov 2026)
- Date: 2026-11-01
- Changes when accepted: ADR-003 (how the role is found), ADR-004 (`requireRole` becomes
  `requirePermission`), ADR-011 (roles constants become permissions constants)

## What was built (1 Nov 2026)

The design below is built, with these choices by the project owner:

- **Super Admin** manages everything: the Organisation page (add and edit institutes, combine with
  a preview, add one institute to a unit or take it out, rename, separate),
  Roles, Users and invites, and disabling accounts. Admins (roles with `users.manage` /
  `roles.manage`) manage the roles and staff of the institute or unit selected in the top bar.
- **Invites are links** the admin copies and sends (no email service yet): one-time, 7 days, only
  a hash stored. The same mechanism makes password-reset links.
- **Seed:** SSISM and SSEC combined in the unit "Sant Singaji Education Society" with the six
  default roles; `superadmin@singaji.in` (Super Admin) and `admin@singaji.in` (Admin role).
- **Open questions, as decided for now:** the SRS Society Admin is replaced by the Super Admin (Q1);
  any admin may grant `tc.approve` if they hold it (Q2); reports stay per institute (Q3); on combine
  the Super Admin chooses the role list each time, nothing is pre-selected (Q4).
- Login is by email (ADR-017). The earlier fixed `constants/roles.js` was removed; the code checks
  `constants/permissions.js` only.
- **"All institutes" view** (the Super Admin's default): the switcher's first entry sends
  `X-Institute-Id: all`. tenantScope allows it only for the Super Admin and only for GET; lists then
  cover the whole tenant (`scoped(req)` = `{ tenantId }`, optional `?instituteId=` filter) and the
  Roles / Users lists show every owner with an "Institute / unit" column. Every change is still
  sent to one institute (the client passes the record's own institute), so all normal checks
  apply. The Organisation routes use `organisationScope` instead of tenantScope, because they change
  the organisation itself. Admins and staff keep one institute at a time.
- **Each institute or unit has its own roles**, decided by the Super Admin: a new separate
  institute starts with the built-in roles the Super Admin ticks (`roleTemplates`), and the
  Add role form can start from a built-in role (`GET /roles/templates`) or from nothing.
- **Per-institute roles inside a unit:** a unit role has `instituteIds` (empty or missing = every
  member). Editing an institute that is in a unit (Organisation page) ticks the unit roles it uses,
  so SSISM can use 2 roles and SSEC 4. tenantScope and `/auth/me` only let a user open institutes
  where their role is used (`roleUsedIn` in utils/access.js). Taking an institute out copies only
  the roles it used; a unit role used only by leaving institutes is deleted from the unit. A role
  can never be used in no institute (400). Roles and Users lists show "Used in" / "Can open"
  badges and, in "All institutes", filter by institute.
- Not built yet: an Institute Admin / Unit Admin as a separate _kind_ of user (today "admin" simply
  means a role with the admin permissions), automatic invite emails, and multi-tenant Super Admin.

## Context

The skeleton has 7 roles fixed in code (`constants/roles.js`). A Society Admin simply has the
same role in both SSISM and SSEC. The project owner wants instead:

1. **SSISM and SSEC are separate entities.** Each has its own admin and its own set of roles
   (for example 8 roles each).
2. **One Super Admin above everything**, who manages all institutes and admins.
3. The Super Admin can **combine institutes into one unit**. Then one shared set of roles
   (for example 8 in total) and one staff list work for both, instead of 8 + 8.

Decisions already taken by the project owner (1 Nov 2026):

| Question                | Answer                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| What does a unit share? | **Roles and staff only.** Students, documents, TCs and TC numbering stay per institute |
| How are roles defined?  | **Custom roles** built from permissions; the SRS roles are only the starting set       |
| Which admins exist?     | **Super Admin → Unit Admin → Institute Admin**                                         |
| When is it built?       | **After this ADR is approved**, as one reviewed update                                 |

## Decision

### 1. Words

| Word       | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| Tenant     | The society (Sant Singaji Education Society). Unchanged                       |
| Institute  | SSISM or SSEC. Always owns its own data (students, documents, TCs, numbering) |
| Unit       | A group of 2 or more institutes of one tenant that **share roles and staff**  |
| Role owner | Where a role list lives: a **separate institute**, or a **unit**              |
| Permission | One thing a user may do, fixed in code, e.g. `course.write`, `tc.approve`     |
| Role       | A name plus a list of permissions, created by an admin, e.g. "Exam Clerk"     |
| Assignment | "This user has this role in this institute (or in this unit)"                 |

An institute is either **separate** (its own roles, admin and staff) or a **member of one unit**
(the unit's roles, admin and staff). It is never both.

### 2. Admin levels

| Level           | Who sets it up     | What they can do                                                                                                                       |
| --------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin     | Seed (one or more) | Everything: tenants, institutes, create and dissolve units, choose roles kept on combining, create Unit/Institute Admins, see all data |
| Unit Admin      | Super Admin        | For one unit: manage its roles and staff, see data of all its institutes                                                               |
| Institute Admin | Super Admin        | For one separate institute: manage its roles and staff, see its data                                                                   |

Super Admin is a flag on the user (`isSuperAdmin: true`), not a role, so no admin can grant it.
Unit Admin and Institute Admin are ordinary roles that include the admin permissions
(`roles.manage`, `users.manage`). Rule: an admin can never give a role more permissions than they
have themselves.

### 3. Data model (backend)

| Collection   | New / changed | Key fields                                                                            | Indexes                                     |
| ------------ | ------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| `units`      | new           | tenantId, name, instituteIds[]                                                        | (tenantId, name) unique                     |
| `institutes` | changed       | + unitId (null = separate)                                                            | (tenantId, unitId)                          |
| `roles`      | new           | tenantId, ownerType ('institute' / 'unit'), ownerId, name, permissions[], isAdminRole | (tenantId, ownerType, ownerId, name) unique |
| `users`      | changed       | + isSuperAdmin; `access[]` becomes `{ ownerType, ownerId, roleId, departmentIds[] }`  | (tenantId, access.ownerId)                  |

- `departmentIds[]`: a Department In-charge in a unit can be in charge of the Library of SSISM
  **and** of SSEC (one department id per institute). Departments still belong to one institute.
- Permissions live in `src/constants/permissions.js`, identical in both repos (replaces
  `roles.js` in the shared-constants check). Each module adds its own permissions there.

Starting permission list (modules add more as they are built):

| Area      | Permissions                                                                     |
| --------- | ------------------------------------------------------------------------------- |
| Setup     | `setup.view`, `setup.manage` (institutes, universities, departments, TC series) |
| Admin     | `users.manage`, `roles.manage`, `audit.view`                                    |
| Courses   | `course.read`, `course.write`                                                   |
| Students  | `student.read`, `student.write`, `student.import`                               |
| Inward    | `inward.read`, `inward.manage`                                                  |
| Hand-over | `handover.issue`                                                                |
| Clearance | `clearance.view`, `clearance.act` (own departments only), `tc.apply`            |
| TC        | `tc.read`, `tc.draft`, `tc.approve`, `tc.issue`                                 |
| Reports   | `report.view`                                                                   |

### 4. How a request is checked

The middleware chain keeps its shape, with one step renamed:

```
auth → tenantScope → requirePermission(PERMISSIONS.X) → validate → controller → service
```

`tenantScope` (X-Institute-Id = SSISM):

1. Load the institute. If it has a `unitId`, the role owner is that unit; otherwise the institute.
2. Find the user's assignment for that owner. None, and not Super Admin → 403 + audit (as today).
3. Load the role and set
   `req.scope = { tenantId, instituteId, unitId, roleId, roleName, permissions, departmentIds }`.
4. Super Admin: `permissions = all`, access to every institute of every tenant.

Services do not change: every query still starts from `scoped(req) = { tenantId, instituteId }`.
**Combining two institutes never mixes their records**: a unit user switches institute with the
same switcher and sees one institute's data at a time. Another institute's record still answers
404 and is audited (ADR-006).

### 5. Combining and separating (Super Admin only)

Both run in **one transaction** and write an audit entry.

| Action                    | What happens                                                                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combine SSISM + SSEC      | Super Admin picks the role list to keep (SSISM's, SSEC's, or the default template). Roles move to the unit; each user's assignments are mapped to the unit role with the same name (Super Admin confirms a preview); unmatched assignments are listed, not silently deleted |
| Separate a unit           | Unit roles are copied to each institute; every unit assignment becomes one assignment per institute                                                                                                                                                                         |
| Add / remove an institute | Same as combine / separate for that one institute                                                                                                                                                                                                                           |

### 6. API (new endpoints, all with the full chain)

| Endpoint                                                                                       | Permission                                                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET/POST/PATCH /api/v1/units`, `POST /units/:id/dissolve`                                     | Super Admin only                                                         |
| `POST /api/v1/units/preview-combine`                                                           | Super Admin only (shows the mapping before combining)                    |
| `GET/POST/PATCH/DELETE /api/v1/roles`                                                          | `roles.manage` (roles of the current owner)                              |
| `GET /api/v1/permissions`                                                                      | `roles.manage` (the checkbox list)                                       |
| `GET/POST/PATCH /api/v1/users`, `POST /users/:id/reset-password`, `POST /users/:id/deactivate` | `users.manage`                                                           |
| `GET /api/v1/auth/me`                                                                          | logged in: now returns, per institute, its role name and **permissions** |

### 7. Frontend

- `routes.jsx`: each page lists a **permission** instead of roles; the sidebar shows a page when
  the user has it. A `usePermission('tc.approve')` hook hides buttons.
- New admin pages: **Roles** (list + permission checkboxes), **Users** (create, assign role per
  institute or unit, reset password, deactivate), and for the Super Admin **Units** (combine with a
  preview, separate).
- The top bar shows the unit name next to the institute badge when the institute is in a unit.

### 8. Seed (development)

- Super Admin `9000000000`.
- SSISM and SSEC **separate** (no unit), each with its own starting roles:
  Institute Admin, Principal, Exam Clerk, TC Clerk, Accounts, Department In-charge
  (permissions taken from the SRS role table), and one user per role per institute (as today).
- A ready-made test: the Super Admin can combine them from the Units page and separate them again.
- `9000000001` (Society Admin today) is removed; the Super Admin covers society-wide work.

### 9. Tests that must pass before merge

- Separate mode: SSISM Institute Admin cannot see or change SSEC roles or users (403).
- Combined mode: one unit role works in both institutes; SSISM data is still never returned under
  the SSEC header (404 + audit).
- An admin cannot create a role with a permission they do not have.
- A Department In-charge only sees clearance items of their own departments.
- Combine and separate are all-or-nothing (a failure in the middle changes nothing).
- Only the Super Admin can combine, separate or create admins.
- Every existing security test, rewritten from roles to permissions.

## Consequences

- Good: each institute runs independently, as the Society wants, and the same code supports one
  combined unit later without a rewrite.
- Good: new roles need no code change; code checks permissions, so renaming a role breaks nothing.
- Bad: a bigger skeleton change (estimated 1.5–2 days): middleware, user model, auth, seed, all
  tests, new admin APIs and pages, and the frontend route list.
- Bad: interns use `requirePermission(PERMISSIONS.X)` and must add new permissions to both repos.
- Timing: Days 1–4 are setup and practice; module building starts Wed 11 Nov (Day 5). This change
  should be merged before Day 5 so every module is built on permissions from the start.

## Open questions for the project owner

1. **Society Admin:** the SRS lists a Society Admin who sees all institutes' data. This design
   replaces it with the Super Admin. Is that right, or is a tenant-level admin also needed
   (for example when a second society joins the platform)?
2. **Who may grant `tc.approve`?** Should only the Super Admin be able to put TC approval into a
   role, so an Institute Admin cannot make a clerk an approver?
3. **Reports across a unit:** with "roles and staff only", reports show one institute at a time.
   Is a combined unit report needed later (P2)?
4. **Default on combine:** which role list should be pre-selected: the larger institute's, or the
   default template?

## Alternatives considered

- **Keep the 7 fixed roles** and only choose per institute who holds them: simpler, but every new
  role needs a code change, and "8 roles per institute" would not be possible.
- **Combine data as well** (one student list across a unit): rejected by the project owner; it
  would also mix the separate TC books and numbering (SRS BR-04).
- **No Unit Admin** (Super Admin manages units directly): rejected by the project owner.
