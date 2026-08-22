import { prisma } from '../../lib/prisma';
import { httpError } from '../../utils/apiError';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { writeAudit } from './audit.service';
import { hashPassword, passwordIssues } from '../../lib/password';
import type { EmployeeStatus } from '@prisma/client';

// Fields an EMPLOYEE may change about their own profile. Anything else, an
// employee trying to patch is REJECTED server-side (not just hidden in UI).
export const SELF_EDITABLE_FIELDS = ['phone', 'address', 'profilePictureUrl'] as const;

// Every editable field on the profile (all editable by HR).
const ALL_FIELDS = [
  'firstName', 'lastName', 'dateOfBirth', 'gender', 'phone', 'personalEmail',
  'address', 'department', 'jobTitle', 'hireDate', 'employmentType', 'status',
  'profilePictureUrl', 'employeeId',
] as const;

type EditableField = (typeof ALL_FIELDS)[number];

// Resolve employee profile by its owner userId. Throws 404 if absent.
async function profileByUserId(userId: number) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { email: true, role: true, emailVerifiedAt: true } },
      salaryStructure: true,
      leaveBalance: true,
      documents: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!profile) throw httpError.notFound('Employee profile not found');
  return profile;
}

export async function getById(userId: number) {
  const profile = await profileByUserId(userId);
  const recentAudits = await prisma.auditLog.findMany({
    where: { subjectEmployeeId: profile.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { actor: { select: { email: true, role: true } } },
  });
  return { ...profile, recentAudits };
}

export async function list(query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const search = typeof query.search === 'string' && query.search ? query.search.trim() : '';
  const department = typeof query.department === 'string' && query.department ? query.department : undefined;
  const status = typeof query.status === 'string' && ['ACTIVE', 'INACTIVE'].includes(query.status) ? (query.status as EmployeeStatus) : undefined;

  const where = {
    ...(department ? { department } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { employeeId: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.employeeProfile.findMany({
      where,
      orderBy: { employeeId: 'asc' },
      skip,
      take,
      include: {
        user: { select: { email: true, role: true } },
        salaryStructure: { select: { basicPay: true } },
        attendance: { select: { id: true } },
      },
    }),
    prisma.employeeProfile.count({ where }),
  ]);

  return { data: items, meta: buildMeta(total, page, pageSize) };
}

export async function createEmployee(input: {
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role?: 'EMPLOYEE' | 'HR';
  department?: string;
  jobTitle?: string;
  phone?: string;
  password?: string;
}) {
  const email = input.email.toLowerCase();
  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
    throw httpError.validation({ email: ['Invalid email'] });
  }

  // If no password supplied, generate one and return it once for HR to share.
  let password = input.password;
  let generated = false;
  if (!password) {
    password = `Temp@${Math.random().toString(36).slice(2, 8)}A1`;
    generated = true;
  }
  const issues = passwordIssues(password);
  if (issues.length) throw httpError.validation({ password: issues });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw httpError.conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: input.role ?? 'EMPLOYEE',
      profile: {
        create: {
          employeeId: input.employeeId,
          firstName: input.firstName,
          lastName: input.lastName,
          department: input.department,
          jobTitle: input.jobTitle,
          phone: input.phone,
          leaveBalance: { create: {} },
        },
      },
    },
    include: { profile: true },
  });

  return { user: { id: user.id, email: user.email, role: user.role }, generatedPassword: generated ? password : undefined };
}

type UpdatePayload = Record<string, unknown>;

export async function updateProfile(args: {
  actorUserId: number;
  actorRole: 'EMPLOYEE' | 'HR';
  targetUserId: number;
  payload: UpdatePayload;
}) {
  const profile = await profileByUserId(args.targetUserId);

  const keys = Object.keys(args.payload).filter((k) => (args.payload[k] as unknown) !== undefined);
  if (!keys.length) throw httpError.badRequest('No fields to update');

  // Server-side authorization: employees may only touch the allow-list.
  if (args.actorRole === 'EMPLOYEE') {
    const disallowed = keys.filter((k) => !SELF_EDITABLE_FIELDS.includes(k as (typeof SELF_EDITABLE_FIELDS)[number]));
    if (disallowed.length) {
      throw httpError.forbidden(`Employees may only update: ${SELF_EDITABLE_FIELDS.join(', ')}. Attempted: ${disallowed.join(', ')}`);
    }
  } else {
    const unknown = keys.filter((k) => !ALL_FIELDS.includes(k as EditableField));
    if (unknown.length) throw httpError.validation({ fields: [`Unknown fields: ${unknown.join(', ')}`] });
  }

  // Coerce date-only fields.
  const normalized: UpdatePayload = { ...args.payload };
  for (const f of ['dateOfBirth', 'hireDate']) {
    if (typeof normalized[f] === 'string') normalized[f] = new Date(String(normalized[f]));
  }

  const updated = await prisma.employeeProfile.update({
    where: { id: profile.id },
    data: normalized as never,
  });

  // Per-field audit trail: record what changed, by whom, before/after.
  for (const key of keys) {
    const oldV = (profile as unknown as Record<string, unknown>)[key];
    const newV = (updated as unknown as Record<string, unknown>)[key];
    if (String(oldV) === String(newV)) continue;
    await writeAudit({
      actorUserId: args.actorUserId,
      subjectEmployeeId: profile.id,
      action: args.actorRole === 'HR' ? 'ADMIN_PROFILE_UPDATE' : 'SELF_PROFILE_UPDATE',
      field: key,
      oldValue: oldV ?? null,
      newValue: newV ?? null,
    });
  }

  return updated;
}

export async function listAudit(employeeUserId: number, query: Record<string, unknown>) {
  const profile = await profileByUserId(employeeUserId);
  return listAuditByProfileId(profile.id, query);
}

async function listAuditByProfileId(profileId: number, query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = { subjectEmployeeId: profileId };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { actor: { select: { email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { data: items, meta: buildMeta(total, page, pageSize) };
}

// ---- Documents ----
export async function addDocument(args: {
  employeeUserId: number;
  name: string;
  type: string;
  url: string;
  uploaderUserId: number;
}) {
  const profile = await profileByUserId(args.employeeUserId);
  return prisma.document.create({
    data: {
      employeeId: profile.id,
      name: args.name,
      type: args.type,
      url: args.url,
      uploadedBy: args.uploaderUserId,
    },
  });
}

export async function removeDocument(args: { employeeUserId: number; docId: number; actorRole: 'EMPLOYEE' | 'HR' }) {
  const profile = await profileByUserId(args.employeeUserId);
  const doc = await prisma.document.findFirst({ where: { id: args.docId, employeeId: profile.id } });
  if (!doc) throw httpError.notFound('Document not found');
  await prisma.document.delete({ where: { id: doc.id } });
  return { message: 'Document deleted' };
}

// ---- Profile picture ----
export async function setProfilePicture(targetUserId: number, url: string): Promise<void> {
  await prisma.employeeProfile.update({ where: { userId: targetUserId }, data: { profilePictureUrl: url } });
}