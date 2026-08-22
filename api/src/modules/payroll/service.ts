import { prisma } from '../../lib/prisma';
import { httpError } from '../../utils/apiError';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { currentMonthPeriod } from '../../utils/date';
import { writeAudit } from '../employees/audit.service';
import { createInApp } from '../notifications/service';
import { sendMail } from '../../lib/mailer';
import { Prisma } from '@prisma/client';

export interface StructureInput {
  basicPay: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: Record<string, number>;
  taxPercent?: number;
  otherDeductions?: Record<string, number>;
  effectiveFrom?: string;
}

// Validation for payroll accuracy/consistency: amounts must be >= 0, tax in [0,100].
function validateStructure(input: StructureInput) {
  const errors: Record<string, string[]> = {};
  if (!input.basicPay || input.basicPay < 0) errors.basicPay = ['must be a positive amount'];
  if (input.housingAllowance !== undefined && (input.housingAllowance < 0 || !isFinite(input.housingAllowance))) errors.housingAllowance = ['must be >= 0'];
  if (input.transportAllowance !== undefined && (input.transportAllowance < 0 || !isFinite(input.transportAllowance))) errors.transportAllowance = ['must be >= 0'];
  if (input.taxPercent !== undefined && (input.taxPercent < 0 || input.taxPercent > 100)) errors.taxPercent = ['must be between 0 and 100'];
  for (const [k, v] of Object.entries(input.otherAllowances ?? {})) {
    if (v < 0) errors[`otherAllowances.${k}`] = ['must be >= 0'];
  }
  for (const [k, v] of Object.entries(input.otherDeductions ?? {})) {
    if (v < 0) errors[`otherDeductions.${k}`] = ['must be >= 0'];
  }
  if (Object.keys(errors).length) throw httpError.validation(errors);
}

async function profileByUserId(userId: number) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    include: { salaryStructure: true, user: { select: { id: true, email: true, role: true } } },
  });
  if (!profile) throw httpError.notFound('Employee profile not found');
  return profile;
}

export async function myPayroll(userId: number) {
  const profile = await profileByUserId(userId);
  const payslips = await prisma.payslip.findMany({
    where: { employeeId: profile.id },
    orderBy: { period: 'desc' },
    take: 24,
  });
  return { profile: { employeeId: profile.employeeId, firstName: profile.firstName, lastName: profile.lastName, department: profile.department }, salaryStructure: profile.salaryStructure, payslips };
}

export async function adminList(query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const [items, total] = await Promise.all([
    prisma.salaryStructure.findMany({ orderBy: { employeeId: 'asc' }, skip, take }),
    prisma.salaryStructure.count(),
  ]);
  const withProfile = await Promise.all(
    items.map(async (s) => {
      const p = await prisma.employeeProfile.findUnique({
        where: { id: s.employeeId },
        select: { employeeId: true, firstName: true, lastName: true, department: true },
      });
      return { ...s, employee: p };
    }),
  );
  return { data: withProfile, meta: buildMeta(total, page, pageSize) };
}

export async function adminGet(employeeUserId: number) {
  const profile = await profileByUserId(employeeUserId);
  const payslips = await prisma.payslip.findMany({ where: { employeeId: profile.id }, orderBy: { period: 'desc' } });
  return { profile: { userId: profile.userId, employeeId: profile.employeeId, firstName: profile.firstName, lastName: profile.lastName, department: profile.department }, salaryStructure: profile.salaryStructure, payslips };
}

