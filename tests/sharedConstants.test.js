// Roles, statuses, categories, course patterns and genders must be the same in this repo and the
// frontend repo (Edu-Record). The check runs when the frontend is cloned next to this repo
// (../edu-frontend), or when FRONTEND_DIR points at it; otherwise it is skipped with a note.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = process.env.FRONTEND_DIR
  ? path.resolve(process.env.FRONTEND_DIR)
  : path.resolve(backendRoot, '../edu-frontend');
const frontendFound = fs.existsSync(path.join(frontendRoot, 'src/constants'));
const SHARED = [
  'permissions.js',
  'statuses.js',
  'categories.js',
  'coursePatterns.js',
  'genders.js',
  'ownerTypes.js',
];

if (!frontendFound) {
  console.warn(`Skipping shared-constants check: no frontend repo at ${frontendRoot}`);
}

(frontendFound ? test.each(SHARED) : test.skip.each(SHARED))(
  'src/constants/%s is identical in backend and frontend',
  (file) => {
    const backend = fs.readFileSync(path.join(backendRoot, 'src/constants', file), 'utf8');
    const frontend = fs.readFileSync(path.join(frontendRoot, 'src/constants', file), 'utf8');
    expect(frontend).toBe(backend);
  },
);
