import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBuyerId() {
  console.log('買主4998のbuyer_idを修正中...\n');
  
  // 現在の状態を確認
  const { data: before, error: beforeError } = await supabase
    .from('buyers')
    .select('buyer_id, buyer_number, name')
    .eq('buyer_number', '4998')
    .single();
  
  if (beforeError) {
    console.error('エラー:', beforeError);
    return;
  }
  
  console.log('修正前:');
  console.log('  buyer_id:', before.buyer_id);
  console.log('  buyer_number:', before.buyer_number);
  console.log('  name:', before.name);
  console.log('  UUID形式:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(before.buyer_id));
  
  // 新しいUUIDを生成
  const newBuyerId = randomUUID();
  console.log('\n新しいbuyer_id:', newBuyerId);
  
  // 確認
  console.log('\n本当に修正しますか？ (y/n)');
  console.log('注意: この操作は元に戻せません。');
  
  // 実際の修正（コメントアウト）
  /*
  const { data: after, error: updateError } = await supabase
    .from('buyers')
    .update({ buyer_id: newBuyerId })
    .eq('buyer_number', '4998')
    .select()
    .single();
  
  if (updateError) {
    console.error('更新エラー:', updateError);
    return;
  }
  
  console.log('\n修正後:');
  console.log('  buyer_id:', after.buyer_id);
  console.log('  buyer_number:', after.buyer_number);
  console.log('  name:', after.name);
  console.log('  UUID形式:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(after.buyer_id));
  console.log('\n✅ 修正完了');
  */
}

fixBuyerId();
