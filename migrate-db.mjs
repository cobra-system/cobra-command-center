import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = 'postgresql://postgres:eKKrBzsf9xKoCyET@db.ljpdwezgahrrffnwajho.supabase.co:5432/postgres';

const migrationSQL = `
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

DROP POLICY IF EXISTS "Users can read their own preferences" ON public.user_preferences;
CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_preferences_updated_at();
`;

console.log('🔌 Connecting to database...');
console.log('📍 Host: db.ljpdwezgahrrffnwajho.supabase.co');

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10
});

try {
  await client.connect();
  console.log('✅ Connected to database!');
  
  console.log('🚀 Executing migration SQL...');
  console.log('');
  
  await client.query(migrationSQL);
  
  console.log('✅ Migration executed successfully!');
  console.log('');
  
  console.log('🔍 Verifying table creation...');
  const result = await client.query(`
    SELECT table_name, table_schema 
    FROM information_schema.tables 
    WHERE table_name = 'user_preferences' AND table_schema = 'public'
  `);
  
  if (result.rows.length > 0) {
    console.log('✅ Table verification passed!');
    console.log('   Schema: public');
    console.log('   Table: user_preferences');
    console.log('');
    
    // Check policies
    const policiesResult = await client.query(`
      SELECT policyname, cmd 
      FROM pg_policies 
      WHERE tablename = 'user_preferences'
    `);
    
    console.log(`✅ RLS Policies created (${policiesResult.rows.length} policies)`);
    policiesResult.rows.forEach(p => {
      console.log(`   - ${p.cmd}: ${p.policyname}`);
    });
  } else {
    console.log('⚠️ Table not found after migration');
  }
  
  console.log('');
  console.log('🎉 Migration complete!');
  
  await client.end();
  process.exit(0);
  
} catch (error) {
  console.error('❌ Migration failed!');
  console.error('');
  console.error('Error:', error.message);
  if (error.code) console.error('Code:', error.code);
  if (error.detail) console.error('Detail:', error.detail);
  if (error.hint) console.error('Hint:', error.hint);
  
  console.error('');
  console.error('💡 Possible solutions:');
  console.error('   1. Check DATABASE_URL credentials');
  console.error('   2. Verify network connection to Supabase');
  console.error('   3. Try via Supabase dashboard: https://app.supabase.com');
  
  try {
    await client.end();
  } catch (e) {}
  
  process.exit(1);
}
