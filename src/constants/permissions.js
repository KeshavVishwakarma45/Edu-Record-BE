// Shared constants: this file must be IDENTICAL in Edu-Record-BE and Edu-Record (src/constants/).
// A server test fails if the two copies differ, so change both together.

// Everything a user may do. Roles are made by admins from these permissions (ADR-016), and the
// code only ever checks permissions, never role names. A module adds its permissions here.
export const PERMISSIONS = Object.freeze({
  SETUP_VIEW: 'setup.view',
  SETUP_MANAGE: 'setup.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  AUDIT_VIEW: 'audit.view',
  COURSE_READ: 'course.read',
  COURSE_WRITE: 'course.write',
  STUDENT_READ: 'student.read',
  STUDENT_WRITE: 'student.write',
  STUDENT_IMPORT: 'student.import',
  INWARD_READ: 'inward.read',
  INWARD_MANAGE: 'inward.manage',
  HANDOVER_ISSUE: 'handover.issue',
  CLEARANCE_VIEW: 'clearance.view',
  CLEARANCE_ACT: 'clearance.act',
  TC_APPLY: 'tc.apply',
  TC_READ: 'tc.read',
  TC_DRAFT: 'tc.draft',
  TC_APPROVE: 'tc.approve',
  TC_ISSUE: 'tc.issue',
  REPORT_VIEW: 'report.view',
});

export const PERMISSION_LIST = Object.values(PERMISSIONS);

// How the permissions are grouped and named on the Roles screen
export const PERMISSION_GROUPS = Object.freeze([
  {
    label: 'Administration',
    permissions: [
      { value: PERMISSIONS.USERS_MANAGE, label: 'Manage users and invites' },
      { value: PERMISSIONS.ROLES_MANAGE, label: 'Manage roles and permissions' },
      { value: PERMISSIONS.AUDIT_VIEW, label: 'View audit log' },
    ],
  },
  {
    label: 'Setup',
    permissions: [
      { value: PERMISSIONS.SETUP_VIEW, label: 'View setup' },
      {
        value: PERMISSIONS.SETUP_MANAGE,
        label: 'Change setup (institutes, departments, TC series)',
      },
    ],
  },
  {
    label: 'Courses',
    permissions: [
      { value: PERMISSIONS.COURSE_READ, label: 'View courses' },
      { value: PERMISSIONS.COURSE_WRITE, label: 'Add, edit and delete courses' },
    ],
  },
  {
    label: 'Students',
    permissions: [
      { value: PERMISSIONS.STUDENT_READ, label: 'View students' },
      { value: PERMISSIONS.STUDENT_WRITE, label: 'Add and edit students' },
      { value: PERMISSIONS.STUDENT_IMPORT, label: 'Import students from Excel' },
    ],
  },
  {
    label: 'Inward and hand-over',
    permissions: [
      { value: PERMISSIONS.INWARD_READ, label: 'View inward batches' },
      { value: PERMISSIONS.INWARD_MANAGE, label: 'Receive documents' },
      { value: PERMISSIONS.HANDOVER_ISSUE, label: 'Hand over documents' },
    ],
  },
  {
    label: 'Clearance',
    permissions: [
      { value: PERMISSIONS.CLEARANCE_VIEW, label: 'View clearance' },
      { value: PERMISSIONS.CLEARANCE_ACT, label: 'Mark clearance (own departments)' },
      { value: PERMISSIONS.TC_APPLY, label: 'Enter TC applications' },
    ],
  },
  {
    label: 'Transfer Certificates',
    permissions: [
      { value: PERMISSIONS.TC_READ, label: 'View TCs' },
      { value: PERMISSIONS.TC_DRAFT, label: 'Prepare TC drafts' },
      { value: PERMISSIONS.TC_APPROVE, label: 'Approve TCs (Principal)' },
      { value: PERMISSIONS.TC_ISSUE, label: 'Issue TCs' },
    ],
  },
  {
    label: 'Reports',
    permissions: [{ value: PERMISSIONS.REPORT_VIEW, label: 'View reports' }],
  },
]);
