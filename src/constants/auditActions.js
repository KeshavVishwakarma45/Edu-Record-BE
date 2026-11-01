// Actions written to the audit log (SRS BR-14). Add APPROVE, PRINT, HANDOVER when those modules exist.
export const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ACCESS_DENIED: 'ACCESS_DENIED', // the user has no access to the requested institute
  ACCESS_DENIED_RECORD: 'ACCESS_DENIED_RECORD', // the record id belongs to another institute or tenant
});
