# EduRecords — project context

## What this is

A multi-tenant web portal that tracks university marksheets, degrees and Transfer
Certificates (TC) for Sant Singaji Education Society's two institutes:

- SSISM — Sant Singaji Institute of Science and Management, affiliated to Vikram University
- SSEC — Sant Singaji Engineering College, affiliated to RGPV

Five beginner MERN interns extend this project from 2 Nov 2026. This is the SKELETON.
Code must be simple, readable and consistent so beginners can copy its patterns.

## Repositories

The project is two separate Git repositories, cloned next to each other:

- **Edu-Record-BE** (this repo, folder `edu-backend`): the Express + MongoDB API.
- **Edu-Record** (folder `edu-frontend`): the React app. Its CLAUDE.md holds the frontend rules.

Each repo has its own package.json, node_modules, lint/format config and Husky hook.

## Stack (do not change)

- Node.js LTS (.nvmrc), plain JavaScript with ES modules. No TypeScript.
- Express, Mongoose, Joi, jsonwebtoken, bcrypt, cookie-parser, helmet, cors,
  express-rate-limit, multer, morgan, dotenv
- Database: MongoDB Atlas replica set (transactions are required)
- Tests: Jest + Supertest + mongodb-memory-server (MongoMemoryReplSet)
- Quality: ESLint + Prettier, Husky pre-commit
- Do NOT use: Redux, TypeScript, class components, DI containers, microservices,
  GraphQL, ORMs other than Mongoose.

## Folder structure

src/{app.js, server.js, config/, constants/, middleware/, utils/, modules/, seed/, templates/}
tests/
docs/
Each module = modules/<name>/<entity>.model.js, .validation.js, .service.js,
.controller.js, .routes.js. modules/courses is the EXAMPLE every intern copies.

## Tenant isolation (most important rule)

- Every collection except `tenants` and `universities` has `tenantId`.
- Institute-level collections also have `instituteId`.
- Both are the first fields of every compound index.
- Protected routes always run: auth → tenantScope → requirePermission(...) → validate(schema) → controller.
- tenantScope reads the `X-Institute-Id` header, checks the user has access to that institute,
  sets req.scope = { tenantId, instituteId, unitId, ownerType, ownerId, roleId, roleName,
  permissions, departmentIds }. No access → 403 + audit entry.
- Services build every query from scoped(req) = { tenantId, instituteId }.
- `X-Institute-Id: all` is the Super Admin's "All institutes" view: GET only (any other method
  answers 400 "Choose one institute"); scoped(req) is then { tenantId } plus an optional
  ?instituteId= filter. Changes are always sent to one institute.
- A Mongoose plugin `tenantGuard` throws if find/update/delete/count on a tenant collection
  runs without tenantId in the filter.

## Users, roles and permissions (ADR-016)

- **Super Admin** (`users.isSuperAdmin`): manages everything. It is a flag, not a role, so no
  admin can grant it. Only the Super Admin can combine/separate institutes and disable accounts.
- **Permissions** (`constants/permissions.js`, same file in both repos) are what the code checks:
  routes use `requirePermission(PERMISSIONS.X)`, never role names. A module adds its permissions there.
- **Roles** are records made by admins: a name plus permissions. Starting set:
  `constants/roleTemplates.js` (Admin, Principal, Exam Clerk, TC Clerk, Accounts, Department In-charge).
- **Separate or combined:** a separate institute owns its roles and staff; institutes combined in a
  **unit** share the unit's roles and staff. Records (students, TCs, numbering) never move.
  `req.scope.ownerType/ownerId` say which one applies to the selected institute.
- An admin (role with `users.manage` / `roles.manage`) manages only the roles and staff of the
  owner of the selected institute, and can only grant permissions they hold.
- A unit role can be limited to some of the unit's institutes (`role.instituteIds`, empty = all).
  Check it with `roleUsedIn(role, instituteId)` (utils/access.js); tenantScope already does.
