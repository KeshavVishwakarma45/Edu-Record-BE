# ADR-012: Only the Student model is part of the skeleton

- Status: Accepted
- Date: 2026-11-01

## Context

Students are Module A's work, but the TC engine, inward and clearance all reference students,
and every intern needs sample data from Day 1.

## Decision

- The skeleton includes `src/modules/students/student.model.js`: all STU-01 fields, unique
  `(tenantId, instituteId, scholarNo)`, unique `(tenantId, universityId, enrollmentNo)` when an
  enrollment number exists, and search indexes on name, father's name, mobile and roll no.
- The seed creates 20 made-up students (12 SSISM across five courses, 8 SSEC B.Tech AI & ML).
- Student validation, service, controller, routes, Excel import and screens are built by Module A.

## Consequences

- Good: every module can link to real student records from the start.
- Bad: Module A must keep the model's field names, or agree changes with the other modules.
