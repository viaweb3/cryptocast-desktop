const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting CI build process...');

try {
  // Set environment variables for CI
  process.env.ELECTRON_SKIP_BINARY_DOWNLOAD = '1';
  process.env.NODE_ENV = 'production';

  // Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  if (fs.existsSync('dist')) {
    execSync('rm -rf dist', { stdio: 'inherit' });
  }
  if (fs.existsSync('release')) {
    execSync('rm -rf release', { stdio: 'inherit' });
  }

  // Compile TypeScript for main process
  console.log('📝 Compiling TypeScript...');
  execSync('npx tsc --project tsconfig.main.json', { stdio: 'inherit' });

  // Build renderer with Vite
  console.log('⚡ Building renderer...');
  execSync('npx vite build', { stdio: 'inherit' });

  // Rebuild native modules for current platform
  console.log('🔧 Rebuilding native modules...');
  try {
    execSync('npm rebuild', { stdio: 'inherit' });
  } catch (error) {
    console.warn('⚠️  Native module rebuild failed, continuing...');
  }

  // Build Electron app
  console.log('📦 Building Electron app...');
  const buildCommand = process.platform === 'linux' ? 'npm run build:linux' :
                      process.platform === 'win32' ? 'npm run build:win' :
                      'npm run build:mac';

  execSync(buildCommand, { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');

  // List built files
  if (fs.existsSync('release')) {
    console.log('📁 Built files:');
    const files = fs.readdirSync('release');
    files.forEach(file => {
      const filePath = path.join('release', file);
      const stats = fs.statSync(filePath);
      console.log(`  - ${file} (${Math.round(stats.size / 1024)} KB)`);
    });
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}