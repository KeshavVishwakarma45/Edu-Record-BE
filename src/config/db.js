import mongoose from 'mongoose';
import { env } from './env.js';

// The address without the password, safe to print
const safeUri = (uri) => uri.replace(/\/\/([^@/]+)@/, '//***@');

export async function connectDB(uri = env.MONGODB_URI) {
  try {
    // Give up after 10 seconds instead of 30, and explain why instead of a long stack trace
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  } catch (error) {
    const local = /127\.0\.0\.1|localhost/.test(uri);
    console.error(
      `\nCannot connect to MongoDB at ${safeUri(uri)}\n` +
        (local
          ? 'The local database is not running. Start it in another terminal and keep it open:\n' +
            '    npm run db:local\n' +
            'then run npm run dev again. (Or put your Atlas link in MONGODB_URI in .env.)\n'
          : 'Check MONGODB_URI in .env, your internet connection, and that your IP address is\n' +
            'allowed in Atlas (Network Access).\n') +
        `Details: ${error.message}\n`,
    );
    process.exit(1);
  }

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
