// Where roles and staff live (ADR-016): a separate institute has its own,
// institutes combined into a unit share the unit's.
export const OWNER_TYPES = Object.freeze({
  INSTITUTE: 'institute',
  UNIT: 'unit',
});

export const OWNER_TYPE_LIST = Object.values(OWNER_TYPES);
