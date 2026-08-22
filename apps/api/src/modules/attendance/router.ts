import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as service from './service';
import { getAuth } from '../../lib/authContext';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

// Employee — self attendance.
attendanceRouter.post('/check-in', (req, res, next) => {
  service.checkIn(getAuth(req).userId).then((d) => res.status(201).json(d)).catch(next);
});
attendanceRouter.post('/check-out', (req, res, next) => {
  service.checkOut(getAuth(req).userId).then((d) => res.json(d)).catch(next);
});
attendanceRouter.get('/daily', (req, res, next) => {
  service.daily(getAuth(req).userId).then((d) => res.json({ data: d })).catch(next);
});
attendanceRouter.get('/my', (req, res, next) => {
  service.myList(getAuth(req).userId, req.query).then((d) => res.json(d)).catch(next);
});
attendanceRouter.get('/weekly/my', (req, res, next) => {
  service.weekly(getAuth(req).userId).then((d) => res.json(d)).catch(next);
});

// HR — all records + summary.
attendanceRouter.get('/summary', requireRole('HR'), (req, res, next) => {
  service.summary(req.query).then((d) => res.json(d)).catch(next);
});
attendanceRouter.get('/', requireRole('HR'), (req, res, next) => {
  service.adminList(req.query).then((d) => res.json(d)).catch(next);
});