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

// ---------- WAV (16-bit PCM mono, harmonic beeps, peak -1 dBFS) ----------
const RATE = 44100;
const PEAK = 10 ** (-1 / 20); // -1 dBFS
const HARMONICS = [1, 0.8, 0.5]; // fundamental, 2nd, 3rd: keeps energy in 1.5-4 kHz on phone speakers

// One beep: 5 ms linear attack, exponential decay (~-40 dB by the end), 3 ms release.
function beep(freq, ms) {
  const n = Math.floor((ms / 1000) * RATE);
  const out = new Float64Array(n);
  const attack = RATE * 0.005;
  const release = RATE * 0.003;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    HARMONICS.forEach((a, h) => {
      v += a * Math.sin(2 * Math.PI * freq * (h + 1) * t);
    });
    const env = Math.min(1, i / attack) * Math.exp((-4.6 * i) / n) * Math.min(1, (n - i) / release);
    out[i] = v * env;
  }
  return out;
}

function wav(parts) {
  const raw = Float64Array.from(parts.flatMap((p) => [...(p.freq ? beep(p.freq, p.ms) : new Float64Array(Math.floor((p.ms / 1000) * RATE)))]));
  let max = 0;
  for (const v of raw) max = Math.max(max, Math.abs(v));
  const data = Buffer.alloc(raw.length * 2);
  raw.forEach((v, i) => data.writeInt16LE(Math.round((v / max) * PEAK * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// New order (1.2 s): rising two-tone, played twice.
const newOrder = [{ freq: 880, ms: 220 }, { freq: 0, ms: 40 }, { freq: 1175, ms: 300 }, { freq: 0, ms: 40 }];
writeFileSync(`${SOUND_DIR}/new-order.wav`, wav([...newOrder, ...newOrder]));
// Ready (1.6 s): urgent triple (short, short, long), played twice.
const ready = [
  { freq: 1320, ms: 140 }, { freq: 0, ms: 60 },
  { freq: 1320, ms: 140 }, { freq: 0, ms: 60 },
  { freq: 1760, ms: 200 }, { freq: 0, ms: 200 },
];
writeFileSync(`${SOUND_DIR}/ready.wav`, wav([...ready, ...ready]));

console.log('Generated icons + sounds.');
