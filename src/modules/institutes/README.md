# institutes: organisation setup (Module A)

**Owner:** Module A (S1 backend, S3 frontend in Phase 1). Builds the Setup screens (SRS screen 3).

The **models already exist** here (built in the skeleton, used by login and courses):
`tenant.model.js`, `institute.model.js`, `university.model.js`, `affiliation.model.js`, `department.model.js`.
Add validation, service, controller and routes for each, copying `modules/courses`.

| SRS ID | Requirement                                                                                                                                            | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| ORG-02 | SocietyAdmin adds institutes: name, short code, address, website (optional), logo, seal image, principal name and signature image                      | P1    |
| ORG-03 | Shared university/board master: name, short code, enrollment-number label                                                                              | P1    |
| ORG-04 | An institute has one or more affiliations with from/to years; each course links to one affiliation                                                     | P1    |
| ORG-05 | Courses: name, short code, branch, pattern, duration, exam terms (already built as the example module)                                                 | P1    |
| ORG-06 | Each institute defines its clearance departments, their order and whether each is mandatory                                                            | P1    |
| ORG-08 | Each institute defines its TC number series with a starting number and yearly-restart setting (the series model belongs to Module C, see `modules/tc`) | P1    |

Notes:

- `universities` and `tenants` have no `tenantId` (shared master / the tenant itself). Only SUPER_ADMIN may change universities.
- Images (logo, seal, signature) are uploaded with `middleware/upload.js` and saved with `utils/storage.js`; store the returned File id.
