# users

The `User` model: name, mobile (login id, unique), passwordHash (never returned), isActive,
signatureImage, `access[] = { instituteId, role, departmentId }`, tokenVersion (raised on logout).

No routes yet. Users are created by `npm run seed`. A user-management screen for SocietyAdmin is
not in P1. Changes to users or login need the project owner review.
