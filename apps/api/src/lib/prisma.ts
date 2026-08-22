import { PrismaClient } from '@prisma/client';

// Single PrismaClient instance reused across the API.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});