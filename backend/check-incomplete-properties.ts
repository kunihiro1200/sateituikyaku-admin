import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIncompleteProperties() {
  console.log('確認フィールドが「未」の物件を確認中...\n');
  
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, confirmation')
    .eq('confirmation', '未')
    .order('property_number');
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log(`確認フィールドが「未」の物件: ${data?.length || 0}件\n`);
  
  if (data && data.length > 0) {
    data.forEach(p => {
      console.log(`  - ${p.property_number}: 確認=${p.confirmation}`);
    });
  } else {
    console.log('  （該当物件なし）');
  }
}

checkIncompleteProperties();
