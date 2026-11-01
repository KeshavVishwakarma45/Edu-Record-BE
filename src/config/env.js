// Reads settings from .env once, checks them, and exports them.
// Other files import `env` from here instead of reading process.env directly,
// so a missing setting fails at start-up instead of halfway through a request.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const REQUIRED = [
  'PORT',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_URL',
  'UPLOAD_DIR',
  'NODE_ENV',
];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `\nMissing settings in .env: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in every value.\n',
  );
  process.exit(1);
}

// The example secrets are public (they are in .env.example), so they must never reach the pilot server
const isPlaceholder = (secret) => secret.startsWith('change-me');
if (
  process.env.NODE_ENV === 'production' &&
  (isPlaceholder(process.env.JWT_ACCESS_SECRET) || isPlaceholder(process.env.JWT_REFRESH_SECRET))
) {
  console.error('\nSet real JWT_ACCESS_SECRET and JWT_REFRESH_SECRET values in .env.\n');
  process.exit(1);
}

export const env = {
  PORT: Number(process.env.PORT),
  NODE_ENV: process.env.NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  // Relative paths are resolved from the server folder, not from wherever npm was started
  UPLOAD_DIR: path.resolve(serverRoot, process.env.UPLOAD_DIR),
  SEED_PASSWORD: process.env.SEED_PASSWORD,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
