import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as service from './service';
import { getAuth } from '../../lib/authContext';

export const payrollRouter = Router();

payrollRouter.use(requireAuth);

// Employee — read-only own payroll. No write routes exist for employees.
payrollRouter.get('/me', (req, res, next) => {
  service.myPayroll(getAuth(req).userId).then((d) => res.json(d)).catch(next);
});

// HR — all payroll / one employee's payroll / update structure / generate payslip.
payrollRouter.get('/', requireRole('HR'), (req, res, next) => {
  service.adminList(req.query).then((d) => res.json(d)).catch(next);
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

payrollRouter.get('/employees/:id', requireRole('HR'), validate({ params: idParam }), (req, res, next) => {
  service.adminGet(Number(req.params.id)).then((d) => res.json(d)).catch(next);
});

const structureSchema = z.object({
  basicPay: z.coerce.number().positive().max(9_999_999),
  housingAllowance: z.coerce.number().min(0).max(9_999_999).optional(),
  transportAllowance: z.coerce.number().min(0).max(9_999_999).optional(),
  otherAllowances: z.record(z.number().min(0)).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  otherDeductions: z.record(z.number().min(0)).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

payrollRouter.put('/employees/:id/structure', requireRole('HR'), validate({ params: idParam, body: structureSchema }), (req, res, next) => {
  const auth = getAuth(req);
  service
    .updateStructure({ hrUserId: auth.userId, employeeUserId: Number(req.params.id), input: req.body as never })
    .then((d) => res.json(d))
    .catch(next);
});

const payslipSchema = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional() });

payrollRouter.post('/payslips/employees/:id', requireRole('HR'), validate({ params: idParam, body: payslipSchema }), (req, res, next) => {
  const auth = getAuth(req);
  service
    .generatePayslip({ hrUserId: auth.userId, employeeUserId: Number(req.params.id), period: (req.body as { period?: string }).period })
    .then((d) => res.status(201).json(d))
    .catch(next);
});