import { prisma } from '../../lib/prisma';
import type { NotificationType } from '@prisma/client';
import { httpError } from '../../utils/apiError';
import { parsePagination, buildMeta } from '../../utils/pagination';

export async function createInApp(args: {
  recipientUserId: number;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      recipientUserId: args.recipientUserId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
    },
  });
}

export async function listForUser(userId: number, query: Record<string, unknown>) {
  const { skip, take, page, pageSize } = parsePagination(query);
  const where = { recipientUserId: userId };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
  ]);
  return { data: items, meta: buildMeta(total, page, pageSize) };
}

export async function unreadCount(userId: number): Promise<number> {
  return prisma.notification.count({
    where: { recipientUserId: userId, readAt: null },
  });
}

export async function markOneRead(userId: number, notificationId: number): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, recipientUserId: userId },
  });
  if (!existing) throw httpError.notFound('Notification not found');
  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}