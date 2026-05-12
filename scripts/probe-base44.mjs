#!/usr/bin/env node

/**
 * Base44 API probe
 *
 * Discovers entities and dumps sample records from Liki's Frisbee app on base44.app
 * so we can design the integration into Cobra Command Center.
 *
 * Usage:
 *   BASE44_TOKEN="<jwt>" node scripts/probe-base44.mjs
 *
 * Or with a custom app id / extra entity names:
 *   BASE44_TOKEN="<jwt>" BASE44_APP_ID="<id>" node scripts/probe-base44.mjs Equipment Inspection Installer
 *
 * Output: ./tmp/base44-probe/<Entity>.json (sample) + summary.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.BASE44_TOKEN;
const APP_ID = process.env.BASE44_APP_ID || '68e1b17dc9842a25510b1e52';
const BASE_URL = `https://base44.app/api/apps/${APP_ID}`;

if (!TOKEN) {
  console.error('Missing BASE44_TOKEN env var.');
  console.error('Usage: BASE44_TOKEN="<jwt>" node scripts/probe-base44.mjs [Entity1 Entity2 ...]');
  process.exit(1);
}

// Entity names to probe. CLI args override; otherwise use the known ones plus likely guesses.
const argEntities = process.argv.slice(2);
const ENTITIES = argEntities.length
  ? argEntities
  : [
      'Equipment',
      'Inspection',
      'Installer',
      'Technician',
      'Division',
      'Warehouse',
      'Pickup',
      'Return',
      'Product',
      'Consumption',
      'Job',
      'Site',
      'Customer',
    ];

const OUT_DIR = path.join(__dirname, '..', 'tmp', 'base44-probe');
fs.mkdirSync(OUT_DIR, { recursive: true });

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
};

async function tryFetch(url) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, ok: res.ok, body };
  } catch (err) {
    return { status: 0, ok: false, body: String(err) };
  }
}

function summarizeShape(records) {
  if (!Array.isArray(records) || !records.length) return null;
  const fieldTypes = {};
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    for (const [k, v] of Object.entries(r)) {
      const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
      fieldTypes[k] = fieldTypes[k] || new Set();
      fieldTypes[k].add(t);
    }
  }
  return Object.fromEntries(
    Object.entries(fieldTypes).map(([k, v]) => [k, [...v].join('|')])
  );
}

const summary = { base_url: BASE_URL, app_id: APP_ID, probed_at: new Date().toISOString(), entities: {} };

console.log(`Probing ${BASE_URL}`);
console.log(`Entities: ${ENTITIES.join(', ')}\n`);

for (const name of ENTITIES) {
  const url = `${BASE_URL}/entities/${name}?limit=5`;
  const { status, ok, body } = await tryFetch(url);

  const entry = { url, status, ok };

  if (ok && Array.isArray(body)) {
    entry.count_returned = body.length;
    entry.shape = summarizeShape(body);
    entry.sample = body.slice(0, 2);
    fs.writeFileSync(
      path.join(OUT_DIR, `${name}.json`),
      JSON.stringify(body, null, 2)
    );
    console.log(`  ${name.padEnd(14)} ✓ ${status}  (${body.length} records, ${Object.keys(entry.shape || {}).length} fields)`);
  } else if (ok && body && typeof body === 'object') {
    entry.body_keys = Object.keys(body);
    entry.sample = body;
    fs.writeFileSync(
      path.join(OUT_DIR, `${name}.json`),
      JSON.stringify(body, null, 2)
    );
    console.log(`  ${name.padEnd(14)} ✓ ${status}  (object, keys: ${entry.body_keys.join(', ')})`);
  } else {
    entry.error = typeof body === 'string' ? body.slice(0, 300) : body;
    console.log(`  ${name.padEnd(14)} ✗ ${status}`);
  }

  summary.entities[name] = entry;
}

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`\nWrote: ${OUT_DIR}`);
console.log('Share summary.json (or paste it back) so we can design the integration.');
