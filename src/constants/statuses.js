// Shared constants: this file must be IDENTICAL in Edu-Record-BE and Edu-Record (src/constants/).
// A server test fails if the two copies differ, so change both together.

// One document status list for the whole system (SRS HND-01).
// "Received" is an action; the status after receiving is IN_CUSTODY (SRS INW-03).
export const DOCUMENT_STATUSES = Object.freeze({
  EXPECTED: 'Expected',
  NOT_RECEIVED: 'Not received',
  IN_CUSTODY: 'In custody',
  ISSUED: 'Issued',
  RETURNED_TO_UNIVERSITY: 'Returned to university',
  CANCELLED: 'Cancelled',
});

export const DOCUMENT_STATUS_LIST = Object.values(DOCUMENT_STATUSES);

// The values above are already readable words, so they double as their own labels.
// Colours are MUI palette names used by the client's StatusChip.
export const DOCUMENT_STATUS_COLORS = Object.freeze({
  [DOCUMENT_STATUSES.EXPECTED]: 'default',
  [DOCUMENT_STATUSES.NOT_RECEIVED]: 'error',
  [DOCUMENT_STATUSES.IN_CUSTODY]: 'info',
  [DOCUMENT_STATUSES.ISSUED]: 'success',
  [DOCUMENT_STATUSES.RETURNED_TO_UNIVERSITY]: 'warning',
  [DOCUMENT_STATUSES.CANCELLED]: 'secondary',
});

// Student status (SRS STU-06). TC issue sets TC_ISSUED automatically.
export const STUDENT_STATUSES = Object.freeze({
  STUDYING: 'Studying',
  PASSED_OUT: 'Passed out',
  LEFT: 'Left',
  TC_ISSUED: 'TC issued',
});

export const STUDENT_STATUS_LIST = Object.values(STUDENT_STATUSES);

// User account status. An invited user has no password until they open the invite link.
export const USER_STATUSES = Object.freeze({
  INVITED: 'Invited',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
});

export const USER_STATUS_LIST = Object.values(USER_STATUSES);

export const USER_STATUS_COLORS = Object.freeze({
  [USER_STATUSES.INVITED]: 'warning',
  [USER_STATUSES.ACTIVE]: 'success',
  [USER_STATUSES.DISABLED]: 'default',
});
