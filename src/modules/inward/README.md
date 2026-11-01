# inward: university document inward (Module B)

**Owner:** Module B (S2 backend, S4 frontend in Phase 1). Empty until built. Copy `modules/courses`.

| SRS ID | Requirement                                                                                                                                              | Phase |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| INW-01 | Create an inward batch: university, institute, course, exam term, session, document type, received date, received by, reference, scanned covering letter | P1    |
| INW-02 | On creating the batch, list all expected students with status Expected                                                                                   | P1    |
| INW-03 | Mark each document received (tick or roll-no. entry), with serial no.; status becomes In custody                                                         | P1    |
| INW-04 | Live counts: expected, received, missing                                                                                                                 | P1    |
| INW-05 | Missing documents get a reason from a list and a follow-up date; status becomes Not received                                                             | P1    |
| INW-06 | Missing documents stay on a Pending list until received; a later batch can close them                                                                    | P1    |
| INW-07 | Each received document stores its location (almirah, file no.); custody date set automatically                                                           | P1    |

Use `DOCUMENT_STATUSES` from `constants/statuses.js`; never type the words. Acceptance: AC-01, AC-02. "Mark received" is an action route: `POST /api/v1/documents/:id/receive`.
