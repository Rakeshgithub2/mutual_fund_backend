import { PrismaClient } from '@prisma/client';
import { mongodb } from './mongodb';

// Initialize Prisma Client
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Re-export MongoDB instance for backward compatibility
export { mongodb };

// For code that uses 'prisma', provide mongodb instance
export const db = mongodb;
