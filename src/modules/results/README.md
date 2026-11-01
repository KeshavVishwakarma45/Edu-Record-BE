# results: exam results (Module A)

**Owner:** Module A, Phase 2 (after the Day 15 swap). Empty until built. Copy `modules/courses`.

| SRS ID | Requirement                                                                                                                    | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ----- |
| RES-01 | Record per student per exam: Pass, ATKT (with subjects), Fail, Absent, Withheld, Result awaited; division or CGPA; result date | P1    |
| RES-03 | Course-wise summary per exam: total, pass, ATKT, fail (replaces the paper result register)                                     | P1    |

Index: `(tenantId, instituteId, studentId, examTerm, session)` unique. The summary is an aggregation that starts with `{ $match: { tenantId, instituteId, ... } }`.
