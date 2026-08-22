import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as service from './service';
import { getAuth } from '../../lib/authContext';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/me', (req, res, next) => {
  service.employeeDashboard(getAuth(req).userId).then((d) => res.json(d)).catch(next);
});

dashboardRouter.get('/admin', requireRole('HR'), (_req, res, next) => {
  service.adminDashboard().then((d) => res.json(d)).catch(next);
});