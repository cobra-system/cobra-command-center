#!/bin/sh
# Triggered after Claude writes or edits a file.
# If the changed file is a page, migration, or Edge Function, runs the docs
# check in warn-only mode so Claude sees any documentation gaps immediately.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4)

case "$FILE" in
  */src/pages/*.tsx|\
  */supabase/migrations/*.sql|\
  */supabase/functions/*/index.ts)
    cd "$CLAUDE_PROJECT_DIR" && node scripts/check-docs.mjs --warn-only
    ;;
esac
