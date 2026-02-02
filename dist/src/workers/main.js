"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scheduler_1 = require("../services/scheduler");
// Start the scheduler
scheduler_1.scheduler.start();
console.log('Worker process started with scheduler');
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    scheduler_1.scheduler.stop();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    scheduler_1.scheduler.stop();
    process.exit(0);
});
