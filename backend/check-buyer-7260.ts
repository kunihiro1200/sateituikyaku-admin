// 買主番号7260のデータを調査するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '設定済み' : '未設定');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7260() {
  console.log('🔍 買主番号7260のデータを調査中...\n');

  // DBから買主番号7260のデータを取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7260')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!buyer) {
    console.log('❌ 買主番号7260が見つかりません');
    return;
  }

  console.log('✅ 買主番号7260のデータ:');
  console.log('-----------------------------------');
  console.log('買主番号:', buyer.buyer_number);
  console.log('氏名:', buyer.name);
  console.log('業者向けアンケート:', buyer.vendor_survey);
  console.log('業者問合せ:', buyer.broker_inquiry);
  console.log('次電日:', buyer.next_call_date);
  console.log('最新状況:', buyer.latest_status);
  console.log('-----------------------------------\n');

  // 全フィールドを表示
  console.log('📋 全フィールド:');
  Object.keys(buyer).sort().forEach(key => {
    const value = buyer[key];
    if (value !== null && value !== '') {
      console.log(`  ${key}: ${value}`);
    }
  });
}

checkBuyer7260().catch(console.error);
