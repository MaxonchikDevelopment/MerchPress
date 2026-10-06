// Checks the alert WAVs against the Gdansk loudness/spectrum targets (plain Node, no deps).
// Run: node scripts/check-sounds.mjs   (exit 1 on any failed check)
// Prints measurements for the committed-before version (git show $BEFORE_REF, default HEAD, so use BEFORE_REF=main once committed) and the files on disk.
// This measures signal properties only. Audibility is verified on devices.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILES = ['new-order', 'ready'];

function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV');
  let off = 12, rate = 0, bits = 0, ch = 0, data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') { ch = buf.readUInt16LE(off + 10); rate = buf.readUInt32LE(off + 12); bits = buf.readUInt16LE(off + 22); }
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!data || bits !== 16 || ch !== 1) throw new Error('expected 16-bit mono PCM');
  const s = new Int16Array(data.length / 2);
  for (let i = 0; i < s.length; i++) s[i] = data.readInt16LE(i * 2);
  return { rate, samples: s };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = i + k + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
}

// Share of spectral energy (0 to Nyquist, Hann windows of 2048, hop 1024) that falls in 1.5-4 kHz.
function bandShare(samples, rate) {
  const N = 2048;
  let band = 0, total = 0;
  for (let st = 0; st + N <= samples.length; st += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (samples[st + i] / 32768) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * rate) / N, e = re[k] ** 2 + im[k] ** 2;
      total += e;
      if (f >= 1500 && f <= 4000) band += e;
    }
  }
  return total ? band / total : 0;
}

// Beep bursts: 5 ms RMS windows above 10% of the loudest window; gaps under 15 ms are merged.
function bursts(samples, rate) {
  const w = Math.round(rate * 0.005), rms = [];
  for (let i = 0; i + w <= samples.length; i += w) {
    let s = 0;
    for (let j = 0; j < w; j++) s += (samples[i + j] / 32768) ** 2;
    rms.push(Math.sqrt(s / w));
  }
  const th = Math.max(...rms) * 0.1;
  const on = rms.map((v) => v > th), found = [];
  let start = -1, lastOn = -1;
  for (let i = 0; i <= on.length; i++) {
    if (i < on.length && on[i]) { if (start < 0) start = i; lastOn = i; }
    else if (start >= 0 && (i === on.length || i - lastOn > 3)) { found.push([start * 5, (lastOn + 1) * 5]); start = -1; }
  }
  return found;
}

function measure(buf) {
  const { rate, samples } = parseWav(buf);
  let peak = 0, clipped = 0;
  for (const v of samples) { peak = Math.max(peak, Math.abs(v)); if (v >= 32767 || v <= -32768) clipped++; }
  const b = bursts(samples, rate);
  return {
    rate, bytes: buf.length,
    peakDb: 20 * Math.log10(peak / 32768),
    clipped,
    dur: samples.length / rate,
    band: bandShare(samples, rate),
    bursts: b.length,
    rhythm: b.map(([s]) => s).join(','),
  };
}

function show(label, name, m) {
  console.log(`${label.padEnd(7)} ${name.padEnd(10)} peak ${m.peakDb.toFixed(2)} dBFS | clipped ${m.clipped} | ${m.dur.toFixed(2)} s | 1.5-4 kHz ${(m.band * 100).toFixed(1)}% | bursts ${m.bursts} | ${(m.bytes / 1024).toFixed(0)} KB`);
}

const after = {};
for (const n of FILES) {
  try {
    const old = measure(execFileSync('git', ['show', `${process.env.BEFORE_REF || 'HEAD'}:public/sounds/${n}.wav`], { maxBuffer: 1 << 24 }));
    show('before', n, old);
  } catch { console.log(`before  ${n}: not available from git`); }
}
for (const n of FILES) { after[n] = measure(readFileSync(`public/sounds/${n}.wav`)); show('after', n, after[n]); }

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
for (const n of FILES) {
  const m = after[n];
  check(m.rate === 44100, `${n}: sample rate ${m.rate}`);
  check(m.peakDb >= -1.5 && m.peakDb <= -0.5, `${n}: peak ${m.peakDb.toFixed(2)} dBFS outside -1.5..-0.5`);
  check(m.clipped === 0, `${n}: ${m.clipped} clipped samples`);
  check(m.band >= 0.3, `${n}: only ${(m.band * 100).toFixed(1)}% energy in 1.5-4 kHz`);
  check(m.bytes < 200 * 1024, `${n}: ${m.bytes} bytes, over 200 KB`);
}
check(after['new-order'].dur >= 1.0 && after['new-order'].dur <= 1.5, `new-order duration ${after['new-order'].dur.toFixed(2)} s outside 1.0..1.5`);
check(after.ready.dur >= 1.4 && after.ready.dur <= 2.0, `ready duration ${after.ready.dur.toFixed(2)} s outside 1.4..2.0`);
check(after['new-order'].bursts !== after.ready.bursts || after['new-order'].rhythm !== after.ready.rhythm, 'files have the same burst count and rhythm');

if (fails.length) { console.error('\nFAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\nOK: all checks passed (signal properties only; audibility is verified on devices).');
