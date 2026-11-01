# ADR-010: MongoDB replica set everywhere, one database per developer

- Status: Accepted
- Date: 2026-11-01

## Context

TC numbering and hand-over need multi-document transactions (NFR-15), which MongoDB only supports
on a replica set. Five interns and the faculty share one Atlas dev cluster, and `npm run seed`
resets the seed data.

## Decision

- Atlas (Mumbai region) replica set for development and pilot; the pilot uses a separate cluster.
- Each person uses their own database on the shared cluster: `edurecords_s1` … `edurecords_s5`,
  `edurecords_faculty` (only the name at the end of `MONGODB_URI` changes).
- Without Atlas, `npm run db:local` starts a one-node local replica set (`.local-db/`).
- Tests use `MongoMemoryReplSet`, a throw-away replica set per test file.

## Consequences

- Good: one person's seed, test data or schema change never breaks another person's work.
- Bad: data is not shared between developers; demos run from the faculty database.
