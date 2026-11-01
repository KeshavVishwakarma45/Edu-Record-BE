// Shared constants: this file must be IDENTICAL in Edu-Record-BE and Edu-Record (src/constants/).
// A server test fails if the two copies differ, so change both together.

export const ROLES = Object.freeze({
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SOCIETY_ADMIN: 'SOCIETY_ADMIN',
  PRINCIPAL: 'PRINCIPAL',
  EXAM_CLERK: 'EXAM_CLERK',
  TC_CLERK: 'TC_CLERK',
  ACCOUNTS: 'ACCOUNTS',
  DEPT_INCHARGE: 'DEPT_INCHARGE',
});

export const ALL_ROLES = Object.values(ROLES);

// Everyone who works inside an institute. PLATFORM_ADMIN manages tenants, not institute data.
export const STAFF_ROLES = ALL_ROLES.filter((role) => role !== ROLES.PLATFORM_ADMIN);

// Who may add, edit or delete courses
export const COURSE_WRITE_ROLES = [ROLES.SOCIETY_ADMIN, ROLES.PRINCIPAL];

// Readable names for screens
export const ROLE_LABELS = Object.freeze({
  PLATFORM_ADMIN: 'Platform Admin',
  SOCIETY_ADMIN: 'Society Admin',
  PRINCIPAL: 'Principal',
  EXAM_CLERK: 'Exam Clerk',
  TC_CLERK: 'TC Clerk',
  ACCOUNTS: 'Accounts',
  DEPT_INCHARGE: 'Department In-charge',
});
