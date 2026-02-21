"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.mongodb = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const mongodb_1 = require("./mongodb");
Object.defineProperty(exports, "mongodb", { enumerable: true, get: function () { return mongodb_1.mongodb; } });
// Initialize Prisma Client
exports.prisma = new client_1.PrismaClient({
    log: ['error', 'warn'],
});
// Graceful shutdown
process.on('beforeExit', async () => {
    await exports.prisma.$disconnect();
});
// For code that uses 'prisma', provide mongodb instance
exports.db = mongodb_1.mongodb;
