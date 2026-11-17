import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env.js';
import './config/models.js';

import { notFound, errorHandler } from './middleware/error.js';
import { sendSuccess } from './utils/response.js';

import authRoutes from './modules/auth/auth.routes.js';
import courseRoutes from './modules/courses/course.routes.js';
import studentRoutes from './modules/students/student.routes.js';
import fileRoutes from './modules/files/file.routes.js';
import organisationRoutes from './modules/organisation/organisation.routes.js';
import roleRoutes from './modules/roles/role.routes.js';
import userRoutes from './modules/users/user.routes.js';
import inwardRoutes, { pendingRouter } from './modules/inward/inward.routes.js';
import tcRoutes from './modules/tc/tc.routes.js';

// Builds the Express app. server.js starts it; tests use it directly with Supertest.
export function createApp() {
  const app = express();

  // Trust proxy in production
  if (env.isProduction) {
    app.set('trust proxy', 1);
  }

  // Security and request middleware
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  if (env.isDevelopment) {
    app.use(morgan('dev'));
  }

  // All API routes live under /api/v1
  const api = express.Router();

  // Prevent caching of API responses
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Health check
  api.get('/health', (_req, res) => sendSuccess(res, { status: 'ok' }));

  // Module routes
  api.use('/auth', authRoutes);
  api.use('/courses', courseRoutes);
  api.use('/students', studentRoutes);
  api.use('/files', fileRoutes);
  api.use('/organisation', organisationRoutes);
  api.use('/roles', roleRoutes);
  api.use('/users', userRoutes);
  api.use('/inward-batches', inwardRoutes);
  api.use('/inward-pending', pendingRouter);
  api.use('/tcs', tcRoutes);

  // Mount API router only once
  app.use('/api/v1', api);

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
