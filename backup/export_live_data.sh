#!/usr/bin/env bash
# ============================================================================
# Cobra Command Center - Live Data Exporter
# Fetches all table data from Supabase using the service role key (bypasses RLS)
# Usage: ./backup/export_live_data.sh <SUPABASE_SERVICE_ROLE_KEY>
# ============================================================================

set -euo pipefail

SERVICE_ROLE_KEY="${1:?Usage: $0 <SUPABASE_SERVICE_ROLE_KEY>}"
SUPABASE_URL="https://pjruyvhtivbeikxrnipg.supabase.co"
OUTPUT_FILE="backup/live_data_$(date +%Y-%m-%d_%H%M%S).sql"

TABLES=(
  profiles
  user_roles
  products
  product_components
  suppliers
  orders
  order_items
  tasks
  learning_journal
  purchase_documents
  supplier_payments
  product_issues
  supplier_price_quotes
  distribution_centers
  center_contacts
  center_inventory
  inventory_transfers
  sap_sync_log
  supplier_contacts
  compliance_items
  compliance_product_links
  role_definitions
)

echo "-- Live data export: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUTPUT_FILE"
echo "-- Source: $SUPABASE_URL" >> "$OUTPUT_FILE"
echo "BEGIN;" >> "$OUTPUT_FILE"

for table in "${TABLES[@]}"; do
  echo "Fetching $table..."
  DATA=$(curl -sf \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Prefer: return=representation" \
    "${SUPABASE_URL}/rest/v1/${table}?select=*&limit=10000")

  ROW_COUNT=$(echo "$DATA" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)

  if [ "$ROW_COUNT" -gt 0 ]; then
    echo "  -> $ROW_COUNT rows"
    echo "" >> "$OUTPUT_FILE"
    echo "-- Table: $table ($ROW_COUNT rows)" >> "$OUTPUT_FILE"

    # Generate INSERT statements using Python
    python3 -c "
import json, sys

data = json.loads('''$DATA''')
table = '$table'

for row in data:
    cols = ', '.join(row.keys())
    vals = []
    for v in row.values():
        if v is None:
            vals.append('NULL')
        elif isinstance(v, bool):
            vals.append('true' if v else 'false')
        elif isinstance(v, (int, float)):
            vals.append(str(v))
        elif isinstance(v, (dict, list)):
            escaped = json.dumps(v, ensure_ascii=False).replace(\"'\", \"''\")
            vals.append(f\"'{escaped}'::jsonb\")
        else:
            escaped = str(v).replace(\"'\", \"''\")
            vals.append(f\"'{escaped}'\")
    values_str = ', '.join(vals)
    print(f'INSERT INTO public.{table} ({cols}) VALUES ({values_str});')
" >> "$OUTPUT_FILE"
  else
    echo "  -> 0 rows (skipped)"
  fi
done

echo "" >> "$OUTPUT_FILE"
echo "COMMIT;" >> "$OUTPUT_FILE"

echo ""
echo "Export complete: $OUTPUT_FILE"
echo "Tables exported: ${#TABLES[@]}"
wc -l < "$OUTPUT_FILE" | xargs -I{} echo "Total lines: {}"
