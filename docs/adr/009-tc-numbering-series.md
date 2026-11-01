# ADR-009: TC numbering at approval, with the Ref no. series keyed on course short code

- Status: Accepted
- Date: 2026-11-01

## Context

Each TC carries two numbers (BR-04): a Ref no. `INSTITUTE/TC/YEAR/SHORTCODE/N` and an
institute-wide book serial. Numbers must never repeat or skip (BR-05, AC-13), and must continue
from the paper books (BR-04a). B.Sc Bio and B.Sc Micro are two courses with the same short code
"B.Sc", and the Ref no. prints only the short code.

## Decision

- Numbers are taken at **Principal approval**, never at draft.
- Series live in a `tcSeries` collection:
  - Ref no.: key `(tenantId, instituteId, kind 'ref', courseShortCode, year if restarting)`.
  - Book serial: key `(tenantId, instituteId, kind 'serial', year if restarting)`.
- The Ref series is keyed on the **short code, not the course id**, so B.Sc Bio and B.Sc Micro
  share one series and can never print the same Ref no.
- The next number is taken with one `findOneAndUpdate` + `$inc` inside `withTransaction()`,
  together with saving the TC, its snapshot and the audit entry.
- Built by Module C in `src/utils/counter.js`; the skeleton holds only a commented stub.

## Consequences

- Good: concurrency-safe and gap-free; a Jest test approves 20 TCs in parallel.
- Bad: renaming a course short code would start a new series; changing a short code after TCs are
  issued needs the project owner's approval.
- Open: whether series restart yearly depends on the Society's answer to Q1 (default: continuous).
