import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSellersSchema() {
  console.log('📊 Checking sellers table schema...\n');

  // sellersテーブルのカラム情報を取得
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log(`✅ Found ${columns.length} columns in sellers table:\n`);
    
    // visit関連のカラムを探す
    const visitColumns = columns.filter(col => col.includes('visit'));
    console.log('📋 Visit-related columns:');
    visitColumns.forEach(col => console.log(`  - ${col}`));
    
    // visit_timeカラムが存在するか確認
    if (columns.includes('visit_time')) {
      console.log('\n✅ visit_time column EXISTS');
    } else {
      console.log('\n❌ visit_time column DOES NOT EXIST');
      console.log('   Need to create migration to add visit_time column');
    }
  }
}

checkSellersSchema().catch(console.error);
