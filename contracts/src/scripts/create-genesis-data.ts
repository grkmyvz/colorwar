import { PublicKey, Struct, UInt64 } from 'o1js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class Pixel extends Struct({
  id: UInt64,
  color: UInt64,
  painter: PublicKey,
  cost: UInt64,
  timestamp: UInt64,
}) {}

function createGenesisData() {
  const pixelArray = [];
  for (let i = 0; i < 1000; i++) {
    const pixel = new Pixel({
      id: UInt64.from(i),
      color: UInt64.from(87),
      painter: PublicKey.fromBase58(
        'B62qkfXKWTtEksquywuU1PBhKJJHd27PyMWuijfccrGF2VYpaKV5KZt'
      ),
      cost: UInt64.from(100000000),
      timestamp: UInt64.from(0),
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
