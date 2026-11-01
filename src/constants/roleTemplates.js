import { PERMISSIONS as P, PERMISSION_LIST } from './permissions.js';

// The starting roles for a new institute or unit, taken from the SRS role table.
// Admins change them on the Roles screen; nothing in the code depends on these names.
export const ROLE_TEMPLATES = Object.freeze([
  {
    name: 'Admin',
    description: 'Runs the institute(s): every permission, including users and roles',
    permissions: PERMISSION_LIST,
  },
  {
    name: 'Principal',
    description: 'Approves TCs; views everything',
    permissions: [
      P.SETUP_VIEW,
      P.AUDIT_VIEW,
      P.COURSE_READ,
      P.COURSE_WRITE,
      P.STUDENT_READ,
      P.INWARD_READ,
      P.CLEARANCE_VIEW,
      P.TC_READ,
      P.TC_APPROVE,
      P.REPORT_VIEW,
    ],
  },
  {
    name: 'Exam Clerk',
    description: 'Inward batches, results, custody and hand-over',
    permissions: [
      P.COURSE_READ,
      P.STUDENT_READ,
      P.STUDENT_WRITE,
      P.STUDENT_IMPORT,
      P.INWARD_READ,
      P.INWARD_MANAGE,
      P.HANDOVER_ISSUE,
    ],
  },
  {
    name: 'TC Clerk',
    description: 'TC applications, drafts and issue',
    permissions: [
      P.COURSE_READ,
      P.STUDENT_READ,
      P.CLEARANCE_VIEW,
      P.TC_APPLY,
      P.TC_READ,
      P.TC_DRAFT,
      P.TC_ISSUE,
      P.HANDOVER_ISSUE,
    ],
  },
  {
    name: 'Accounts',
    description: 'Fees clearance',
    permissions: [P.COURSE_READ, P.STUDENT_READ, P.CLEARANCE_VIEW, P.CLEARANCE_ACT],
  },
  {
    name: 'Department In-charge',
    description: 'Own department clearance queue only',
    permissions: [P.STUDENT_READ, P.CLEARANCE_VIEW, P.CLEARANCE_ACT],
  },
]);
