# ADR-014: Calendar dates as YYYY-MM-DD, shown in IST as dd/mm/yyyy

- Status: Accepted
- Date: 2026-11-01

## Context

Dates of birth and admission dates are calendar dates. Converting a local midnight in India to UTC
moves the date one day back.

## Decision

- The client sends calendar dates as `'YYYY-MM-DD'` strings (`FormDateField` does this).
- The server stores them as midnight UTC.
- Every date is displayed in IST as dd/mm/yyyy with `formatDate` (`src/utils/format.js`).

## Consequences

- Good: a date of birth never shifts by a day.
- Bad: date-time fields (e.g. hand-over time) must use real timestamps, not this format.
