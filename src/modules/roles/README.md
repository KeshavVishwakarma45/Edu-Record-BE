# roles (ADR-016)

A role is a name plus a list of permissions (`constants/permissions.js`). Roles belong to the
owner of the selected institute: the institute itself, or its unit when institutes are combined.
The code checks permissions only, so roles can be renamed or added without code changes.

| Endpoint                      | Permission     | What                                                                           |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `GET /api/v1/roles`           | `roles.manage` | List with `userCount`. Query: `page`, `limit`, `sort`, `search`                |
| `GET /api/v1/roles/templates` | `roles.manage` | The built-in roles (`constants/roleTemplates.js`), offered as a starting point |
| `POST /api/v1/roles`          | `roles.manage` | `{ name, description?, permissions[] }`                                        |
| `PATCH /api/v1/roles/:id`     | `roles.manage` | Change any field                                                               |
| `DELETE /api/v1/roles/:id`    | `roles.manage` | Only when no user has the role (409 otherwise)                                 |

Rules: an admin can only give permissions they have themselves; an admin cannot remove "manage
users" or "manage roles" from their own role. The starting roles are in `constants/roleTemplates.js`.

In the Super Admin's "All institutes" view (`X-Institute-Id: all`) the list shows the roles of every
institute and unit; each row has `ownerName` and `ownerInstituteId`. Changes are sent with
`X-Institute-Id: <ownerInstituteId>`, so they go to the role's own institute or unit.

**Unit roles used in some institutes only.** `instituteIds` on a unit role lists the member
institutes that use it (empty or missing = all). Send it on create / update (`instituteIds: [...]`);
all members is stored as `[]`, so an institute added to the unit later gets the role too. Rows carry
`usedIn` (short codes). In "All institutes", `?instituteId=` lists the roles that institute uses.
