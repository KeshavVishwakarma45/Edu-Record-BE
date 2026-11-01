// Shared constants: this file must be IDENTICAL in Edu-Record-BE and Edu-Record (src/constants/).
// A server test fails if the two copies differ, so change both together.

export const GENDERS = Object.freeze({
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
});

export const GENDER_LIST = Object.values(GENDERS);
