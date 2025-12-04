const { notarize } = require('@electron/notarize');
const path = require('path');

/**
 * Notarize the macOS application with Apple
 * @param {Object} params - Build parameters from electron-builder
 * @param {string} params.electronPlatformName - Platform name (darwin, win32, linux)
 * @param {string} params.appOutDir - Output directory of the built app
 */
module.exports = async function (params) {
  const { electronPlatformName, appOutDir } = params;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('Skipping notarization: not a macOS build');
    return;
  }

  // Validate required environment variables
  const requiredEnvVars = ['APPLE_ID', 'APPLE_ID_PASSWORD', 'APPLE_TEAM_ID'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(
      `Skipping notarization: missing environment variables: ${missingVars.join(', ')}`
    );
    return;
  }

  const appName = 'CryptoCast';
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log('Starting notarization process...');
  console.log(`App path: ${appPath}`);

  try {
    await notarize({
      appBundleId: 'com.cryptocast.desktop',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });

    console.log('Notarization completed successfully!');
  } catch (error) {
    console.error('Notarization failed:', error.message);
    throw error;
  }
};