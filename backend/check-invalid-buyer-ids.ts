import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvalidBuyerIds() {
  console.log('不正なbuyer_idを持つ買主を検索中...\n');
  
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number, name')
    .is('deleted_at', null)
    .order('buyer_number', { ascending: false })
    .limit(1000);
  
  if (error) {
    console.error('エラー:', error);
    return;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidBuyers = buyers.filter(b => !uuidRegex.test(b.buyer_id));
  
  console.log(`総買主数: ${buyers.length}`);
  console.log(`不正なbuyer_id: ${invalidBuyers.length}件\n`);
  
  if (invalidBuyers.length > 0) {
    console.log('不正なbuyer_idを持つ買主一覧:');
    invalidBuyers.forEach(b => {
      console.log(`  - 買主番号: ${b.buyer_number}, buyer_id: ${b.buyer_id}, 名前: ${b.name}`);
    });
  } else {
    console.log('✅ 全ての買主が正しいUUID形式のbuyer_idを持っています');
  }
}

checkInvalidBuyerIds();
