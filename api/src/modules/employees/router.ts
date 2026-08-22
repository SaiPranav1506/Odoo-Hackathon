import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as service from './service';
import { getAuth, canAccessEmployee } from '../../lib/authContext';
import { httpError } from '../../utils/apiError';
import { uploadFile } from '../../lib/storage';
import { prisma } from '../../lib/prisma';

export const employeesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

employeesRouter.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });
const docIdParam = z.object({ id: z.coerce.number().int().positive(), docId: z.coerce.number().int().positive() });

const updateFieldsSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.string().max(20).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  personalEmail: z.string().email().max(254).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  employmentType: z.string().max(60).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  profilePictureUrl: z.string().url().optional().nullable(),
  employeeId: z.string().min(1).max(30).optional(),
});

const createEmployeeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  employeeId: z.string().min(1).max(30),
  role: z.enum(['EMPLOYEE', 'HR']).optional(),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  password: z.string().min(8).max(128).optional(),
});

const docSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.string().min(1).max(60),
});

// HR: employee list. /active variant for impersonation dropdowns.
employeesRouter.get('/', requireRole('HR'), (req, res, next) => {
  service.list(req.query)
    .then((data) => res.json(data))
    .catch(next);
});

employeesRouter.get('/active', requireRole('HR'), (req, res, next) => {
  prismaFindActive(res, next);
});

function prismaFindActive(res: Response, next: NextFunction) {
  prisma.employeeProfile
    .findMany({
      where: { status: 'ACTIVE' },
      orderBy: { employeeId: 'asc' },
      include: { user: { select: { email: true, role: true } } },
      take: 200,
    })
    .then((data) => res.json({ data }))
    .catch(next);
}

employeesRouter.post('/', requireRole('HR'), validate({ body: createEmployeeSchema }), (req, res, next) => {
  service
    .createEmployee(req.body as never)
    .then((data) => res.status(201).json(data))
    .catch(next);
});

// View one employee (self or HR switch-into-view).
employeesRouter.get('/:id', validate({ params: idParam }), (req, res, next) => {
  const targetUserId = Number(req.params.id);
  const auth = getAuth(req);
  if (auth.role === 'EMPLOYEE' && auth.userId !== targetUserId) {
    next(httpError.forbidden('You cannot view another employee\'s profile'));
    return;
  }
  service
    .getById(targetUserId)
    .then((data) => res.json(data))
    .catch(next);
});

// Update profile. HR: all fields. EMPLOYEE: self, allow-list only (enforced in service).
employeesRouter.patch('/:id', validate({ params: idParam, body: updateFieldsSchema }), (req, res, next) => {
  const targetUserId = Number(req.params.id);
  const auth = getAuth(req);
  if (auth.role === 'EMPLOYEE' && auth.userId !== targetUserId) {
    next(httpError.forbidden('You can only update your own profile'));
    return;
  }
  service
    .updateProfile({ actorUserId: auth.userId, actorRole: auth.role, targetUserId, payload: req.body })
    .then((data) => res.json(data))
    .catch(next);
});

// HR: audit trail for a specific employee.
employeesRouter.get('/:id/audit', requireRole('HR'), validate({ params: idParam }), (req, res, next) => {
  service
    .listAudit(Number(req.params.id), req.query)
    .then((data) => res.json(data))
    .catch(next);
});

// Documents (upload).
employeesRouter.post(
  '/:id/documents',
  validate({ params: idParam, body: docSchema }),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetUserId = Number(req.params.id);
      const auth = getAuth(req);
      if (!canAccessEmployee(req, targetUserId)) {
        throw httpError.forbidden('You cannot add documents to this employee\'s profile');
      }
      if (!req.file) throw httpError.badRequest('No file uploaded');
      const stored = await uploadFile({
        kind: 'document',
        ownerId: targetUserId,
        originalName: req.file.originalname,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      const doc = await service.addDocument({
        employeeUserId: targetUserId,
        name: req.body.name,
        type: req.body.type,
        url: stored.url,
        uploaderUserId: auth.userId,
      });
      res.status(201).json(doc);
    } catch (e) {
      next(e);
    }
  },
);

employeesRouter.delete('/:id/documents/:docId', validate({ params: docIdParam }), (req, res, next) => {
  const auth = getAuth(req);
  const targetUserId = Number(req.params.id);
  if (auth.role === 'EMPLOYEE' && auth.userId !== targetUserId) {
    next(httpError.forbidden('You can only manage your own documents'));
    return;
  }
  service
    .removeDocument({ employeeUserId: targetUserId, docId: Number(req.params.docId), actorRole: auth.role })
    .then((data) => res.json(data))
    .catch(next);
});

// Profile picture upload (self).
employeesRouter.post('/storage/profile-picture', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  getAuth(req);
  if (!req.userId) {
    next(httpError.unauthorized());
    return;
  }
  if (!req.file) {
    next(httpError.badRequest('No file uploaded'));
    return;
  }
  uploadFile({
    kind: 'profile',
    ownerId: req.userId,
    originalName: req.file.originalname,
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
  })
    .then(async (stored) => {
      await service.setProfilePicture(req.userId!, stored.url);
      res.json({ url: stored.url });
    })
    .catch(next);
});