const fs = require('fs');
const path = require('path');

/**
 * Copy all .js files from source to dist, preserving directory structure
 */
function copyJsFiles(srcDir, distDir) {
  const items = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const distPath = path.join(distDir, item.name);

    if (item.isDirectory()) {
      // Skip node_modules, dist, and hidden folders
      if (
        item.name === 'node_modules' ||
        item.name === 'dist' ||
        item.name.startsWith('.')
      ) {
        continue;
      }

      // Create directory in dist if it doesn't exist
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }

      // Recursively copy from subdirectory
      copyJsFiles(srcPath, distPath);
    } else if (item.isFile() && item.name.endsWith('.js')) {
      // Copy .js file
      fs.copyFileSync(srcPath, distPath);
      console.log(`Copied: ${srcPath} -> ${distPath}`);
    }
  }
}

// Copy from root and src folders
const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

console.log('Copying .js files to dist...');

// Copy root-level folders
['services', 'jobs', 'workers', 'routes', 'cron', 'api'].forEach((folder) => {
  const srcPath = path.join(rootDir, folder);
  const destPath = path.join(distDir, folder);

  if (fs.existsSync(srcPath)) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    copyJsFiles(srcPath, destPath);
  }
});

// Copy .js files from src folder (for files like fund-v2.controller.js)
const srcPath = path.join(rootDir, 'src');
const srcDistPath = path.join(distDir, 'src');

if (fs.existsSync(srcPath) && fs.existsSync(srcDistPath)) {
  copyJsFiles(srcPath, srcDistPath);
}

console.log('✅ All .js files copied successfully!');
