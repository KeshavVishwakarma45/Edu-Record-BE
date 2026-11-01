# Backend folder structure (Edu-Record-BE)

Every file in this repository and what it is for. The frontend has its own list in the
Edu-Record repo (`docs/STRUCTURE.md`). Why things are built this way: [docs/adr/](adr/README.md).

```
edu-backend/
├── .editorconfig              editor settings: LF line endings, 2-space indent
├── .env.example               every setting the API needs; copy to .env (never commit .env)
├── .gitattributes             forces LF line endings on every OS
├── .github/
│   └── pull_request_template.md   what changed, SRS IDs, how to test, screenshot, checklist
├── .gitignore                 keeps node_modules, .env, uploads/ and .local-db/ out of Git
├── .husky/
│   └── pre-commit             runs ESLint + Prettier on staged files before every commit
├── .npmrc                     save-exact=true: new packages are pinned to an exact version
├── .nvmrc                     Node.js version (22)
├── .prettierignore            files Prettier skips
├── .prettierrc.json           formatting rules (single quotes, 100 columns, trailing commas)
├── CLAUDE.md                  project rules: tenant isolation, middleware chain, conventions
├── README.md                  setup, seeded logins, scripts, how to add a module
├── eslint.config.js           lint rules (Node, Jest, no console.log)
├── package.json               dependencies, scripts (dev, seed, test, lint...), Jest settings
├── package-lock.json          exact installed versions (do not edit by hand)
│
├── docs/
│   ├── README.md              what is in docs/ and how to use the Postman collection
│   ├── STRUCTURE.md           this file
│   ├── adr/                   Architecture Decision Records (one file per decision) + template
│   ├── handover/README.md     handover notes before the Day 15 swap
│   ├── postman_collection.json    every auth and courses request
│   └── postman_environment.json   Postman variables (API address, email, password)
│
├── scripts/
│   └── localDb.js             npm run db:local: one-node local MongoDB replica set (no Atlas needed)
│
├── src/
│   ├── app.js                 builds the Express app: helmet, CORS, JSON limit, cookies, routes, errors
│   ├── server.js              connects to MongoDB, starts the API, shuts down cleanly
│   │
│   ├── config/
│   │   ├── env.js             reads .env once, stops with a clear message if a setting is missing
│   │   ├── db.js              MongoDB connection; warns if it is not a replica set
│   │   └── models.js          loads every model at start-up (add each new model here)
│   │
│   ├── constants/             values used instead of typed strings
│   │   ├── permissions.js     ★ every permission + groups and labels for the Roles screen
│   │   ├── roleTemplates.js   starting roles: Admin, Principal, Exam Clerk, TC Clerk, Accounts, Dept In-charge
│   │   ├── ownerTypes.js      institute / unit: who owns roles and staff
│   │   ├── statuses.js        ★ document statuses (HND-01), student statuses (STU-06), colours
│   │   ├── categories.js      ★ GEN, OBC, SC, ST, EWS
│   │   ├── coursePatterns.js  ★ semester / year, buildExamTerms()
│   │   ├── genders.js         ★ Male, Female, Other
│   │   └── auditActions.js    CREATE, UPDATE, DELETE, ACCESS_DENIED..., INVITE, COMBINE, SEPARATE
│   │                          ★ = must stay identical to the frontend repo's copy
│   │
│   ├── middleware/            the request pipeline
│   │   ├── auth.js            1. who is calling? checks the access token, loads the user
│   │   ├── tenantScope.js     2. which institute? reads X-Institute-Id, checks access, sets req.scope
│   │   ├── requirePermission.js  3. may this role do it? (+ requireSuperAdmin)
│   │   ├── validate.js        4. is the input correct? runs Joi schemas on params, query, body
│   │   ├── error.js           404 for unknown routes + the one error formatter
│   │   ├── rateLimit.js       login: 5 failed attempts per email per 15 minutes
│   │   └── upload.js          multer: images ≤ 2 MB, PDFs ≤ 5 MB, content checked
│   │
│   ├── utils/                 small shared helpers
│   │   ├── ApiError.js        the error class services throw (badRequest, forbidden, notFound...)
│   │   ├── errorCodes.js      every error code the API can send
│   │   ├── response.js        sendSuccess / sendList (the success response format)
│   │   ├── asyncHandler.js    passes errors from async controllers to the error middleware
│   │   ├── scoped.js          scoped(req) = { tenantId, instituteId } for every query
│   │   ├── findScoped.js      findScopedOr404: one record by id, 404 + audit if it is elsewhere
│   │   ├── access.js          finds a user's role and permissions in an institute (direct or via its unit)
│   │   ├── setupLink.js       one-time invite / password links (only a hash is stored)
│   │   ├── tenantGuard.js     Mongoose plugin: blocks queries without tenantId
│   │   ├── actorFields.js     Mongoose plugin: adds createdBy / updatedBy
│   │   ├── validators.js      Joi helpers: objectId, email, mobile, idParams, listQuery
│   │   ├── listQuery.js       paging, sorting and safe search for list services
│   │   ├── audit.js           audit(): writes one audit log entry
│   │   ├── storage.js         save / getStream / remove for uploaded files (private folder)
│   │   ├── transaction.js     withTransaction(): all-or-nothing database writes
│   │   └── counter.js         TC numbering: commented stub, built by Module C
│   │
│   ├── modules/               one folder per feature
│   │   ├── auth/              login, refresh, logout, me (validation, service, controller, routes)
│   │   ├── courses/           ★ EXAMPLE MODULE: model, validation, service, controller, routes, README
│   │   ├── files/             File model + GET /files/:id (serves uploads after all checks)
│   │   ├── audit/             AuditLog model (append-only)
│   │   ├── organisation/      Unit model; combine / separate institutes (Super Admin)
│   │   ├── roles/             Role model + roles API (roles made from permissions)
│   │   ├── users/             User model + users API: list, invite, change role, links, disable
│   │   ├── institutes/        Tenant, Institute, University, Affiliation, Department models (Module A adds routes)
│   │   ├── students/          Student model (Module A adds routes, import, screens)
│   │   ├── results/           README only: RES-01, RES-03 (Module A)
│   │   ├── inward/            README only: INW-01 to INW-07 (Module B)
│   │   ├── documents/         README only: HND-01 to HND-08 custody and hand-over (Module B)
│   │   ├── clearance/         README only: CLR-01 to CLR-05 (Module B)
│   │   └── tc/                README only: TC-01 to TC-08, BR-04, BR-05, BR-13 (Module C)
│   │
│   ├── templates/README.md    where the TC PDF layouts and fonts go (Module C)
│   │
│   └── seed/
│       ├── seed.js            npm run seed: creates or resets the starting data (safe to re-run)
│       ├── seedData.js        tenant, institutes, universities, courses, departments, unit, 2 users
│       └── seedStudents.js    20 made-up sample students
│
└── tests/                     npm test (Jest + Supertest + in-memory MongoDB replica set)
    ├── helpers/
    │   ├── setupEnv.js        test settings, loaded before every test file
    │   ├── db.js              starts and stops a throw-away replica set
    │   └── fixtures.js        test world: tenant, SSISM, SSEC, courses, users; loginAs()
    ├── tenantIsolation.test.js    SSISM-only user gets 403 on SSEC list/read/update/delete
    ├── recordAccessAudit.test.js  other institute's or tenant's record: 404 + ACCESS_DENIED_RECORD
    ├── roles.test.js              TC clerk cannot create a course; validation and 409 duplicates
    ├── tenantGuard.test.js        queries without tenantId throw; audit log cannot be changed
    ├── auth.test.js               login, refresh cookie, logout, rate limit
    ├── files.test.js              files only for their own institute
    ├── studentModel.test.js       student unique rules and tenant guard
    ├── organisation.test.js       Super Admin only; preview, combine, separate; data stays per institute
    ├── usersAndInvites.test.js    invite link, set password, limits on admins, disable
    ├── rolesAdmin.test.js         roles CRUD, cannot grant missing permissions, cannot lock yourself out
    ├── modelsRegistry.test.js     every model is listed in src/config/models.js
    └── sharedConstants.test.js    constants match the frontend repo (when cloned next to it)
```

## Files that are NOT in Git

| Path            | What it is                            | Created by                    |
| --------------- | ------------------------------------- | ----------------------------- |
| `.env`          | your settings and secrets             | you, from `.env.example`      |
| `node_modules/` | installed packages                    | `npm install`                 |
| `uploads/`      | uploaded photos, signatures and scans | the API, when files are saved |
| `.local-db/`    | data of the local MongoDB             | `npm run db:local`            |

## How a request travels

```
Browser (Edu-Record)
   │  Authorization: Bearer <token>   X-Institute-Id: <institute>
   ▼
app.js ─ helmet ─ cors ─ express.json ─ cookieParser ─ morgan
   ▼
modules/<name>/<name>.routes.js
   auth → tenantScope → requirePermission → validate → controller
   ▼
<name>.service.js  ── scoped(req) / findScopedOr404 ── Mongoose model (+ tenantGuard)
   │                └─ audit()  storage  withTransaction()
   ▼
sendSuccess / sendList            or   throw ApiError → middleware/error.js
{ success: true, data, meta? }         { success: false, error: { code, message, details? } }
```
