import { Router } from 'express';
import { write } from 'fast-csv';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as service from './service';

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole('HR'));

reportsRouter.get('/attendance', (req, res, next) => {
  service.attendanceReport(req.query).then((d) => res.json(d)).catch(next);
});
reportsRouter.get('/leave', (req, res, next) => {
  service.leaveReport(req.query).then((d) => res.json(d)).catch(next);
});
reportsRouter.get('/payroll', (req, res, next) => {
  service.payrollReport(req.query).then((d) => res.json(d)).catch(next);
});

// --- CSV exports (Content-Disposition attachment) ---
reportsRouter.get('/attendance/export', async (req, res, next) => {
  try {
    const report = await service.attendanceReport(req.query);
    const rows = service.attendanceRows(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    write(rows, { headers: true }).pipe(res);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get('/leave/export', async (req, res, next) => {
  try {
    const report = await service.leaveReport(req.query);
    const rows = await service.leaveRows(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leave-report.csv"');
    write(rows, { headers: true }).pipe(res);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get('/payroll/export', async (req, res, next) => {
  try {
    const report = await service.payrollReport(req.query);
    const rows = service.payrollRows(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payroll-report.csv"');
    write(rows, { headers: true }).pipe(res);
  } catch (e) {
    next(e);
  }
});