/**
 * PM2 Ecosystem Configuration
 * Production-grade process management for AWS EC2 deployment
 */

module.exports = {
  apps: [
    {
      name: 'mutual-funds-backend',
      script: './dist/src/index.js',
      instances: 2, // Use 2 instances for load balancing
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
      // Auto-restart settings
      watch: false, // Don't watch in production
      max_memory_restart: '500M',

      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Restart strategy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 5000,

      // Environment variables
      env_file: '.env.production',
    },
  ],
};
