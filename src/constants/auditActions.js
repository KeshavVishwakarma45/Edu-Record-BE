// Actions written to the audit log (SRS BR-14). Add APPROVE, PRINT, HANDOVER when those modules exist.
// For changes not covered by CREATE / UPDATE / DELETE, the action says what happened.
export const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ACCESS_DENIED: 'ACCESS_DENIED', // the user has no access to the requested institute
  ACCESS_DENIED_RECORD: 'ACCESS_DENIED_RECORD', // the record id belongs to another institute or tenant
  INVITE: 'INVITE', // a user was invited (or given access to another institute / unit)
  SETUP_LINK: 'SETUP_LINK', // a new invite / password link was made
  DISABLE: 'DISABLE',
  ENABLE: 'ENABLE',
  COMBINE: 'COMBINE', // institutes combined into a unit
  SEPARATE: 'SEPARATE', // a unit split back into separate institutes
});
