/**
 * 買主7260のvendor_surveyフィールドを確認するスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBuyer7260() {
  console.log('=== 買主7260のvendor_surveyフィールド確認 ===\n');

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('buyer_number, vendor_survey, last_synced_at, db_updated_at')
    .eq('buyer_number', '7260')
    .single();

  if (error) {
    console.error('エラー:', error);
    return;
  }

  if (!buyer) {
    console.log('買主7260が見つかりません');
    return;
  }

  console.log('現在の状態:');
  console.log('  買主番号:', buyer.buyer_number);
  console.log('  vendor_survey:', buyer.vendor_survey);
  console.log('  last_synced_at:', buyer.last_synced_at);
  console.log('  db_updated_at:', buyer.db_updated_at);
  console.log('\n期待値: vendor_survey = "確認済み"');
  console.log('実際の値: vendor_survey =', JSON.stringify(buyer.vendor_survey));
  
  if (buyer.vendor_survey === '確認済み') {
    console.log('\n✅ 正しく同期されています');
  } else {
    console.log('\n❌ 同期されていません（スプレッドシートでは「確認済み」）');
  }
}

checkBuyer7260().catch(console.error);
