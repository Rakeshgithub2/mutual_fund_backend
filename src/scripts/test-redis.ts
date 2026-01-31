#!/usr/bin/env node

/**
 * Redis Connection Test Script
 * Tests the Upstash Redis connection with proper TLS configuration
 */

import { Redis } from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const REDIS_URL = process.env.REDIS_URL;

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection...\n');

  if (!REDIS_URL) {
    console.error('❌ REDIS_URL not found in environment variables');
    return;
  }

  console.log('🔗 Redis URL:', REDIS_URL.replace(/:[^:@]*@/, ':****@'));

  try {
    // Test different Redis configurations
    const configs = [
      {
        name: 'Basic Configuration',
        config: {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
        },
      },
      {
        name: 'TLS Configuration',
        config: {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
          tls: {},
        },
      },
      {
        name: 'TLS + IPv4 Configuration',
        config: {
          maxRetriesPerRequest: 3,
          enableReadyCheck: false,
          lazyConnect: true,
          tls: {},
          family: 4,
        },
      },
      {
        name: 'Upstash Recommended Configuration',
        config: {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          tls: {},
          connectTimeout: 10000,
          lazyConnect: true,
        },
      },
    ];

    for (const { name, config } of configs) {
      console.log(`\n🔄 Testing: ${name}`);
      console.log('Config:', JSON.stringify(config, null, 2));

      try {
        const redis = new Redis(REDIS_URL, config);

        // Set up event listeners
        redis.on('connect', () => {
          console.log('✅ Connected successfully');
        });

        redis.on('error', (error) => {
          console.log('❌ Connection error:', error.message);
        });

        // Try to connect
        await redis.connect();

        // Test basic operations
        console.log('🧪 Testing basic operations...');

        // Set a test value
        await redis.set('test:connection', 'success', 'EX', 60);
        console.log('✅ SET operation successful');

        // Get the test value
        const value = await redis.get('test:connection');
        console.log('✅ GET operation successful:', value);

        // Delete the test value
        await redis.del('test:connection');
        console.log('✅ DEL operation successful');

        // Close connection
        await redis.quit();
        console.log('✅ Connection closed successfully');

        console.log(`\n🎉 ${name} - ALL TESTS PASSED!`);
        return; // Success, exit
      } catch (error: any) {
        console.log('❌ Test failed:', error.message);
        if (error.code) {
          console.log('   Error Code:', error.code);
        }
        if (error.syscall) {
          console.log('   System Call:', error.syscall);
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Alternative test using URL parsing
async function testWithUrlParsing() {
  console.log('\n🔍 Testing with URL parsing...');

  try {
    const url = new URL(REDIS_URL!);
    console.log('Host:', url.hostname);
    console.log('Port:', url.port);
    console.log('Username:', url.username);
    console.log('Password:', url.password ? '****' : 'None');

    const redis = new Redis({
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || 'default',
      password: url.password,
      tls: {},
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });

    await redis.connect();
    await redis.set('test:parsed', 'success');
    const value = await redis.get('test:parsed');
    await redis.del('test:parsed');
    await redis.quit();

    console.log('✅ URL parsing method successful!');
  } catch (error: any) {
    console.log('❌ URL parsing method failed:', error.message);
  }
}

// Check if running directly
if (require.main === module) {
  testRedisConnection()
    .then(() => testWithUrlParsing())
    .catch(console.error);
}

export { testRedisConnection };
