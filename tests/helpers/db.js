import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Each test file gets its own throw-away MongoDB replica set (transactions need a replica set).
let replSet;

export async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  // Build unique indexes now, so duplicate checks work from the first test
  for (const model of Object.values(mongoose.models)) await model.init();
}

export async function stopDb() {
  await mongoose.disconnect();
  await replSet?.stop();
}
