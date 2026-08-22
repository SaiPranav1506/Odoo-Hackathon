import { prisma } from '../../lib/prisma';
import { parsePagination, buildMeta } from '../../utils/pagination';

export interface AuditEntryInput {
  actorUserId: number;
  subjectEmployeeId?: number | null;
  action: string;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}

export async function writeAudit(entry: AuditEntryInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      subjectEmployeeId: entry.subjectEmployeeId ?? null,
      action: entry.action,
      field: entry.field ?? null,
      oldValue: entry.oldValue === undefined ? undefined : (entry.oldValue as object),
      newValue: entry.newValue === undefined ? undefined : (entry.newValue as object),
      metadata: entry.metadata === undefined ? undefined : (entry.metadata as object),
    },
  });
}

export async function listForEmployee(employeeProfileId: number, query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = { subjectEmployeeId: employeeProfileId };
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