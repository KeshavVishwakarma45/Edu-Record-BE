# organisation (Super Admin only, ADR-016)

How the institutes are organised. An institute is **separate** (its own roles, admin and staff) or
a member of a **unit** (the unit's shared roles and staff). Records never move between institutes.

| File                         | What it is for                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `unit.model.js`              | A unit: name and its institute ids. `institutes.unitId` points back to it                                                             |
| `organisation.validation.js` | Combine body; new institute (`roleTemplates`); edit (`roleIds`: for an institute in a unit, the unit roles it uses)                   |
| `organisation.service.js`    | Overview, preview, combine and separate (both in one transaction, both audited)                                                       |
| `organisation.controller.js` | Thin glue                                                                                                                             |
| `organisation.routes.js`     | `auth → requireSuperAdmin → organisationScope → validate → controller`: works with any institute selected, including "All institutes" |

| Endpoint                                           | What                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/organisation`                         | Institutes (with university) and units, with role and user counts                                                |
| `GET /api/v1/organisation/universities`            | University choices for the Add institute form                                                                    |
| `POST /api/v1/organisation/institutes`             | Add an institute: separate (own default roles) or straight into a unit; with affiliation and default departments |
| `PATCH /api/v1/organisation/institutes/:id`        | Edit name, address, website, principal (the short code never changes)                                            |
| `POST /api/v1/organisation/units/preview`          | What combining would do to each user (changes nothing)                                                           |
| `POST /api/v1/organisation/units`                  | Combine: `{ name, instituteIds, keepRolesFrom: instituteId \| 'template' }`                                      |
| `PATCH /api/v1/organisation/units/:id`             | Rename a unit                                                                                                    |
| `POST /api/v1/organisation/units/:id/join/preview` | What adding one separate institute to the unit would do                                                          |
| `POST /api/v1/organisation/units/:id/join`         | Add one separate institute to the unit (its staff get same-name unit roles)                                      |
| `POST /api/v1/organisation/units/:id/remove`       | Take one institute out (unit separated if only one would remain)                                                 |
| `POST /api/v1/organisation/units/:id/separate`     | Separate all: each institute gets a copy of the roles; users keep access                                         |

Institutes are never deleted here: their students and TCs are legal records.

**Combine:** the chosen institute's roles (or the default templates) become the unit's roles. Each
user's role is matched by name; a user with no matching role loses access (the preview shows this
in red). **Separate:** every institute gets its own copy of the unit's roles, and each unit access
becomes one access per institute (departments split by institute).
