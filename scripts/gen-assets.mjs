// Generates placeholder PWA icons (PNG) and notification sounds (WAV).
// Run: node scripts/gen-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ICON_DIR = 'public/icons';
const SOUND_DIR = 'public/sounds';
mkdirSync(ICON_DIR, { recursive: true });
mkdirSync(SOUND_DIR, { recursive: true });

// ---------- PNG (solid color with a lighter square) ----------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function png(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const inset = Math.floor(size / 4);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter
    for (let x = 0; x < size; x++) {
      const o = y * (size * 3 + 1) + 1 + x * 3;
      const sq = x > inset && x < size - inset && y > inset && y < size - inset;
      // brand dark bg, blue accent square
      raw[o] = sq ? 0x25 : 0x0f;
      raw[o + 1] = sq ? 0x63 : 0x11;
      raw[o + 2] = sq ? 0xeb : 0x15;
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
writeFileSync(`${ICON_DIR}/icon-192.png`, png(192));
writeFileSync(`${ICON_DIR}/icon-512.png`, png(512));

// ---------- WAV (16-bit PCM mono beep sequence) ----------
function wav(beeps) {
  const rate = 44100;
  const samples = [];
  for (const b of beeps) {
    const n = Math.floor((b.ms / 1000) * rate);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const env = Math.min(1, Math.min(i, n - i) / (rate * 0.01)); // 10ms fade
      samples.push(b.freq ? Math.sin(2 * Math.PI * b.freq * t) * env * 0.6 : 0);
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// New order: two rising beeps. Ready: three urgent beeps.
writeFileSync(`${SOUND_DIR}/new-order.wav`, wav([
  { freq: 660, ms: 140 }, { freq: 0, ms: 60 }, { freq: 880, ms: 180 },
]));
writeFileSync(`${SOUND_DIR}/ready.wav`, wav([
  { freq: 988, ms: 130 }, { freq: 0, ms: 70 },
  { freq: 988, ms: 130 }, { freq: 0, ms: 70 },
  { freq: 1319, ms: 260 },
]));

console.log('Generated icons + sounds.');
