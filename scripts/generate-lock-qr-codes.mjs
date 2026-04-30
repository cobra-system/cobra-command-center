#!/usr/bin/env node
// Generates 10 printable PNG QR codes for the warehouse lock control system.
// Output: docs/lock-qr/lock-NN-<slug>.png + INDEX.txt
// Source of truth for the lock list is the seed in
//   supabase/migrations/20260430000001_create_warehouse_locks.sql
// kept in sync below. Re-run any time the seed changes.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'docs', 'lock-qr');

const LOCKS = [
  { id: 1,  name: 'שער ראשי',                barcode: 'COBRA-TLV-LOCK-01', slug: 'shaar-rashi' },
  { id: 2,  name: 'כניסה ראשית',              barcode: 'COBRA-TLV-LOCK-02', slug: 'knisa-rashit' },
  { id: 3,  name: 'מרכז שירות לוגיסטי',       barcode: 'COBRA-TLV-LOCK-03', slug: 'merkaz-sherut-logisti' },
  { id: 4,  name: 'משרד מנהל לוגיסטיקה',     barcode: 'COBRA-TLV-LOCK-04', slug: 'misrad-menahel-logistika' },
  { id: 5,  name: 'דלת חיצונית מרכז אכסנה',   barcode: 'COBRA-TLV-LOCK-05', slug: 'delet-hitsonit-merkaz-akhsana' },
  { id: 6,  name: 'דלת פנימית מרכז אכסנה',    barcode: 'COBRA-TLV-LOCK-06', slug: 'delet-pnimit-merkaz-akhsana' },
  { id: 7,  name: 'חלון מרכז אכסנה',          barcode: 'COBRA-TLV-LOCK-07', slug: 'halon-merkaz-akhsana' },
  { id: 8,  name: 'מחסן השמדה',                barcode: 'COBRA-TLV-LOCK-08', slug: 'mahsan-hashmada' },
  { id: 9,  name: 'דלת מזכירות',                barcode: 'COBRA-TLV-LOCK-09', slug: 'delet-mazkirut' },
  { id: 10, name: 'מעבדה',                      barcode: 'COBRA-TLV-LOCK-10', slug: 'maabada' },
];

const QR_OPTS = {
  errorCorrectionLevel: 'H',
  margin: 2,
  width: 600,
  color: { dark: '#000000', light: '#FFFFFF' },
};

await fs.mkdir(outDir, { recursive: true });

const indexLines = [
  '# Warehouse Lock QR Codes — Cobra Tel Aviv',
  '# Generated: ' + new Date().toISOString(),
  '#',
  '# Print each PNG on a waterproof sticker (~5×5 cm) and stick it next to',
  '# the matching physical lock. Scanning toggles the lock\'s open/closed status',
  '# at /lock-control in the app.',
  '#',
  '# id  barcode               filename                              name',
  '# ──  ────────────────────  ───────────────────────────────────  ─────────────',
];

console.log(`Generating ${LOCKS.length} QR codes → ${path.relative(repoRoot, outDir)}`);

for (const lock of LOCKS) {
  const filename = `lock-${String(lock.id).padStart(2, '0')}-${lock.slug}.png`;
  const filepath = path.join(outDir, filename);
  await QRCode.toFile(filepath, lock.barcode, QR_OPTS);
  indexLines.push(
    `  ${String(lock.id).padStart(2)}  ${lock.barcode.padEnd(20)}  ${filename.padEnd(36)}  ${lock.name}`
  );
  console.log(`  ✓ ${filename}`);
}

await fs.writeFile(path.join(outDir, 'INDEX.txt'), indexLines.join('\n') + '\n', 'utf8');
console.log(`  ✓ INDEX.txt`);
console.log(`Done. ${LOCKS.length} PNGs + INDEX.txt written.`);
