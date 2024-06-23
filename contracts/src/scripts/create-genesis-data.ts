import { PublicKey, Struct, UInt32, UInt64 } from 'o1js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class Pixel extends Struct({
  id: UInt64,
  color: UInt64,
  painter: PublicKey,
  cost: UInt64,
  blockLength: UInt32,
}) {}

function createGenesisData() {
  const colors = [
    { color: 'red', code: 114 },
    { color: 'blue', code: 98 },
    { color: 'yellow', code: 121 },
    { color: 'green', code: 103 },
  ];

  const colorCodes: number[] = [];
  colors.forEach((color) => {
    for (let i = 0; i < 256; i++) {
      colorCodes.push(color.code);
    }
  });

  colorCodes.sort(() => Math.random() - 0.5);

  const pixelArray = [];
  for (let i = 0; i < 1024; i++) {
    const pixel = new Pixel({
      id: UInt64.from(i),
      color: UInt64.from(colorCodes[i]),
      painter: PublicKey.fromBase58(
        'B62qrfQvCh21fCBPtEDQzYcajGaPobJQBowRYLjuFgPm1Xn8Z3LBdna'
      ),
      cost: UInt64.from(100000000),
      blockLength: UInt32.from(0),
    });
    pixelArray.push(pixel);
  }
  return pixelArray;
}

function main() {
  const pixels = createGenesisData();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const outputDir = path.resolve(__dirname, '../output');
  const outputPath = path.join(outputDir, 'genesis-data.json');

  // Output directory yoksa oluştur
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(pixels));
  console.log(`Genesis data written to ${outputPath}`);
}

main();
