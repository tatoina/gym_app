const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const sizes = [192, 512];
const iconColor = { r: 0, g: 123, b: 255 }; // GymApp primary blue
const accentColor = { r: 255, g: 255, b: 255 }; // white accent for dumbbell stripe

function fillPng(png, size) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;

      const isStripe = x > size * 0.65 && x < size * 0.85 && y > size * 0.3 && y < size * 0.7;

      if (isStripe) {
        png.data[idx] = accentColor.r;
        png.data[idx + 1] = accentColor.g;
        png.data[idx + 2] = accentColor.b;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = iconColor.r;
        png.data[idx + 1] = iconColor.g;
        png.data[idx + 2] = iconColor.b;
        png.data[idx + 3] = 255;
      }
    }
  }
}

function createIcon(size) {
  const png = new PNG({ width: size, height: size, colorType: 2 });
  fillPng(png, size);

  const outputDir = path.resolve(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `icon-${size}.png`);

  png.pack().pipe(fs.createWriteStream(outputPath));
  console.log(`Generated ${outputPath}`);
}

sizes.forEach(createIcon);
