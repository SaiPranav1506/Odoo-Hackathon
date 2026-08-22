import { prisma } from '../../lib/prisma';
import { todayDateOnly, addDays } from '../../utils/date';

function publicProfile(profile: { employeeId: string; firstName: string; lastName: string; department?: string | null; jobTitle?: string | null }) {
  return { employeeId: profile.employeeId, firstName: profile.firstName, lastName: profile.lastName, department: profile.department, jobTitle: profile.jobTitle };
}

/** Employee dashboard: quick-action data + recent activity/alerts feed. */
export async function employeeDashboard(userId: number) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    include: { leaveBalance: true },
  });
  if (!profile) return { user: null, profile: null, today: null, activity: [], unreadNotifications: 0 };

  const today = todayDateOnly();
  const now = new Date();

  const [todayRecord, unreadNotifications, recentLeave, recentAttendance, pendingLeave] = await Promise.all([
    prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: profile.id, date: today } } }),
    prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }),
    prisma.leaveRequest.findMany({ where: { employeeId: profile.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.attendanceRecord.findMany({ where: { employeeId: profile.id }, orderBy: { date: 'desc' }, take: 7 }),
    prisma.leaveRequest.count({ where: { employeeId: profile.id, status: 'PENDING' } }),
  ]);

  const activity = [] as { type: string; title: string; time: string }[];
  for (const l of recentLeave) activity.push({ type: 'leave', title: `${l.leaveType} leave ${l.status.toLowerCase()} — ${l.startDate.toISOString().slice(0, 10)} to ${l.endDate.toISOString().slice(0, 10)}`, time: l.updatedAt.toISOString() });
  for (const a of recentAttendance) activity.push({ type: 'attendance', title: `Attendance ${a.status}: ${a.date.toISOString().slice(0, 10)}`, time: a.updatedAt.toISOString?.() ?? a.date.toISOString() });

  return {
    user: { userId }, // profile guard: employee dashboard resolves everything from own profile
    profile: publicProfile(profile),
    today: {
      date: today.toISOString().slice(0, 10),
      checkedIn: !!todayRecord?.checkInTime,
      checkedOut: !!todayRecord?.checkOutTime,
      status: todayRecord?.status ?? 'none',
      checkInTime: todayRecord?.checkInTime ?? null,
      checkOutTime: todayRecord?.checkOutTime ?? null,
      serverNow: now.toISOString(),
    },
    leaveBalance: profile.leaveBalance
      ? { paidUsed: profile.leaveBalance.paidDaysUsed, paidAvailable: Math.max(0, profile.leaveBalance.paidDaysEntitled - profile.leaveBalance.paidDaysUsed) }
      : null,
    pendingLeave,
    unreadNotifications,
    activity: activity.slice(0, 10),
  };
}

/** Admin/HR dashboard overview. */
export async function adminDashboard() {
  const today = todayDateOnly();
  const map = (rows: { status: string; _count: { _all: number } }[]) => {
    const out = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0 } as Record<string, number>;
    for (const r of rows) out[r.status] = r._count._all;
    return out;
  };
  const [counts, todayRows, pendingLeave, weekRows, departments, unverified] = await Promise.all([
    prisma.$transaction([
      prisma.employeeProfile.count({ where: { status: 'ACTIVE' } }),
      prisma.employeeProfile.count({ where: { status: 'INACTIVE' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
    ]),
    prisma.attendanceRecord.groupBy({ by: ['status'], where: { date: today }, _count: { _all: true } }),
    prisma.leaveRequest.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 20, include: { employee: { select: { employeeId: true, firstName: true, lastName: true, department: true, userId: true } } } }),
    prisma.attendanceRecord.groupBy({ by: ['status', 'date'], where: { date: { gte: addDays(today, -6), lte: today } }, _count: { _all: true } }),
    prisma.employeeProfile.groupBy({ by: ['department'] }),
    prisma.user.count({ where: { emailVerifiedAt: null } }),
  ]);

  return {
    counts: { activeEmployees: counts[0], inactiveEmployees: counts[1], pendingLeaveApprovals: counts[2], unverifiedAccounts: unverified },
    attendanceToday: map(todayRows),
    departments: departments.filter((d) => d.department).map((d) => d.department),
    pendingLeave,
    weekAttendance: weekRows,
    updatedAt: new Date().toISOString(),
  };
}