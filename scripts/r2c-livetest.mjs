// Live check of round 2C (per-event shirt options, design hide/show, photo
// upload rules, design delete protection) against the real Supabase project.
// Uses the anon key from .env.local. Creates an INACTIVE throwaway event
// "ZZ-R2C-TEST", removes its orders, designs, storage objects and the event in
// a finally block, and confirms nothing is left behind.
//
// Run: node scripts/r2c-livetest.mjs
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!/^https?:\/\//i.test(url ?? '') || !key || key.includes('[SENSITIVE]')) {
  console.error('.env.local needs a real VITE_SUPABASE_URL (http/https) and VITE_SUPABASE_ANON_KEY.');
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const EVENT_NAME = 'ZZ-R2C-TEST';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};

// A valid 8x8 RGBA PNG, built by hand so the test needs no image library.
function tinyPng() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const w = 8;
  const h = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = 197; raw[o + 1] = 255; raw[o + 3] = 255; // opaque lime
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// jsonb does not keep object key order, so compare with sorted keys.
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));

const bucket = () => sb.storage.from('designs');
const listFolder = async (eventId) => must(await bucket().list(eventId), 'list storage folder');

let eventId = null;
try {
  const stale = must(await sb.from('events').select('id').eq('name', EVENT_NAME), 'pre-check');
  if (stale.length) throw new Error(`${stale.length} leftover "${EVENT_NAME}" event(s) exist; clean up first`);

  const ev = must(
    await sb.from('events').insert({ name: EVENT_NAME, is_active: false }).select().single(),
    'insert event',
  );
  eventId = ev.id;
  check('throwaway event is inactive', ev.is_active === false);

  // 1. shirt_colors / shirt_sizes round-trip
  const colors = [
    { key: 'white', label: 'Snow', hex: '#ffffff' },
    { key: 'sand-2', label: 'Sand', hex: '#c2b280' },
  ];
  const sizes = ['S', 'M', 'XL'];
  must(await sb.from('events').update({ shirt_colors: colors, shirt_sizes: sizes }).eq('id', eventId), 'update options');
  const back = must(await sb.from('events').select('shirt_colors, shirt_sizes').eq('id', eventId).single(), 'read options');
  check('shirt_colors round-trips', canon(back.shirt_colors) === canon(colors));
  check('shirt_sizes round-trips', JSON.stringify(back.shirt_sizes) === JSON.stringify(sizes));
  must(await sb.from('events').update({ shirt_colors: null, shirt_sizes: null }).eq('id', eventId), 'reset options');
  const reset = must(await sb.from('events').select('shirt_colors, shirt_sizes').eq('id', eventId).single(), 'read reset');
  check('options reset to null (app defaults)', reset.shirt_colors === null && reset.shirt_sizes === null);

  // 2. a design can be hidden and shown
  const design = must(
    await sb.from('designs').insert({ event_id: eventId, name: 'ZZ design', type: 'big', compatible_colors: ['white'] }).select().single(),
    'insert design',
  );
  check('new design is active by default', design.is_active === true);
  must(await sb.from('designs').update({ is_active: false }).eq('id', design.id), 'hide');
  const hidden = must(await sb.from('designs').select('is_active').eq('id', design.id).single(), 'read hidden');
  check('design can be hidden', hidden.is_active === false);
  must(await sb.from('designs').update({ is_active: true }).eq('id', design.id), 'show');
  const shown = must(await sb.from('designs').select('is_active').eq('id', design.id).single(), 'read shown');
  check('design can be shown again', shown.is_active === true);

  // 3. a small PNG uploads under the event folder and is removed
  const pngPath = `${eventId}/${randomUUID()}-front.png`;
  const up = await bucket().upload(pngPath, tinyPng(), { contentType: 'image/png', upsert: false });
  check('PNG upload accepted', !up.error, up.error?.message);
  const inFolder = (await listFolder(eventId)).some((o) => pngPath.endsWith(o.name));
  check('PNG is listed under the event folder', inFolder);
  const rm = await bucket().remove([pngPath]);
  check('PNG removed', !rm.error, rm.error?.message);
  const stillThere = (await listFolder(eventId)).some((o) => pngPath.endsWith(o.name));
  check('PNG is gone after removal', !stillThere);

  // 4. a text file is rejected by the bucket
  const txtPath = `${eventId}/${randomUUID()}-notes.txt`;
  const txt = await bucket().upload(txtPath, new Blob(['not an image'], { type: 'text/plain' }), {
    contentType: 'text/plain',
    upsert: false,
  });
  check('text file rejected by the bucket', !!txt.error, txt.error?.message ?? 'accepted!');

  // 5. a design used by an order cannot be deleted, but can be hidden
  const used = must(
    await sb.from('designs').insert({ event_id: eventId, name: 'ZZ used design', type: 'small', compatible_colors: [] }).select().single(),
    'insert used design',
  );
  const order = must(
    await sb.rpc('create_order_v2', {
      p_event_id: eventId,
      p_shirt_color: 'black',
      p_shirt_size: 'M',
      p_design_front_id: used.id,
      p_design_back_id: null,
      p_client_name: 'r2c-test',
      p_created_by: null,
      p_cashier_key: 'r2c-test',
      p_cashier_name: 'r2c-test',
      p_client_request_id: randomUUID(),
    }),
    'create order',
  );
  check('order references the design', order.design_front_id === used.id);
  const del = await sb.from('designs').delete().eq('id', used.id);
  check('delete of a used design is refused (23503)', del.error?.code === '23503', del.error ? `${del.error.code}: ${del.error.message}` : 'deleted!');
  const kept = must(await sb.from('designs').select('id').eq('id', used.id), 'read kept');
  check('used design still exists after the refused delete', kept.length === 1);
  must(await sb.from('designs').update({ is_active: false }).eq('id', used.id), 'hide used');
  const usedHidden = must(await sb.from('designs').select('is_active').eq('id', used.id).single(), 'read used hidden');
  check('used design can be hidden', usedHidden.is_active === false);
} catch (e) {
  failures++;
  console.log(`FAIL  unexpected error: ${e.message}`);
} finally {
  if (eventId) {
    try {
      const objs = await listFolder(eventId);
      if (objs.length) await bucket().remove(objs.map((o) => `${eventId}/${o.name}`));
    } catch (e) {
      console.log(`cleanup storage: ${e.message}`);
    }
    const o = await sb.from('orders').delete().eq('event_id', eventId);
    if (o.error) console.log(`cleanup orders: ${o.error.message}`);
    const d = await sb.from('designs').delete().eq('event_id', eventId);
    if (d.error) console.log(`cleanup designs: ${d.error.message}`);
    const e = await sb.from('events').delete().eq('id', eventId);
    if (e.error) console.log(`cleanup event: ${e.error.message}`);
  }
  const count = async (q) => (q.error ? -1 : (q.data?.length ?? 0));
  const nEvents = await count(await sb.from('events').select('id').eq('name', EVENT_NAME));
  const nDesigns = eventId ? await count(await sb.from('designs').select('id').eq('event_id', eventId)) : 0;
  const nOrders = eventId ? await count(await sb.from('orders').select('id').eq('event_id', eventId)) : 0;
  let nObjects = 0;
  if (eventId) {
    const l = await bucket().list(eventId);
    nObjects = l.error ? -1 : l.data.length;
  }
  check('cleanup: zero leftover events', nEvents === 0, `found ${nEvents}`);
  check('cleanup: zero leftover designs', nDesigns === 0, `found ${nDesigns}`);
  check('cleanup: zero leftover orders', nOrders === 0, `found ${nOrders}`);
  check('cleanup: zero leftover storage objects', nObjects === 0, `found ${nObjects}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exitCode = failures ? 1 : 0;
