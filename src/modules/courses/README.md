# courses: the EXAMPLE module

Every new backend module copies this folder. Same five files, same order of work:
**model → validation → service → controller → routes**, then one line in `src/app.js`.

| File                   | What it is for                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `course.model.js`      | The shape of a course in MongoDB. Starts with `tenantId` and `instituteId`, lists the indexes (tenant fields first) and adds the `tenantGuard` and `actorFields` plugins. Register new models in `src/config/models.js`. |
| `course.validation.js` | Joi rules for the body, query and URL params of each route. The `validate` middleware runs them before the controller, so bad input never reaches the service. Keep the rules the same as the React form.                |
| `course.service.js`    | All business rules. Every query starts from `scoped(req)` so only the selected institute's data is touched. Throws `ApiError` for problems and calls `audit()` after every create, update and delete.                    |
| `course.controller.js` | Thin glue: reads `req`, calls one service function, sends the answer with `sendSuccess` / `sendList`. No `if` about business rules here.                                                                                 |
| `course.routes.js`     | The URLs. Every route runs the same chain: `auth → tenantScope → requireRole(...) → validate(...) → controller`. Read routes allow `STAFF_ROLES`, write routes allow `COURSE_WRITE_ROLES`.                               |

## Endpoints

All need `Authorization: Bearer <token>` and `X-Institute-Id: <institute id>`.

| Method and URL                | Who                      | What                                                                    |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `GET /api/v1/courses`         | all staff                | List. Query: `page`, `limit` (max 100), `sort` (e.g. `-name`), `search` |
| `GET /api/v1/courses/options` | Society Admin, Principal | Affiliation choices for the course form                                 |
| `GET /api/v1/courses/:id`     | all staff                | One course                                                              |
| `POST /api/v1/courses`        | Society Admin, Principal | Create. `examTerms` is built from pattern + duration if left out        |
| `PATCH /api/v1/courses/:id`   | Society Admin, Principal | Update any fields                                                       |
| `DELETE /api/v1/courses/:id`  | Society Admin, Principal | Delete                                                                  |

A course of another institute or tenant answers **404**, never 403: we do not even confirm it exists.
`findScopedOr404` (utils/findScoped.js) still writes the attempt to the audit log as `ACCESS_DENIED_RECORD`.
