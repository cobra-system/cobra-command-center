import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const dbUrl = Deno.env.get("EXTERNAL_DB_URL")!;
    const parsedUrl = new URL(dbUrl);
    const client = new Client({
      hostname: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 5432,
      database: parsedUrl.pathname.slice(1),
      user: parsedUrl.username,
      password: decodeURIComponent(parsedUrl.password),
      tls: { enabled: true, enforce: false },
    });
    await client.connect();

    const results: string[] = [];

    // 1. Add document_name column if not exists
    await client.queryObject(`
      ALTER TABLE public.purchase_documents ADD COLUMN IF NOT EXISTS document_name text;
    `);
    results.push("✓ document_name column");

    // 2. Add order_id column if not exists
    await client.queryObject(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'purchase_documents' AND column_name = 'order_id'
        ) THEN
          ALTER TABLE public.purchase_documents ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    results.push("✓ order_id column");

    // 3. Add document_id to supplier_payments if not exists
    await client.queryObject(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'supplier_payments' AND column_name = 'document_id'
        ) THEN
          ALTER TABLE public.supplier_payments ADD COLUMN document_id uuid REFERENCES public.purchase_documents(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    results.push("✓ supplier_payments.document_id column");

    // 4. Remove type check constraint if exists
    await client.queryObject(`
      ALTER TABLE public.purchase_documents DROP CONSTRAINT IF EXISTS purchase_documents_type_check;
    `);
    results.push("✓ Removed type check constraint");

    // 5. Set default for quantity
    await client.queryObject(`
      ALTER TABLE public.purchase_documents ALTER COLUMN quantity SET DEFAULT 0;
    `);
    results.push("✓ Set quantity default to 0");

    // 5b. Add payment_status to orders if not exists
    await client.queryObject(`
      ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'ממתין';
    `);
    // Backfill existing paid orders
    await client.queryObject(`
      UPDATE public.orders SET payment_status = 'שולם' WHERE payment_date IS NOT NULL AND payment_status = 'ממתין';
    `);
    results.push("✓ orders.payment_status column");

    // 6. Make documents storage bucket public
    await client.queryObject(`
      UPDATE storage.buckets SET public = true WHERE id = 'documents';
    `);
    results.push("✓ Documents bucket set to public");

    // 7. Reload PostgREST schema cache
    await client.queryObject(`NOTIFY pgrst, 'reload schema';`);
    results.push("✓ Schema cache reloaded");

    await client.end();

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
