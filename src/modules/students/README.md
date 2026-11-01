# students: student master (Module A)

**Owner:** Module A (S1 backend, S3 frontend in Phase 1). Copy `modules/courses`.

**Already in the skeleton:** `student.model.js` (all STU-01 fields, the indexes below, tenantGuard,
registered in `config/models.js`) and 20 sample students from `npm run seed`
(`seed/seedStudents.js`). **Module A builds:** `student.validation.js`, `student.service.js`,
`student.controller.js`, `student.routes.js`, the Excel import and all screens.

| SRS ID | Requirement                                                                                                                                                                                                | Phase |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| STU-01 | Store scholar no., enrollment no., roll no., name, father, mother, DOB, gender, category (GEN, OBC, SC, ST, EWS), religion, address, mobile, admission date, course, branch, batch, previous school, photo | P1    |
| STU-02 | Optional: Aadhaar (last 4 digits only), SSSM ID, Family ID, APAAR/ABC ID, bank details                                                                                                                     | P2    |
| STU-03 | Scholar no. unique per institute; enrollment no. unique per university                                                                                                                                     | P1    |
| STU-04 | Bulk import from an Excel template with a row-level error report; nothing saved from a row with errors                                                                                                     | P1    |
| STU-05 | Warn on likely duplicates (same name + father + DOB)                                                                                                                                                       | P2    |
| STU-06 | Status: Studying, Passed out, Left, TC issued; set automatically by TC issue                                                                                                                               | P1    |
| STU-07 | Search by name, father, scholar no., enrollment no., roll no. or mobile, across all institutes the user can access                                                                                         | P1    |

Notes:

- Categories, genders and student statuses come from `constants/categories.js`, `constants/genders.js`
  and `constants/statuses.js` (`STUDENT_STATUSES`). Dates are calendar dates (`YYYY-MM-DD` from the client).
- STU-07 is the one place that searches several institutes: filter with `instituteId: { $in: <institutes in req.user.access> }` and still include `tenantId`.
- Indexes: `(tenantId, instituteId, scholarNo)` unique; `(tenantId, universityId, enrollmentNo)` unique where
  present (store `null`, never `''`, when there is no enrollment number); one search index each on
  name, fatherName, mobile and rollNo, inside the institute.
- Load one student with `findScopedOr404(req, Student, id, 'student')`.
