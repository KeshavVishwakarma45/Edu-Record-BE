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
import handoverRoutes from './modules/documents/handover.routes.js';
import inwardRoutes, { pendingRouter } from './modules/inward/inward.routes.js';
import studentRoutes from './modules/students/student.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import clearanceRoutes from './modules/clearance/clearance.routes.js';
export function createApp() {
  const app = express();

  if (env.isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (env.isDevelopment) app.use(morgan('dev'));

  const api = express.Router();

  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  api.get('/health', (_req, res) => sendSuccess(res, { status: 'ok' }));
  api.use('/auth', authRoutes);
  api.use('/courses', courseRoutes);
  api.use('/students', studentRoutes);
  api.use('/clearance', clearanceRoutes);
  api.use('/files', fileRoutes);
  api.use('/organisation', organisationRoutes);
  api.use('/roles', roleRoutes);
  api.use('/users', userRoutes);
  api.use('/handover', handoverRoutes);
  api.use('/inward-batches', inwardRoutes);
  api.use('/inward-pending', pendingRouter);
  api.use('/reports', reportRoutes);
  app.use('/api/v1', api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
