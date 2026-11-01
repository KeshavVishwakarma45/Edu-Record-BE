// Shared constants: this file must be IDENTICAL in Edu-Record-BE and Edu-Record (src/constants/).
// A server test fails if the two copies differ, so change both together.

// Student category printed on the TC (SRS STU-01). The list is meant to be configurable later.
export const CATEGORIES = Object.freeze({
  GEN: 'GEN',
  OBC: 'OBC',
  SC: 'SC',
  ST: 'ST',
  EWS: 'EWS',
});

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const CATEGORY_LABELS = Object.freeze({
  GEN: 'General',
  OBC: 'Other Backward Classes',
  SC: 'Scheduled Castes',
  ST: 'Scheduled Tribes',
  EWS: 'Economically Weaker Sections',
});
