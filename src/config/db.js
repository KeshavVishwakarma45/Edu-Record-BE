import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri = env.MONGODB_URI) {
  await mongoose.connect(uri);

  // TC numbering and hand-over need transactions, which only work on a replica set (NFR-15).
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    console.warn('Warning: MongoDB is not a replica set, so transactions will fail.');
  }
  console.info(`MongoDB connected: ${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
