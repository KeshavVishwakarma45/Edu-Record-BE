// Shared constants: this file must be IDENTICAL in Edu-Record-BE and Edu-Record (src/constants/).
// A server test fails if the two copies differ, so change both together.

// A course runs either by semester (Sem I-VIII) or by year (Year I-III) (SRS ORG-05).
export const COURSE_PATTERNS = Object.freeze({
  SEMESTER: 'semester',
  YEAR: 'year',
});

export const COURSE_PATTERN_LIST = Object.values(COURSE_PATTERNS);

export const COURSE_PATTERN_LABELS = Object.freeze({
  semester: 'Semester',
  year: 'Year',
});

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// buildExamTerms('year', 3) -> ['Year I', 'Year II', 'Year III']
export function buildExamTerms(pattern, duration) {
  const prefix = pattern === COURSE_PATTERNS.SEMESTER ? 'Sem' : 'Year';
  return ROMAN.slice(0, duration).map((numeral) => `${prefix} ${numeral}`);
}
