import type { LeaveStatus, LeaveType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { httpError } from '../../utils/apiError';
import { toDateOnly, inclusiveDays, dateRangeOverlaps, eachDate, formatDate, isValidDateString } from '../../utils/date';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { requireVerifiedUser } from '../auth/service';
import { createInApp } from '../notifications/service';
import { sendMail } from '../../lib/mailer';

// Leave balance caps. Paid entitlement lives on LeaveBalance; sick/unpaid have fixed caps here.
const SICK_DAYS_CAP = 14;
const UNPAID_DAYS_CAP = 30;

async function profileByUserId(userId: number) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    include: { leaveBalance: true },
  });
  if (!profile) throw httpError.notFound('Employee profile not found');
  return profile;
}

export async function getBalance(userId: number) {
  const profile = await profileByUserId(userId);
  return { entitled: profile.leaveBalance, available: { paid: Math.max(0, (profile.leaveBalance?.paidDaysEntitled ?? 0) - (profile.leaveBalance?.paidDaysUsed ?? 0)) } };
}

export async function applyLeave(userId: number, input: { leaveType: LeaveType; startDate: string; endDate: string; reason: string }) {
  await requireVerifiedUser(userId);
  const profile = await profileByUserId(userId);

  if (!isValidDateString(input.startDate) || !isValidDateString(input.endDate)) {
    throw httpError.validation({ dates: ['Use YYYY-MM-DD'] });
  }
  const start = toDateOnly(new Date(input.startDate));
  const end = toDateOnly(new Date(input.endDate));
  if (end < start) throw httpError.badRequest('End date must be on or after start date');
  const days = inclusiveDays(start, end);
  if (days > 30) throw httpError.badRequest('Leave cannot exceed 30 consecutive days');

  // Overlap prevention (PENDING / APPROVED).
  const existing = await prisma.leaveRequest.findMany({
    where: {
      employeeId: profile.id,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });
  const clash = existing.find((r) => dateRangeOverlaps(start, end, toDateOnly(r.startDate), toDateOnly(r.endDate)));
  if (clash) {
    throw httpError.conflict(
      `Leave overlaps an existing ${clash.status.toLowerCase()} request (${formatDate(clash.startDate)} – ${formatDate(clash.endDate)}).`,
    );
  }

  // Balance validation.
  const bal = profile.leaveBalance;
  if (!bal) await ensureBalance(profile.id);
  const balance = bal ?? (await prisma.leaveBalance.findUnique({ where: { employeeId: profile.id } }));
  if (input.leaveType === 'PAID') {
    if (balance && balance.paidDaysUsed + days > balance.paidDaysEntitled) {
      throw httpError.conflict('Insufficient paid leave balance');
    }
  } else if (input.leaveType === 'SICK' && balance && balance.sickDaysUsed + days > SICK_DAYS_CAP) {
    throw httpError.conflict('Insufficient sick leave balance');
  } else if (input.leaveType === 'UNPAID' && balance && balance.unpaidDaysUsed + days > UNPAID_DAYS_CAP) {
    throw httpError.conflict('Insufficient unpaid leave allowance');
  }

  const created = await prisma.leaveRequest.create({
    data: {
      employeeId: profile.id,
      leaveType: input.leaveType,
      startDate: start,
      endDate: end,
      days,
      reason: input.reason.trim(),
    },
  });

  // Notify HR admins that a request is pending.
  try {
    const admins = await prisma.user.findMany({ where: { role: 'HR' } });
    for (const admin of admins) {
      await createInApp({ recipientUserId: admin.id, type: 'LEAVE_REQUESTED', title: 'New leave request', body: `${profile.firstName} ${profile.lastName} requested ${days} day${days > 1 ? 's' : ''} of ${input.leaveType.toLowerCase()} leave.`, link: '/leave/admin' });
    }
  } catch {
    // Notification failure must not block the request.
  }

  return created;
}

async function ensureBalance(employeeProfileId: number) {
  await prisma.leaveBalance.upsert({
    where: { employeeId: employeeProfileId },
    create: { employeeId: employeeProfileId },
    update: {},
  });
}

export async function myList(userId: number, query: Record<string, unknown>) {
  const profile = await profileByUserId(userId);
  const { skip, take, page, pageSize } = parsePagination(query);
  const status = validStatus(query.status);
  const where = { employeeId: profile.id, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { data: items, meta: buildMeta(total, page, pageSize) };
}

export async function getById(requestId: number) {
  const req = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { employee: { include: { user: { select: { email: true } } } } },
  });
  if (!req) throw httpError.notFound('Leave request not found');
  return req;
}

