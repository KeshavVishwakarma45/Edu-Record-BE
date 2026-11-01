# tc: TC engine (Module C)

**Owner:** Module C (S5). Empty until built. Copy `modules/courses`. Changes here need the project owner review.

| SRS ID | Requirement                                                                                                         | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ----- |
| TC-01  | Generate TC is enabled only when every mandatory clearance is Clear                                                 | P1    |
| TC-02  | Fields auto-fill from student master, latest result and clearance                                                   | P1    |
| TC-03  | Clerk previews and chooses reason for leaving and conduct; other fields read-only                                   | P1    |
| TC-04  | Ref no. and book serial assigned atomically, no gaps or repeats                                                     | P1    |
| TC-05  | PDF in the institute layout (pink SSISM, white SSEC), TC and Character Certificate on one page                      | P1    |
| TC-06  | Principal approves before printing; approved TC is locked                                                           | P1    |
| TC-07  | Issue uses the hand-over flow (photo, signature)                                                                    | P1    |
| TC-08  | Issuing sets student status TC issued and records Ref no., serial and date on the student                           | P1    |
| BR-04  | Two numbers: Ref no. INSTITUTE/TC/YEAR/COURSE/N and an institute-wide book serial; SSEC never uses the SSISM prefix | P1    |
| BR-05  | Numbers are never reused or skipped; a cancelled TC keeps its numbers                                               | P1    |
| BR-13  | The TC prints the snapshot taken at approval, never live student data                                               | P1    |

Notes:

- The numbering service goes in `utils/counter.js` (read the comment there first). Numbers are taken at approval inside `withTransaction()`.
- The Ref no. series is keyed on the course **short code**, not the course id:
  `(tenantId, instituteId, 'ref', courseShortCode, year if restarting)`. B.Sc Bio and B.Sc Micro both
  print "B.Sc", so they share one series and can never print the same Ref no.
- Starting numbers (BR-04a, MIG-07): SSISM book is at Ref .../B.Com/495, serial 1304; SSEC at serial 52.
- Templates go in `src/templates/` (see the README there). Enrollment label comes from the course university (BR-12).
- Required tests: a clerk cannot approve a TC; 20 parallel approvals get consecutive numbers (AC-13).
