import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBuyersSchema() {
  console.log('📊 Checking buyers table schema...\n');

  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('✅ Buyers table columns:');
    columns.sort().forEach(col => {
      console.log(`  - ${col}`);
    });
    console.log(`\n📊 Total columns: ${columns.length}`);
  } else {
    console.log('⚠️ No data found in buyers table');
  }
}

checkBuyersSchema().catch(console.error);
