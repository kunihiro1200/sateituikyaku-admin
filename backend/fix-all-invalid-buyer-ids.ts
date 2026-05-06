import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllInvalidBuyerIds() {
  console.log('全ての不正なbuyer_idを修正中...\n');
  
  // 全買主を取得（ページネーション対応）
  let allBuyers: any[] = [];
  let offset = 0;
  const limit = 1000;
  
  console.log('買主データを取得中...');
  while (true) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name')
      .is('deleted_at', null)
      .order('buyer_number', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('エラー:', error);
      return;
    }
    
    if (!data || data.length === 0) break;
    
    allBuyers = allBuyers.concat(data);
    console.log(`  取得済み: ${allBuyers.length}件`);
    offset += limit;
    
    if (data.length < limit) break;
  }
  
  const buyers = allBuyers;
  console.log(`\n総取得件数: ${buyers.length}件\n`);
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidBuyers = buyers.filter(b => !b.buyer_id || !uuidRegex.test(b.buyer_id));
  
  console.log(`総買主数: ${buyers.length}`);
  console.log(`不正なbuyer_id: ${invalidBuyers.length}件\n`);
  
  if (invalidBuyers.length === 0) {
    console.log('✅ 全ての買主が正しいUUID形式のbuyer_idを持っています');
    return;
  }
  
  console.log('修正対象の買主（最初の10件）:');
  invalidBuyers.slice(0, 10).forEach(b => {
    console.log(`  - 買主番号: ${b.buyer_number}, buyer_id: ${b.buyer_id || 'null'}, 名前: ${b.name}`);
  });
  console.log(`  ... 他 ${invalidBuyers.length - 10}件\n`);
  
  console.log('修正を実行します...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const buyer of invalidBuyers) {
    const newBuyerId = randomUUID();
    
    const { error: updateError } = await supabase
      .from('buyers')
      .update({ buyer_id: newBuyerId })
      .eq('buyer_number', buyer.buyer_number);
    
    if (updateError) {
      console.error(`❌ 買主番号 ${buyer.buyer_number} の更新に失敗:`, updateError.message);
      failCount++;
    } else {
      if (successCount < 10 || successCount % 100 === 0) {
        console.log(`✅ 買主番号 ${buyer.buyer_number}: ${buyer.buyer_id || 'null'} → ${newBuyerId}`);
      }
      successCount++;
    }
  }
  
  console.log(`\n修正完了:`);
  console.log(`  成功: ${successCount}件`);
  console.log(`  失敗: ${failCount}件`);
}

fixAllInvalidBuyerIds();
