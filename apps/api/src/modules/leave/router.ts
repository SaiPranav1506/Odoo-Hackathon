import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as service from './service';
import { getAuth } from '../../lib/authContext';
import { httpError } from '../../utils/apiError';

export const leaveRouter = Router();

leaveRouter.use(requireAuth);

const applySchema = z.object({
  leaveType: z.enum(['PAID', 'SICK', 'UNPAID']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3).max(1000),
});

const decideSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1000).optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Employee — apply / own list / own balance.
leaveRouter.post('/', validate({ body: applySchema }), (req, res, next) => {
  service.applyLeave(getAuth(req).userId, req.body as never).then((d) => res.status(201).json(d)).catch(next);
});
leaveRouter.get('/my', (req, res, next) => {
  service.myList(getAuth(req).userId, req.query).then((d) => res.json(d)).catch(next);
});
leaveRouter.get('/balance', (req, res, next) => {
  service.getBalance(getAuth(req).userId).then((d) => res.json(d)).catch(next);
});

// Single request (owner or HR).
leaveRouter.get('/:id', validate({ params: idParam }), (req, res, next) => {
  const auth = getAuth(req);
  service.getById(Number(req.params.id))
    .then((r) => {
      if (auth.role === 'EMPLOYEE' && r.employee.userId !== auth.userId) {
        throw httpError.forbidden('You cannot view another employee\'s leave request');
      }
      res.json(r);
    })
    .catch(next);
});

// HR — all requests + decide.
leaveRouter.get('/', requireRole('HR'), (req, res, next) => {
  service.adminList(req.query).then((d) => res.json(d)).catch(next);
});
leaveRouter.patch('/:id/decide', requireRole('HR'), validate({ params: idParam, body: decideSchema }), (req, res, next) => {
  const auth = getAuth(req);
  service
    .decide({ hrUserId: auth.userId, requestId: Number(req.params.id), status: (req.body as { status: 'APPROVED' | 'REJECTED' }).status, comment: (req.body as { comment?: string }).comment })
    .then((d) => res.json(d))
    .catch(next);
});