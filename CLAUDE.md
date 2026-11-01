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
- Protected routes always run: auth → tenantScope → requireRole(...) → validate(schema) → controller.
- tenantScope reads the `X-Institute-Id` header, checks the user has access to that institute,
  sets req.scope = { tenantId, instituteId, role, departmentId }. No access → 403 + audit entry.
- Services build every query from scoped(req) = { tenantId, instituteId }.
- A Mongoose plugin `tenantGuard` throws if find/update/delete/count on a tenant collection
  runs without tenantId in the filter.

## Roles (constants/roles.js, same values in both repos)

PLATFORM_ADMIN, SOCIETY_ADMIN, PRINCIPAL, EXAM_CLERK, TC_CLERK, ACCOUNTS, DEPT_INCHARGE

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
- `.setOptions({ skipTenantGuard: true })` is allowed in exactly two places: login
  (auth.service.js) and findScopedOr404 (utils/findScoped.js). Never add another.
- Dates of birth and other calendar dates travel as 'YYYY-MM-DD' and are stored as midnight UTC.
- In services, spread `...scoped(req)` LAST when creating records, so the body cannot pick a tenant.
- Express is v5: `req.query` is read-only (validate.js handles it).
- `src/constants/{roles,statuses,categories,coursePatterns,genders}.js` must stay byte-identical
  to the frontend repo's copies (a test checks this when the frontend is cloned next to this repo).
