const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

async function generateIcons() {
  const assetsDir = path.join(__dirname, '../assets');
  const svgPath = path.join(assetsDir, 'icon.svg');

  try {
    // Generate PNG for Linux (512x512)
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));

    // Generate PNG for Windows in multiple sizes
    await sharp(svgPath)
      .resize(256, 256)
      .png()
      .toFile(path.join(assetsDir, 'icon_256.png'));

    await sharp(svgPath)
      .resize(128, 128)
      .png()
      .toFile(path.join(assetsDir, 'icon_128.png'));

    await sharp(svgPath)
      .resize(64, 64)
      .png()
      .toFile(path.join(assetsDir, 'icon_64.png'));

    await sharp(svgPath)
      .resize(32, 32)
      .png()
      .toFile(path.join(assetsDir, 'icon_32.png'));

    await sharp(svgPath)
      .resize(16, 16)
      .png()
      .toFile(path.join(assetsDir, 'icon_16.png'));

    // Convert to ICO using multiple PNG sizes
    const pngBuffers = await Promise.all([
      fs.promises.readFile(path.join(assetsDir, 'icon_256.png')),
      fs.promises.readFile(path.join(assetsDir, 'icon_128.png')),
      fs.promises.readFile(path.join(assetsDir, 'icon_64.png')),
      fs.promises.readFile(path.join(assetsDir, 'icon_32.png')),
      fs.promises.readFile(path.join(assetsDir, 'icon_16.png'))
    ]);

    const icoBuffer = await pngToIco(pngBuffers);
    await fs.promises.writeFile(path.join(assetsDir, 'icon.ico'), icoBuffer);

    // Generate ICNS for macOS using sharp (basic implementation)
    // For proper ICNS generation, you might need a more sophisticated tool
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(assetsDir, 'icon.icns'));

    // Clean up temporary files
    const tempFiles = ['icon_256.png', 'icon_128.png', 'icon_64.png', 'icon_32.png', 'icon_16.png'];
    for (const file of tempFiles) {
      await fs.promises.unlink(path.join(assetsDir, file));
    }

    console.log('Icons generated successfully!');
    console.log('Generated files:');
    console.log('- icon.ico (Windows)');
    console.log('- icon.icns (macOS)');
    console.log('- icon.png (Linux)');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();