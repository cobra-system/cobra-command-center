#!/usr/bin/env node
/**
 * scripts/check-docs.mjs
 *
 * Validates that README.md stays in sync with the codebase.
 *
 * Checks
 * ──────
 * 1. Routes     App.tsx active routes  ↔  README.md modules table  (bidirectional)
 * 2. Functions  supabase/functions/    ↔  README.md Edge Functions  (bidirectional)
 * 3. DB tables  README.md table names  →  mentioned in any migration (stale-doc guard)
 *
 * Exit codes
 * ──────────
 * 0  everything in sync (or warn-only mode)
 * 1  gaps found
 *
 * Flags / env
 * ───────────
 * --warn-only          print gaps but always exit 0  (used by Claude Code hook)
 * SKIP_DOCS_CHECK=1    skip entirely (emergency bypass for pre-push)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

if (process.env.SKIP_DOCS_CHECK === '1') {
  console.log('⏭️  SKIP_DOCS_CHECK=1 — skipping docs check.\n');
  process.exit(0);
}

const ROOT     = fileURLToPath(new URL('..', import.meta.url));
const warnOnly = process.argv.includes('--warn-only');

let issues = 0;
const fail = (msg) => { console.error(`  ✗  ${msg}`); issues++; };

const readFile = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Extract the markdown content of a top-level ## section
function getSection(md, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)## ${escaped}[\\s\\S]*?(?=\\n## |$)`);
  const m = md.match(re);
  return m ? m[0] : '';
}

console.log('\n📋 Checking docs sync…\n');

const readme = readFile('README.md');

// ─── 1. Routes ───────────────────────────────────────────────────────────────

const appTsx   = readFile('src/App.tsx');
const modSection = getSection(readme, 'מודולים');

// Paths that are intentionally not module-level docs
const SKIP_PATHS = new Set(['/', '/login', '*']);

// Collect all <Route path="..."> paths from App.tsx
const allPaths = [...appTsx.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]);

// Mark redirect routes (lines containing both path= and <Navigate)
const redirectPaths = new Set(
  appTsx.split('\n')
    .filter(l => l.includes('<Route') && l.includes('Navigate'))
    .flatMap(l => { const m = l.match(/path="([^"]+)"/); return m ? [m[1]] : []; })
);

const activeRoutes = allPaths.filter(p => !SKIP_PATHS.has(p) && !redirectPaths.has(p));

// Documented paths in README modules table: lines like  | … | `/path` | …
const readmePaths = new Set(
  [...modSection.matchAll(/\|\s*`(\/[^`]+)`\s*\|/g)].map(m => m[1])
);

let routeIssues = 0;
console.log('🗺️  Routes:');

// Forward: code → docs
for (const route of activeRoutes) {
  if (!readmePaths.has(route)) {
    fail(`route "${route}" is in App.tsx but missing from README.md modules table`);
    routeIssues++;
  }
}

// Reverse: docs → code  (catches stale paths)
for (const path of readmePaths) {
  if (!appTsx.includes(`path="${path}"`)) {
    fail(`path "${path}" in README.md not found in App.tsx (stale or renamed?)`);
    routeIssues++;
  }
}

if (routeIssues === 0) console.log('  ✓  all routes in sync');

// ─── 2. Edge Functions ───────────────────────────────────────────────────────

const fnDir     = join(ROOT, 'supabase/functions');
const fnSection = getSection(readme, 'Edge Functions');

// Function names documented in README (backtick-quoted short identifiers)
const readmeFns = new Set(
  [...fnSection.matchAll(/`([a-z][a-z0-9-]+)`/g)].map(m => m[1])
);

// Function directories on disk (excluding _shared)
const fsDirs = existsSync(fnDir)
  ? readdirSync(fnDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('_'))
      .map(e => e.name)
  : [];

let fnIssues = 0;
console.log('\n⚡ Edge Functions:');

// Forward: disk → docs
for (const fn of fsDirs) {
  if (!readmeFns.has(fn)) {
    fail(`Edge Function "${fn}" exists in supabase/functions/ but is not documented in README.md`);
    fnIssues++;
  }
}

// Reverse: docs → disk
for (const fn of readmeFns) {
  if (!fsDirs.includes(fn)) {
    fail(`Edge Function "${fn}" is in README.md but not found in supabase/functions/ (removed?)`);
    fnIssues++;
  }
}

if (fnIssues === 0) console.log('  ✓  all Edge Functions in sync');

// ─── 3. DB tables (stale-doc guard) ──────────────────────────────────────────
//
// Strategy: extract table names from the DB section of README, then verify
// each is known to the project via EITHER:
//   a) The auto-generated Supabase types file (most reliable — reflects live schema)
//   b) Any migration SQL file (catches tables not yet regenerated into types)
//
// This handles pre-migration tables (created before the migration system) and
// tables not yet regenerated into types.ts after addition.

const dbSection = getSection(readme, 'מסד נתונים');

// Table names are backtick-quoted snake_case identifiers in the DB section
const readmeTables = new Set(
  [...dbSection.matchAll(/`([a-z][a-z0-9_]+)`/g)].map(m => m[1])
);

// Source A: Supabase auto-generated types (Tables block)
const typesPath = join(ROOT, 'src/integrations/supabase/types.ts');
let typesTables = new Set();
if (existsSync(typesPath)) {
  const typesContent = readFileSync(typesPath, 'utf8');
  const tablesBlock = typesContent.match(/Tables:\s*\{([\s\S]*?)(?:\n\s{4}Views:|\n\s{4}Functions:)/);
  if (tablesBlock) {
    for (const m of tablesBlock[1].matchAll(/^\s+([a-z][a-z_0-9]+):\s*\{/gm)) {
      typesTables.add(m[1]);
    }
  }
}

// Source B: all migration SQL files (broad text search)
let allMigrationsSql = '';
const migrDir = join(ROOT, 'supabase/migrations');
if (existsSync(migrDir)) {
  for (const f of readdirSync(migrDir).filter(f => f.endsWith('.sql'))) {
    allMigrationsSql += readFileSync(join(migrDir, f), 'utf8') + '\n';
  }
}

let tblIssues = 0;
console.log('\n🗄️  DB tables (README → schema):');

for (const tbl of [...readmeTables].sort()) {
  const inTypes      = typesTables.has(tbl);
  const inMigrations = new RegExp(`\\b${tbl}\\b`, 'i').test(allMigrationsSql);
  if (!inTypes && !inMigrations) {
    fail(`table "${tbl}" is in README.md but not found in types.ts or any migration (stale?)`);
    tblIssues++;
  }
}

if (tblIssues === 0) console.log('  ✓  all README tables found in schema');

// ─── Result ───────────────────────────────────────────────────────────────────

console.log('');
if (issues === 0) {
  console.log('✅ All docs in sync.\n');
  process.exit(0);
} else {
  console.log(`❌ ${issues} documentation gap(s) found.\n`);
  if (warnOnly) {
    console.log('   (warn-only mode — not blocking)\n');
    process.exit(0);
  }
  console.log('   → Update README.md to fix gaps, or set SKIP_DOCS_CHECK=1 to bypass.\n');
  process.exit(1);
}
