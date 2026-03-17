const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:eKKrBzsf9xKoCyET@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres';

const migrationSql = `
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_name text NOT NULL,
  sort_field text,
  sort_dir text CHECK (sort_dir IN ('asc', 'desc')),
  filters jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, page_name)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_page ON public.user_preferences(user_id, page_name);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_preferences_updated_at();
`;

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

console.log('🔌 Connecting to database...');
console.log('URL:', dbUrl.replace(/:[^@]*@/, ':***@'));

client.connect()
  .then(() => {
    console.log('✅ Connected!');
    console.log('🚀 Executing migration...\n');
    return client.query(migrationSql);
  })
  .then(() => {
    console.log('✅ Migration executed successfully!');
    console.log('\n🔍 Verifying...');
    return client.query('SELECT * FROM information_schema.tables WHERE table_name = \'user_preferences\'');
  })
  .then((result) => {
    if (result.rows.length > 0) {
      console.log('✅ Table user_preferences verified!');
      console.log('   Schema: public');
      console.log('   Status: CREATED');
    } else {
      console.log('⚠️ Table not found in verification');
    }
    return client.end();
  })
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    console.error(err.detail || '');
    client.end().then(() => {
      process.exit(1);
    });
  });
