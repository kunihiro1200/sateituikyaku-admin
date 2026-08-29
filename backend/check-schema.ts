import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSchema() {
  console.log('Checking sellers table schema...');
  
  // テーブルのカラム情報を取得
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('\nAvailable columns in sellers table:');
    console.log(columns.filter(c => c.includes('match')).sort());
    
    const hasBuyMatchPropertyTypes = columns.includes('buy_match_property_types');
    const hasMatchPropertyTypes = columns.includes('match_property_types');
    
    console.log('\nColumn check:');
    console.log('- buy_match_property_types:', hasBuyMatchPropertyTypes ? '✓ EXISTS' : '✗ NOT FOUND');
    console.log('- match_property_types:', hasMatchPropertyTypes ? '✓ EXISTS' : '✗ NOT FOUND');
  }
  
  // 直接SQLで確認
  console.log('\nDirect SQL query:');
  const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sellers' 
      AND column_name LIKE '%property_types%'
    `
  });
  
  if (sqlError) {
    console.log('SQL query not supported, trying alternative...');
  } else {
    console.log(sqlData);
  }
}

checkSchema().then(() => {
  console.log('\nDone');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