export async function updateStructure(args: { hrUserId: number; employeeUserId: number; input: StructureInput }) {
  validateStructure(args.input);
  const profile = await profileByUserId(args.employeeUserId);

  const existing = profile.salaryStructure;
  const data: Prisma.SalaryStructureUncheckedUpdateInput = {
    basicPay: new Prisma.Decimal(args.input.basicPay),
    housingAllowance: args.input.housingAllowance !== undefined ? new Prisma.Decimal(args.input.housingAllowance) : existing?.housingAllowance,
    transportAllowance: args.input.transportAllowance !== undefined ? new Prisma.Decimal(args.input.transportAllowance) : existing?.transportAllowance,
    taxPercent: args.input.taxPercent !== undefined ? new Prisma.Decimal(args.input.taxPercent) : existing?.taxPercent,
    effectiveFrom: args.input.effectiveFrom ? new Date(args.input.effectiveFrom) : existing?.effectiveFrom,
    otherAllowances: args.input.otherAllowances ?? (existing?.otherAllowances as object),
    otherDeductions: args.input.otherDeductions ?? (existing?.otherDeductions as object),
  };

  const updated = await prisma.salaryStructure.upsert({
    where: { employeeId: profile.id },
    create: {
      employeeId: profile.id,
      basicPay: data.basicPay as Prisma.Decimal,
      housingAllowance: data.housingAllowance as Prisma.Decimal | undefined,
      transportAllowance: data.transportAllowance as Prisma.Decimal | undefined,
      taxPercent: data.taxPercent as Prisma.Decimal | undefined,
      otherAllowances: data.otherAllowances,
      otherDeductions: data.otherDeductions,
      effectiveFrom: data.effectiveFrom,
    },
    update: data,
  });

  // Audit + notify + email that salary changed.
  await writeAudit({
    actorUserId: args.hrUserId,
    subjectEmployeeId: profile.id,
    action: 'SALARY_UPDATE',
    field: 'salaryStructure',
    oldValue: existing ? { basicPay: existing.basicPay.toString() } : null,
    newValue: { basicPay: updated.basicPay.toString() },
  });
  try {
    await createInApp({ recipientUserId: profile.userId, type: 'SALARY_UPDATED', title: 'Salary updated', body: 'Your salary structure was updated by HR.', link: '/payroll' });
    await sendMail({ to: profile.user.email, subject: 'Dayflow — Salary structure updated', text: 'Your salary structure has been updated by HR. Please review it in the portal.' });
  } catch {
    // best-effort
  }

  return updated;
}

/** Compute payslip amounts from a structure. */
export function computePayslip(structure: {
  basicPay: Prisma.Decimal;
  housingAllowance: Prisma.Decimal | null;
  transportAllowance: Prisma.Decimal | null;
  taxPercent: Prisma.Decimal | null;
  otherAllowances?: unknown;
  otherDeductions?: unknown;
}) {
  const num = (v: Prisma.Decimal | null | undefined) => (v ? Number(v) : 0);
  const basic = num(structure.basicPay);
  const housing = num(structure.housingAllowance);
  const transport = num(structure.transportAllowance);
  const otherAllow = (structure.otherAllowances as Record<string, number>) ?? {};
  const otherDeduc = (structure.otherDeductions as Record<string, number>) ?? {};
  const allowancesSum = Object.values(otherAllow).reduce((a, b) => a + Number(b) || 0, 0);
  const deductionsSum = Object.values(otherDeduc).reduce((a, b) => a + Number(b) || 0, 0);
  const gross = basic + housing + transport + allowancesSum;
  const tax = (num(structure.taxPercent) / 100) * gross;
  const net = gross - tax - deductionsSum;
  const components = { basic, housingAllowance: housing, transportAllowance: transport, otherAllowances: otherAllow, tax: Number(tax.toFixed(2)), otherDeductions: otherDeduc };
  return { gross: Number(gross.toFixed(2)), net: Number(net.toFixed(2)), components };
}

export async function generatePayslip(args: { hrUserId: number; employeeUserId: number; period?: string }) {
  const period = args.period ?? currentMonthPeriod();
  if (!/^\d{4}-\d{2}$/.test(period)) throw httpError.badRequest('Period must be YYYY-MM');

  const profile = await profileByUserId(args.employeeUserId);
  if (!profile.salaryStructure) throw httpError.badRequest('Employee has no salary structure yet');

  const [dup] = await prisma.payslip.findMany({ where: { employeeId: profile.id, period } });
  if (dup) throw httpError.conflict('A payslip for this period already exists');

  const sl = profile.salaryStructure;
  const computed = computePayslip(sl);

  const slip = await prisma.payslip.create({
    data: {
      employeeId: profile.id,
      period,
      gross: new Prisma.Decimal(computed.gross),
      net: new Prisma.Decimal(computed.net),
      components: computed.components as object,
    },
  });

  try {
    await createInApp({ recipientUserId: profile.userId, type: 'PAYSLIP_ISSUED', title: 'Payslip issued', body: `Your payslip for ${period} is available.`, link: '/payroll' });
  } catch {
    // best-effort
  }

  return slip;
}