#!/usr/bin/env node
/**
 * scripts/check-mcp-tools.mjs
 *
 * Validates MCP tool modules stay in sync with the codebase.
 *
 * Checks
 * ──────
 * 1. Registration  mcp-server/src/tools/*.ts  ↔  mcp-server/src/index.ts  (bidirectional)
 * 2. Coverage      src/integrations/supabase/types.ts tables  →  any .from("table") in tools
 *
 * Exit codes
 * ──────────
 * 0  everything in sync (or warn-only mode)
 * 1  gaps found
 *
 * Flags / env
 * ───────────
 * --warn-only          print gaps but always exit 0  (used by Claude Code hook)
 * SKIP_DOCS_CHECK=1    skip entirely (emergency bypass)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

if (process.env.SKIP_DOCS_CHECK === '1') {
  console.log('⏭️  SKIP_DOCS_CHECK=1 — skipping MCP tools check.\n');
  process.exit(0);
}

const ROOT     = fileURLToPath(new URL('..', import.meta.url));
const warnOnly = process.argv.includes('--warn-only');

let issues = 0;
const fail = (msg) => { console.error(`  ✗  ${msg}`); issues++; };
const warn = (msg) => { console.warn(`  ⚠  ${msg}`); };

console.log('\n🔧 Checking MCP tools sync…\n');

// ─── 1. Registration (bidirectional) ────────────────────────────────────────

const toolsDir  = join(ROOT, 'mcp-server/src/tools');
const indexPath = join(ROOT, 'mcp-server/src/index.ts');

if (!existsSync(toolsDir)) {
  fail('mcp-server/src/tools/ directory not found');
  process.exit(warnOnly ? 0 : 1);
}

if (!existsSync(indexPath)) {
  fail('mcp-server/src/index.ts not found');
  process.exit(warnOnly ? 0 : 1);
}

// Tool files on disk (without extension, excluding .d.ts)
const diskModules = new Set(
  readdirSync(toolsDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map(f => f.replace(/\.ts$/, ''))
);

// Modules imported in index.ts: lines like  from "./tools/orders.js"
const indexContent = readFileSync(indexPath, 'utf8');
const importedModules = new Set(
  [...indexContent.matchAll(/from\s+"\.\/tools\/([^"]+)\.js"/g)].map(m => m[1])
);

let regIssues = 0;
console.log('📦 Module registration:');

// Forward: disk → index.ts
for (const mod of [...diskModules].sort()) {
  if (!importedModules.has(mod)) {
    fail(`tool module "${mod}.ts" exists in tools/ but is not imported in mcp-server/src/index.ts`);
    regIssues++;
  }
}

// Reverse: index.ts → disk
for (const mod of [...importedModules].sort()) {
  if (!diskModules.has(mod)) {
    fail(`index.ts imports "./tools/${mod}.js" but "${mod}.ts" does not exist in tools/`);
    regIssues++;
  }
}

if (regIssues === 0) console.log(`  ✓  all ${diskModules.size} tool modules registered in index.ts`);

// ─── 2. Coverage (warn-only — tables without any tool) ───────────────────────
//
// For each table in the Supabase auto-generated types, check whether any tool
// file references it via .from("table_name"). Missing coverage is informational
// only — some tables (login_attempts, sap_sync_log) are intentionally toolless.

const typesPath = join(ROOT, 'src/integrations/supabase/types.ts');

if (existsSync(typesPath)) {
  const typesContent = readFileSync(typesPath, 'utf8');

  // Extract table names from the Tables block (6-space indent is the table key level)
  const schemaTables = new Set(
    [...typesContent.matchAll(/^ {6}([a-z][a-z_0-9]+): \{/gm)].map(m => m[1])
  );

  // Concatenate all tool file content for fast search
  const allToolsContent = [...diskModules].map(mod => {
    const p = join(toolsDir, `${mod}.ts`);
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
  }).join('\n');

  // RLS helper functions registered as pseudo-tables in the schema
  const SKIP_TABLES = new Set(['has_role', 'is_manager']);

  const uncovered = [];
  for (const tbl of [...schemaTables].sort()) {
    if (SKIP_TABLES.has(tbl)) continue;
    const pattern = new RegExp(`\\.from\\(["'\`]${tbl}["'\`]\\)`);
    if (!pattern.test(allToolsContent)) {
      uncovered.push(tbl);
    }
  }

  console.log('\n🗄️  Table coverage:');
  if (uncovered.length === 0) {
    console.log('  ✓  all schema tables have at least one MCP tool');
  } else {
    for (const tbl of uncovered) {
      warn(`table "${tbl}" has no MCP tool coverage  (no .from("${tbl}") in any tool file)`);
    }
    console.log(`\n  ℹ️  ${uncovered.length} uncovered table(s) — may be intentional`);
    console.log('     add a tool or update docs/MCP_TOOLS.md → "Tables without MCP coverage"');
  }
} else {
  warn('src/integrations/supabase/types.ts not found — skipping table coverage check');
}

// ─── Result ───────────────────────────────────────────────────────────────────

console.log('');
if (issues === 0) {
  console.log('✅ MCP tools in sync.\n');
  process.exit(0);
} else {
  console.log(`❌ ${issues} MCP tool gap(s) found.\n`);
  if (warnOnly) {
    console.log('   (warn-only mode — not blocking)\n');
    process.exit(0);
  }
  console.log('   → Register the module in mcp-server/src/index.ts, or set SKIP_DOCS_CHECK=1 to bypass.\n');
  process.exit(1);
}
