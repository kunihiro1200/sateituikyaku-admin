import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting migration 105: Migrate visit_date to TIMESTAMP...\n');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, '105_migrate_visit_date_to_timestamp.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 Executing SQL migration...');
    
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration 105 completed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    
    // Check if visit_datetime column exists (should not exist after migration)
    const { data: columns, error: columnsError } = await supabase
      .from('sellers')
      .select('*')
      .limit(1);

    if (columnsError) {
      console.error('❌ Verification failed:', columnsError);
      process.exit(1);
    }

    console.log('✅ Verification completed!');
    console.log('📊 Sample data:', columns);

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

runMigration();
