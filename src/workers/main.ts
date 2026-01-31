import { scheduler } from '../services/scheduler';

// Start the scheduler
scheduler.start();

console.log('Worker process started with scheduler');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});
