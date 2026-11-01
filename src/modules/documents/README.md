# documents: custody and hand-over (Module B)

**Owner:** Module B, Phase 2 (hand-over). Empty until built. Copy `modules/courses`.

| SRS ID | Requirement                                                                                                                       | Phase |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| HND-01 | One document status list: Expected, Not received, In custody, Issued, Returned to university, Cancelled (`constants/statuses.js`) | P1    |
| HND-02 | Hand-over records date, time, issuing staff, receiver type (Self / Authorised person), name, relation, mobile                     | P1    |
| HND-03 | Receiver photo from webcam or phone camera; photo is mandatory                                                                    | P1    |
| HND-04 | Signature on screen or upload of a signed receipt scan                                                                            | P1    |
| HND-05 | Generated Hindi affidavit for an authorised person, approved by the Principal (until P2 only Self hand-over)                      | P2    |
| HND-06 | Several documents handed over in one transaction                                                                                  | P1    |
| HND-07 | Hand-over receipt PDF                                                                                                             | P2    |
| HND-08 | Return to university, creating a new Expected item                                                                                | P2    |

Notes:

- One hand-over = one `withTransaction()` (utils/transaction.js): insert the hand-over, set every document to Issued, audit, all or nothing.
- Hand-overs are never edited or deleted after saving (BR-06). No photo, no Issued status (BR-11).
- Photos and signatures: `uploadImage()` from middleware/upload.js, then `save()` from utils/storage.js.
