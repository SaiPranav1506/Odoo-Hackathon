import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { generalLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';
import { env } from './config/env';
import { storageRoot } from './lib/storage';
import { authRouter } from './modules/auth/router';
import { employeesRouter } from './modules/employees/router';
import { attendanceRouter } from './modules/attendance/router';
import { leaveRouter } from './modules/leave/router';
import { payrollRouter } from './modules/payroll/router';
import { notificationsRouter } from './modules/notifications/router';
import { dashboardRouter } from './modules/dashboard/router';
import { reportsRouter } from './modules/reports/router';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());

  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(generalLimiter);

  // Local-storage file serving (profile pictures / documents).
  app.use('/uploads', express.static(storageRoot()));

  // ---- API v1 ----
  const api = express.Router();
  api.use(authRouter);
  api.use('/employees', employeesRouter);
  api.use('/attendance', attendanceRouter);
  api.use('/leave', leaveRouter);
  api.use('/payroll', payrollRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/reports', reportsRouter);
  app.use('/api/v1', api);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'dayflow-api', time: new Date().toISOString() });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}