#!/bin/sh
# Triggered after Claude writes or edits a file.
# Runs the relevant validation scripts in warn-only mode so Claude sees
# documentation and MCP tool gaps immediately.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4)

case "$FILE" in
  # Docs sync: new page, migration, or Edge Function → check README/docs
  */src/pages/*.tsx|\
  */supabase/migrations/*.sql|\
  */supabase/functions/*/index.ts)
    cd "$CLAUDE_PROJECT_DIR" && node scripts/check-docs.mjs --warn-only
    ;;
esac

case "$FILE" in
  # MCP sync: tool file added/changed, index registration changed, or DB schema regenerated
  */mcp-server/src/tools/*.ts|\
  */mcp-server/src/index.ts|\
  */src/integrations/supabase/types.ts)
    cd "$CLAUDE_PROJECT_DIR" && node scripts/check-mcp-tools.mjs --warn-only
    ;;
esac
