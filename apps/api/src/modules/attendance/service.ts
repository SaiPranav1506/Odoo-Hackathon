import { prisma } from '../../lib/prisma';
import { httpError } from '../../utils/apiError';
import { todayDateOnly, toDateOnly, addDays, formatDate, eachDate, isValidDateString } from '../../utils/date';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { requireVerifiedUser } from '../auth/service';
import type { AttendanceStatus } from '@prisma/client';

export const HALF_DAY_HOURS = 4;

async function profileByUserId(userId: number) {
  const profile = await prisma.employeeProfile.findUnique({ where: { userId } });
  if (!profile) throw httpError.notFound('Employee profile not found');
  return profile;
}

export async function checkIn(userId: number) {
  await requireVerifiedUser(userId);
  const profile = await profileByUserId(userId);
  const today = todayDateOnly();

  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: profile.id, date: today } },
  });
  if (existing?.checkInTime) {
    throw httpError.conflict('Already checked in for today');
  }
  if (existing?.status === 'LEAVE') {
    throw httpError.conflict('You are on approved leave today');
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: profile.id, date: today } },
    create: { employeeId: profile.id, date: today, checkInTime: new Date(), status: 'PRESENT' },
    update: { checkInTime: new Date() },
  });
  return record;
}

export async function checkOut(userId: number) {
  await requireVerifiedUser(userId);
  const profile = await profileByUserId(userId);
  const today = todayDateOnly();

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: profile.id, date: today } },
  });
  if (!record) throw httpError.badRequest('Check in first before checking out');
  if (record.checkOutTime) throw httpError.conflict('Already checked out for today');

  const now = new Date();
  const hoursWorked = (now.getTime() - (record.checkInTime ?? now).getTime()) / 3600000;
  const status: AttendanceStatus = hoursWorked < HALF_DAY_HOURS ? 'HALF_DAY' : 'PRESENT';

  return prisma.attendanceRecord.update({
    where: { id: record.id },
    data: { checkOutTime: now, status },
  });
}

export async function daily(userId: number) {
  const profile = await profileByUserId(userId);
  return prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: profile.id, date: todayDateOnly() } },
  });
}

export async function myList(userId: number, query: Record<string, unknown>) {
  const profile = await profileByUserId(userId);
  const { skip, take, page, pageSize } = parsePagination(query);
  const from = parseFrom(query.from);
  const to = parseTo(query.to);
  const where = {
    employeeId: profile.id,
    ...(from ? { date: { gte: from } } : {}),
    ...(to ? { date: { lte: to } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.attendanceRecord.findMany({ where, orderBy: { date: 'desc' }, skip, take }),
    prisma.attendanceRecord.count({ where }),
  ]);
  return { data: items, meta: buildMeta(total, page, pageSize) };
}

export async function weekly(userId: number): Promise<{ weekStart: string; weekEnd: string; days: unknown[] }> {
  const profile = await profileByUserId(userId);
  const today = todayDateOnly();
  const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
  const weekStart = addDays(today, -dayOfWeek);
  const weekEnd = addDays(weekStart, 6);
  const days = await prisma.attendanceRecord.findMany({
    where: { employeeId: profile.id, date: { gte: weekStart, lte: weekEnd } },
    orderBy: { date: 'asc' },
  });
  return { weekStart: formatDate(weekStart), weekEnd: formatDate(weekEnd), days };
}

export async function adminList(query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const from = parseFrom(query.from);
  const to = parseTo(query.to);
  const employeeUserId = Number(query.employeeId) || undefined;
  const status = validStatus(query.status);

  const employeeIdFilter = employeeUserId
    ? { is: { userId: employeeUserId } }
    : undefined;

  const where = {
    date: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
    ...(employeeIdFilter ? { employee: employeeIdFilter } : {}),
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take,
      include: { employee: { select: { employeeId: true, firstName: true, lastName: true, department: true } } },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  const totals = await prisma.attendanceRecord.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });
  return { data: items, meta: buildMeta(total, page, pageSize), totals };
}

// Aggregate counts by status in a range (used by summaries/reports).
export async function summary(query: Record<string, unknown>) {
  const from = parseFrom(query.from);
  const to = parseTo(query.to);
  const employeeUserId = Number(query.employeeId) || undefined;
  const where = {
    date: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
    ...(employeeUserId ? { employee: { is: { userId: employeeUserId } } } : {}),
  };
  const byStatus = await prisma.attendanceRecord.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });
  const present = byStatus.find((s) => s.status === 'PRESENT')?._count._all ?? 0;
  const absent = byStatus.find((s) => s.status === 'ABSENT')?._count._all ?? 0;
  const halfDay = byStatus.find((s) => s.status === 'HALF_DAY')?._count._all ?? 0;
  const leave = byStatus.find((s) => s.status === 'LEAVE')?._count._all ?? 0;
  return { from: from ?? null, to: to ?? null, counts: { PRESENT: present, ABSENT: absent, HALF_DAY: halfDay, LEAVE: leave }, total: present + absent + halfDay + leave };
}

export async function listDatesInRange(employeeId: number, start: Date, end: Date) {
  return prisma.attendanceRecord.findMany({
    where: { employeeId, date: { gte: toDateOnly(start), lte: toDateOnly(end) } },
  });
}

function parseFrom(raw: unknown): Date | undefined {
  if (typeof raw === 'string' && raw && isValidDateString(raw)) return toDateOnly(new Date(raw));
  return undefined;
}
function parseTo(raw: unknown): Date | undefined {
  if (typeof raw === 'string' && raw && isValidDateString(raw)) return toDateOnly(new Date(raw));
  return undefined;
}
function validStatus(raw: unknown): AttendanceStatus | undefined {
  return ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'].includes(String(raw)) ? (raw as AttendanceStatus) : undefined;
}

export { eachDate };