- Users log in by email + password. New staff are invited with a one-time link (7 days) that the
  admin copies; the person sets their own password. The same link mechanism resets passwords.
- Seed: SSISM + SSEC combined in the unit "Sant Singaji Education Society"; users
  `superadmin@singaji.in` (Super Admin) and `admin@singaji.in` (Admin role).

## Document statuses (constants/statuses.js)

Expected, Not received, In custody, Issued, Returned to university, Cancelled

## API conventions

- Base path /api/v1, plural nouns, actions as POST /resource/:id/<verb>
- Success: { success: true, data, meta?: { page, limit, total } }
- Error: { success: false, error: { code, message, details? } }; codes in utils/errorCodes.js
- 400 validation, 401 not logged in, 403 no access, 404 not found, 409 conflict
- Lists accept page, limit (max 100), sort, search
- Controllers contain no business logic; services throw ApiError; one error middleware.
- Services call audit(req, action, entity, entityId, before, after, session?) on every create,
  update, delete.
- Services load one record by id with findScopedOr404(req, Model, id, entity) (utils/findScoped.js).
  A record of another institute or tenant answers 404 exactly like a missing one, and the attempt
  is audited as ACCESS_DENIED_RECORD (entity, entityId, user, requested institute).

## Style

- Server files <entity>.<layer>.js; React components PascalCase.jsx
- No hard-coded role/status strings; import constants
- Comments explain why, not what
- Dates stored UTC, shown IST as dd/mm/yyyy

## Do NOT build

Inward, results, clearance, hand-over, TC numbering, PDF, reports, and everything for students
except the model. The interns build these. Only create empty module folders with a README listing
their SRS IDs.

Students are the one exception: the Student MODEL is part of the skeleton
(modules/students/student.model.js: fields and indexes from the architecture doc, tenantGuard,
registered in config/models.js) and the seed creates 20 sample students. Student routes,
services, validation, Excel import and screens are NOT built: Module A builds them.

## Architecture notes

- TC numbering (Module C, utils/counter.js). Two series per TC, both in the tcSeries collection:
  - Ref no. series key: (tenantId, instituteId, kind 'ref', course SHORT CODE, year only if the
    series restarts yearly). NOT courseId: B.Sc Bio and B.Sc Micro share the short code "B.Sc",
    so they must share one series, or both would print the same Ref no. (e.g. SSISM/TC/2026/B.Sc/1).
  - Book serial series key: (tenantId, instituteId, kind 'serial', year only if restarting).
  - Numbers are taken at Principal approval with findOneAndUpdate + $inc inside withTransaction().

## Skeleton facts that are easy to get wrong

- Register every new model in `src/config/models.js`, or populate() fails at runtime
  (a test checks this).
- `populate()` on a tenant collection must pass the tenant: `.populate({ path, match: { tenantId } })`.
- `.setOptions({ skipTenantGuard: true })` is allowed in exactly three places: login and
  invite/password links (auth.service.js), and findScopedOr404 (utils/findScoped.js). Never add another.
- Roles and users are not institute records: query them with `ownerFilter(req)` (utils/access.js),
  not `scoped(req)`. In the "All institutes" view ownerFilter covers every owner of the tenant.
- The Organisation routes use `organisationScope` (not tenantScope): they change the organisation,
  not one institute's records.
- Inside a transaction, `Model.create([...several], { session, ordered: true })`: Mongoose 9
  refuses several documents with a session unless `ordered: true`.
- Dates of birth and other calendar dates travel as 'YYYY-MM-DD' and are stored as midnight UTC.
- In services, spread `...scoped(req)` LAST when creating records, so the body cannot pick a tenant.
- Express is v5: `req.query` is read-only (validate.js handles it).
- `src/constants/{permissions,statuses,categories,coursePatterns,genders,ownerTypes}.js` must stay byte-identical
  to the frontend repo's copies (a test checks this when the frontend is cloned next to this repo).
