#!/usr/bin/env node

/**
 * Pre-Deployment Checklist Script
 * Verifies everything is ready for production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 PRE-DEPLOYMENT CHECKLIST\n');
console.log('═'.repeat(60));

let errors = 0;
let warnings = 0;
let passed = 0;

function check(name, condition, errorMsg) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${name}`);
    if (errorMsg) console.log(`   ${errorMsg}`);
    errors++;
    return false;
  }
}

function warn(name, condition, warnMsg) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
    return true;
  } else {
    console.log(`⚠️  ${name}`);
    if (warnMsg) console.log(`   ${warnMsg}`);
    warnings++;
    return false;
  }
}

// Check 1: vercel.json exists and has correct structure
console.log('\n📦 Configuration Files:');
const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
let vercelConfig = null;
try {
  vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  check('vercel.json exists', true);

  const hasUnifiedRouting =
    vercelConfig.routes &&
    vercelConfig.routes.some(
      (r) => r.src === '/(.*)',
      r.dest === 'api/index.ts'
    );

  check(
    'vercel.json uses unified routing',
    hasUnifiedRouting,
    'Update vercel.json to route all requests to api/index.ts'
  );

  const hasMaxDuration =
    vercelConfig.builds && vercelConfig.builds[0]?.config?.maxDuration >= 60;

  warn(
    'vercel.json has maxDuration >= 60s',
    hasMaxDuration,
    'Consider adding maxDuration: 60 for slow first connections'
  );
} catch (error) {
  check('vercel.json exists', false, 'File not found or invalid JSON');
}

// Check 2: api/index.ts imports unified routes
console.log('\n🔌 Route Configuration:');
const apiIndexPath = path.join(__dirname, '..', 'api', 'index.ts');
try {
  const apiIndexContent = fs.readFileSync(apiIndexPath, 'utf8');

  check(
    'api/index.ts imports unified routes',
    apiIndexContent.includes("import routes from '../src/routes'"),
    'Update api/index.ts to import routes from ../src/routes'
  );

  check(
    'api/index.ts uses src/db/mongodb',
    apiIndexContent.includes("from '../src/db/mongodb'"),
    'Update to use ../src/db/mongodb instead of ./db/mongodb'
  );

  check(
    'api/index.ts mounts routes at /api',
    apiIndexContent.includes("app.use('/api', routes)"),
    "Add: app.use('/api', routes)"
  );
} catch (error) {
  check('api/index.ts exists', false, 'File not found');
}

// Check 3: MongoDB connection has global cache
console.log('\n💾 MongoDB Configuration:');
const mongodbPath = path.join(__dirname, '..', 'src', 'db', 'mongodb.ts');
try {
  const mongodbContent = fs.readFileSync(mongodbPath, 'utf8');

  check(
    'MongoDB has global connection cache',
    mongodbContent.includes('cachedClient') &&
      mongodbContent.includes('cachedDb'),
    'Global cache not found - connection pooling may not work'
  );

  check(
    'MongoDB has connection pooling options',
    mongodbContent.includes('maxPoolSize'),
    'Add MONGO_OPTIONS with maxPoolSize for better performance'
  );

  check(
    'MongoDB has timing logs',
    mongodbContent.includes('[MONGO]'),
    'Add performance logging for monitoring'
  );
} catch (error) {
  check('src/db/mongodb.ts exists', false, 'File not found');
}

// Check 4: Routes are properly registered
console.log('\n🛣️  Route Registration:');
const routesIndexPath = path.join(__dirname, '..', 'src', 'routes', 'index.ts');
try {
  const routesContent = fs.readFileSync(routesIndexPath, 'utf8');

  check(
    'Holdings routes registered',
    routesContent.includes("router.use('/holdings'"),
    "Add: router.use('/holdings', holdingsRoutes)"
  );

  check(
    'Search routes registered',
    routesContent.includes("router.use('/search'"),
    "Add: router.use('/search', searchRoutes)"
  );

  check(
    'Market indices routes registered',
    routesContent.includes("router.use('/market-indices'"),
    'Market indices routes should be registered'
  );
} catch (error) {
  check('src/routes/index.ts exists', false, 'File not found');
}

// Check 5: Market indices service
console.log('\n📈 Market Indices Service:');
const marketServicePath = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'productionMarketIndices.service.ts'
);
try {
  const marketServiceContent = fs.readFileSync(marketServicePath, 'utf8');

  check('Market indices service exists', true, '');

  check(
    'Has in-memory caching',
    marketServiceContent.includes('cache: Map'),
    'Service should have Map-based caching'
  );

  check(
    'Has TTL configuration',
    marketServiceContent.includes('CACHE_TTL'),
    'Service should have cache TTL settings'
  );

  check(
    'Has Yahoo Finance integration',
    marketServiceContent.includes('yahoo') ||
      marketServiceContent.includes('query1.finance'),
    'Service should fetch from Yahoo Finance'
  );
} catch (error) {
  warn(
    'Production market indices service exists',
    false,
    'File not found - may use legacy service'
  );
}

// Check 6: Database indexes script
console.log('\n📊 Database Optimization:');
const indexesScriptPath = path.join(
  __dirname,
  '..',
  'src',
  'scripts',
  'setup-indexes.ts'
);
warn(
  'Database indexes script exists',
  fs.existsSync(indexesScriptPath),
  'Run: npm run setup:indexes before first deployment'
);

// Check 7: Environment variables template
console.log('\n🔐 Environment Configuration:');
const envExamplePath = path.join(__dirname, '..', '.env.example');
warn(
  '.env.example exists',
  fs.existsSync(envExamplePath),
  'Create .env.example with required variables'
);

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');

  check(
    'DATABASE_URL is set',
    envContent.includes('DATABASE_URL='),
    'Set MongoDB connection string'
  );

  check(
    'JWT_SECRET is set',
    envContent.includes('JWT_SECRET='),
    'Set JWT secret'
  );

  console.log('\n⚠️  Remember to set these in Vercel Dashboard:');
  console.log('   - DATABASE_URL');
  console.log('   - JWT_SECRET');
  console.log('   - JWT_REFRESH_SECRET');
  console.log('   - FRONTEND_URL');
  console.log('   - ALLOWED_ORIGINS');
  console.log('   - NODE_ENV=production');
}

// Check 8: Package.json scripts
console.log('\n📜 NPM Scripts:');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  check('Has build script', !!packageJson.scripts?.build, 'Add build script');

  check(
    'Has vercel-build script',
    !!packageJson.scripts?.['vercel-build'],
    'Add vercel-build script'
  );

  warn(
    'Has setup:indexes script',
    !!packageJson.scripts?.['setup:indexes'],
    'Add npm script for database indexes'
  );

  warn(
    'Has verify:production script',
    !!packageJson.scripts?.['verify:production'],
    'Add verification script for testing after deployment'
  );
} catch (error) {
  check('package.json exists', false, 'File not found');
}

// Summary
console.log('\n═'.repeat(60));
console.log('📊 SUMMARY');
console.log('═'.repeat(60));
console.log(`✅ Passed:   ${passed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Errors:   ${errors}`);
console.log('═'.repeat(60));

if (errors > 0) {
  console.log('\n❌ FAILED - Fix errors before deploying');
  console.log('\nRead DEPLOYMENT_VERIFICATION.md for detailed fixes\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️  WARNINGS - Review before deploying');
  console.log('\nRead DEPLOYMENT_VERIFICATION.md for recommendations\n');
  process.exit(0);
} else {
  console.log('\n✅ READY TO DEPLOY!');
  console.log('\nNext steps:');
  console.log('1. npm run setup:indexes (one-time)');
  console.log('2. Set environment variables in Vercel Dashboard');
  console.log('3. vercel --prod');
  console.log('4. npm run verify:production\n');
  process.exit(0);
}
