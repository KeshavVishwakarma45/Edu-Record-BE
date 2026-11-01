// Starts a local one-node MongoDB replica set for development when Atlas is not available.
// Data is kept in .local-db between runs. Stop with Ctrl+C.
//   npm run db:local
//   MONGODB_URI=mongodb://127.0.0.1:27017/edurecords?replicaSet=rs0
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const PORT = 27017;
const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local-db');
fs.mkdirSync(dbPath, { recursive: true });

const replSet = await MongoMemoryReplSet.create({
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: PORT, dbPath, storageEngine: 'wiredTiger' }],
});

console.info(`Local MongoDB replica set running on port ${PORT}`);
console.info(`Use: MONGODB_URI=mongodb://127.0.0.1:${PORT}/edurecords?replicaSet=rs0`);

async function stop() {
  await replSet.stop({ doCleanup: false });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
