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
import fileRoutes from './modules/files/file.routes.js';
import organisationRoutes from './modules/organisation/organisation.routes.js';
import roleRoutes from './modules/roles/role.routes.js';
import userRoutes from './modules/users/user.routes.js';
import studentRoutes from './modules/students/student.routes.js';

// Builds the Express app. server.js starts it; tests use it directly with Supertest.
export function createApp() {
  const app = express();

  // On the pilot server Nginx sits in front, so the real client IP is in X-Forwarded-For
  if (env.isProduction) app.set('trust proxy', 1);

  // Order matters: security headers and CORS first, then body parsing, then routes
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.isDevelopment) app.use(morgan('dev'));

  // All API routes live under /api/v1. A new module adds one line here.
  const api = express.Router();
  // Answers depend on the X-Institute-Id header and hold personal data: never cache them
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.get('/health', (_req, res) => sendSuccess(res, { status: 'ok' }));
  api.use('/auth', authRoutes);
  api.use('/courses', courseRoutes);
  api.use('/files', fileRoutes);
  api.use('/organisation', organisationRoutes);
  api.use('/roles', roleRoutes);
  api.use('/users', userRoutes);
  app.use('/api/v1', api);
  api.use('/students', studentRoutes);

  // Nothing matched: 404. Then the one error middleware formats every error.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