export async function adminList(query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const status = validStatus(query.status);
  const employeeUserId = Number(query.employeeId) || undefined;
  const from = validDate(query.from);
  const to = validDate(query.to);
  const where = {
    ...(status ? { status } : {}),
    ...(employeeUserId ? { employee: { is: { userId: employeeUserId } } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { employee: { select: { userId: true, employeeId: true, firstName: true, lastName: true, department: true } } },
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { data: items, meta: buildMeta(total, page, pageSize) };
}

/**
 * Approve/reject a leave request. On APPROVAL, in ONE transaction:
 *  - mark the employee's attendance as LEAVE for each covered date
 *    (unless they actually worked that day — then attendance wins)
 *  - increment their leave balance by type
 * Notifications + email are sent AFTER the transaction (best-effort).
 */
export async function decide(args: { hrUserId: number; requestId: number; status: LeaveStatus; comment?: string }) {
  if (args.status !== 'APPROVED' && args.status !== 'REJECTED') {
    throw httpError.badRequest('Status must be APPROVED or REJECTED');
  }
  const request = await prisma.leaveRequest.findUnique({
    where: { id: args.requestId },
    include: { employee: { include: { user: { select: { id: true, email: true } }, leaveBalance: true } } },
  });
  if (!request) throw httpError.notFound('Leave request not found');
  if (request.status !== 'PENDING') {
    throw httpError.conflict(`Leave already ${request.status.toLowerCase()}`);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (args.status === 'APPROVED') {
      const employeeId = request.employee.id;
      const start = toDateOnly(request.startDate);
      const end = toDateOnly(request.endDate);
      for (const date of eachDate(start, end)) {
        const existing = await tx.attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId, date } },
        });
        // Attendance reflects real work; only turn days they did NOT work into LEAVE.
        if (existing?.checkInTime) continue;
        await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date } },
          create: { employeeId, date, status: 'LEAVE', leaveRequestId: request.id },
          update: { status: 'LEAVE', leaveRequestId: request.id },
        });
      }

      // Update balance.
      const bal = request.employee.leaveBalance;
      const inc = request.days;
      const data =
        request.leaveType === 'PAID'
          ? { paidDaysUsed: { increment: inc } }
          : request.leaveType === 'SICK'
            ? { sickDaysUsed: { increment: inc } }
            : { unpaidDaysUsed: { increment: inc } };
      await tx.leaveBalance.upsert({
        where: { employeeId },
        create: { employeeId, ...(data as never) },
        update: data,
      });
    }

    await tx.leaveRequest.update({
      where: { id: request.id },
      data: { status: args.status, adminComment: args.comment?.trim() ?? null, decidedBy: args.hrUserId, decidedAt: now },
    });
  });

  // Post-decision notifications (best-effort; do not roll back the decision).
  const requesterId = request.employee.user.id;
  const requesterEmail = request.employee.user.email;
  const summary = `${request.days} day${request.days > 1 ? 's' : ''} (${formatDate(request.startDate)} – ${formatDate(request.endDate)})`;
  try {
    if (args.status === 'APPROVED') {
      await createInApp({ recipientUserId: requesterId, type: 'LEAVE_APPROVED', title: 'Leave approved', body: `Your ${request.leaveType.toLowerCase()} leave for ${summary} was approved.`, link: '/leave' });
      await sendMail({ to: requesterEmail, subject: 'Dayflow — Leave approved', text: `Your ${request.leaveType.toLowerCase()} leave (${summary}) was approved.${args.comment ? `\nComment: ${args.comment}` : ''}` });
    } else {
      await createInApp({ recipientUserId: requesterId, type: 'LEAVE_REJECTED', title: 'Leave rejected', body: `Your ${request.leaveType.toLowerCase()} leave for ${summary} was not approved.${args.comment ? ` Reason: ${args.comment}` : ''}`, link: '/leave' });
      await sendMail({ to: requesterEmail, subject: 'Dayflow — Leave not approved', text: `Your ${request.leaveType.toLowerCase()} leave (${summary}) was rejected.${args.comment ? `\nReason: ${args.comment}` : ''}` });
    }
  } catch {
    // best-effort
  }

  const final = await prisma.leaveRequest.findUnique({ where: { id: request.id } });
  return final;
}

function validStatus(raw: unknown): LeaveStatus | undefined {
  return ['PENDING', 'APPROVED', 'REJECTED'].includes(String(raw)) ? (raw as LeaveStatus) : undefined;
}
function validDate(raw: unknown): Date | undefined {
  if (typeof raw === 'string' && raw && isValidDateString(raw)) return toDateOnly(new Date(raw));
  return undefined;
}