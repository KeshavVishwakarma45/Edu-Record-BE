// Runs before each test file loads, so config/env.js finds every setting it needs.
// The real database URI is set later by startDb(); this placeholder only satisfies the check.
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGODB_URI = 'mongodb://placeholder';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'edurecords-test-uploads');
