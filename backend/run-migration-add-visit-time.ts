import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function runMigration() {
  console.log('🔄 Running migration: add visit_time to sellers...\n');

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260405000001_add_visit_time_to_sellers.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('📝 SQL:');
  console.log(sql);
  console.log('');

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Migration failed:', error);
    
    // 直接実行を試みる
    console.log('\n🔄 Trying direct execution...\n');
    
    const { error: directError } = await supabase
      .from('sellers')
      .select('visit_time')
      .limit(1);
    
    if (directError && directError.message.includes('column "visit_time" does not exist')) {
      console.log('✅ Confirmed: visit_time column does not exist');
      console.log('📝 Please run this SQL manually in Supabase SQL Editor:');
      console.log('');
      console.log(sql);
    } else if (!directError) {
      console.log('✅ visit_time column already exists!');
    }
    
    return;
  }

  console.log('✅ Migration completed successfully!');
  
  // 確認
  const { data: checkData, error: checkError } = await supabase
    .from('sellers')
    .select('visit_time')
    .limit(1);
  
  if (checkError) {
    console.error('❌ Verification failed:', checkError);
  } else {
    console.log('✅ Verified: visit_time column exists');
  }
}

runMigration().catch(console.error);
