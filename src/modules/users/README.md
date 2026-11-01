# users (ADR-016, ADR-017)

The `User` model: name, **email** (login id, unique, lower case), mobile (contact only),
passwordHash (never returned), status (Invited / Active / Disabled), `isSuperAdmin`,
`access[] = { ownerType: 'institute' | 'unit', ownerId, roleId, departmentIds[] }`,
a hashed one-time setup token (invites and password resets), tokenVersion (raised on logout).

All routes manage the staff of the owner of the selected institute (the institute, or its unit).

| Endpoint                                    | Permission       | What                                                                |
| ------------------------------------------- | ---------------- | ------------------------------------------------------------------- |
| `GET /api/v1/users`                         | `users.manage`   | Staff list; with `X-Institute-Id: all` (Super Admin) lists everyone |
| `GET /api/v1/users/options`                 | `users.manage`   | Roles and departments for the forms                                 |
| `POST /api/v1/users/invite`                 | `users.manage`   | `{ name, email, mobile?, roleId, departmentIds? }` → `inviteLink`   |
| `PATCH /api/v1/users/:id/access`            | `users.manage`   | Change role / departments here                                      |
| `DELETE /api/v1/users/:id/access`           | `users.manage`   | Remove access here (the account stays)                              |
| `POST /api/v1/users/:id/setup-link`         | `users.manage`   | New invite link (invited) or password-reset link (active)           |
| `POST /api/v1/users/:id/disable`, `/enable` | Super Admin only | Block / unblock the account everywhere                              |

The invited person opens the link (`/set-password/:token` in the app), which calls
`GET` / `POST /api/v1/auth/setup/:token`. Links work once and expire after 7 days; only a hash is
stored. Nobody can change their own access or a Super Admin's (unless they are the Super Admin).
