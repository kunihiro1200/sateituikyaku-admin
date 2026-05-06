import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer() {
  console.log('買主4998のbuyer_idを確認中...\n');
  
  const { data, error } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number, name')
    .eq('buyer_number', '4998')
    .single();
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  console.log('買主情報:');
  console.log('  buyer_id:', data.buyer_id);
  console.log('  buyer_number:', data.buyer_number);
  console.log('  name:', data.name);
  console.log('\nbuyer_idの形式チェック:');
  console.log('  長さ:', data.buyer_id.length);
  console.log('  UUID形式:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.buyer_id));
}

checkBuyer();
