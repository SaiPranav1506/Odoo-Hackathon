import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as service from './service';
import { getAuth } from '../../lib/authContext';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', (req, res, next) => {
  const { userId } = getAuth(req);
  service.listForUser(userId, req.query)
    .then((data) => res.json(data))
    .catch(next);
});

notificationsRouter.get('/unread-count', (req, res, next) => {
  const { userId } = getAuth(req);
  service.unreadCount(userId)
    .then((count) => res.json({ count }))
    .catch(next);
});

notificationsRouter.patch(
  '/:id/read',
  validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  (req, res, next) => {
    const { userId } = getAuth(req);
    service.markOneRead(userId, Number(req.params.id))
      .then(() => res.status(204).end())
      .catch(next);
  },
);

notificationsRouter.patch('/read-all', (req, res, next) => {
  const { userId } = getAuth(req);
  service.markAllRead(userId)
    .then(() => res.status(204).end())
    .catch(next);
});