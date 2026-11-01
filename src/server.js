import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';

// Connect to the database first, then start accepting requests
await connectDB();

const server = createApp().listen(env.PORT, () => {
  console.info(`API running on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
});

// Finish open requests and close the database cleanly on Ctrl+C or when PM2 stops the app
async function shutdown() {
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
