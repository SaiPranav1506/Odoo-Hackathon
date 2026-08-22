import { prisma } from '../../lib/prisma';
import { toDateOnly, isValidDateString } from '../../utils/date';
import { httpError } from '../../utils/apiError';

function range(query: Record<string, unknown>): { from?: Date; to?: Date } {
  const from = typeof query.from === 'string' && isValidDateString(query.from) ? toDateOnly(new Date(query.from)) : undefined;
  const to = typeof query.to === 'string' && isValidDateString(query.to) ? toDateOnly(new Date(query.to)) : undefined;
  return { from, to };
}

export async function attendanceReport(query: Record<string, unknown>) {
  const { from, to } = range(query);
  const employeeUserId = Number(query.employeeId) || undefined;
  const where = {
    date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
    ...(employeeUserId ? { employee: { is: { userId: employeeUserId } } } : {}),
  };
  const [byStatus, detail] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      take: 2000,
      include: { employee: { select: { employeeId: true, firstName: true, lastName: true, department: true } } },
    }),
  ]);
  const counts = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0 } as Record<string, number>;
  for (const row of byStatus) counts[row.status] = row._count._all;
  return { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null, counts, detail };
}

export async function leaveReport(query: Record<string, unknown>) {
  const { from, to } = range(query);
  const where = { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
  const [byType, byStatus] = await Promise.all([
    prisma.leaveRequest.groupBy({ by: ['leaveType'], where, _count: { _all: true } }),
    prisma.leaveRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ]);
  return { range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null }, byType, byStatus };
}

export async function payrollReport(query: Record<string, unknown>) {
  const period = typeof query.period === 'string' && query.period ? query.period : undefined;
  if (period && !/^\d{4}-\d{2}$/.test(period)) throw httpError.badRequest('period must be YYYY-MM');
  const slips = await prisma.payslip.findMany({
    where: period ? { period } : {},
    orderBy: [{ period: 'desc' }],
    include: { employee: { select: { employeeId: true, firstName: true, lastName: true, department: true } } },
    take: 5000,
  });
  const totalGross = slips.reduce((a, s) => a + Number(s.gross), 0);
  const totalNet = slips.reduce((a, s) => a + Number(s.net), 0);
  return { period: period ?? null, payslipCount: slips.length, totalGross, totalNet, slips };
}

// ---- CSV row builders ----
export function attendanceRows(report: Awaited<ReturnType<typeof attendanceReport>>): Record<string, string>[] {
  return report.detail.map((a) => ({
    Date: a.date.toISOString().slice(0, 10),
    EmployeeId: a.employee.employeeId,
    Name: `${a.employee.firstName} ${a.employee.lastName}`,
    Department: a.employee.department ?? '',
    Status: a.status,
    CheckIn: a.checkInTime ? a.checkInTime.toISOString() : '',
    CheckOut: a.checkOutTime ? a.checkOutTime.toISOString() : '',
    LeaveRef: a.leaveRequestId ? String(a.leaveRequestId) : '',
  }));
}

export async function leaveRows(report: Awaited<ReturnType<typeof leaveReport>>): Promise<Record<string, string>[]> {
  const rows = await prisma.leaveRequest.findMany({
    where: { createdAt: { gte: report.range.from ? new Date(report.range.from) : new Date(0), lte: report.range.to ? new Date(report.range.to) : new Date('2999-12-31') } },
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { employeeId: true, firstName: true, lastName: true, department: true } } },
  });
  return rows.map((r) => ({
    RequestId: String(r.id),
    EmployeeId: r.employee.employeeId,
    Name: `${r.employee.firstName} ${r.employee.lastName}`,
    Department: r.employee.department ?? '',
    Type: r.leaveType,
    Start: r.startDate.toISOString().slice(0, 10),
    End: r.endDate.toISOString().slice(0, 10),
    Days: String(r.days),
    Status: r.status,
    Comment: r.adminComment ?? '',
    DecidedAt: r.decidedAt ? r.decidedAt.toISOString() : '',
  }));
}

export function payrollRows(report: Awaited<ReturnType<typeof payrollReport>>): Record<string, string>[] {
  return report.slips.map((s) => ({
    Period: s.period,
    EmployeeId: s.employee.employeeId,
    Name: `${s.employee.firstName} ${s.employee.lastName}`,
    Department: s.employee.department ?? '',
    Gross: s.gross.toString(),
    Net: s.net.toString(),
    Tax: (s.components as { tax?: number })?.tax?.toString?.() ?? '',
    IssuedAt: s.issuedAt.toISOString(),
  }));
}