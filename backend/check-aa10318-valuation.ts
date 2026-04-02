import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA10318Valuation() {
  console.log('🔍 AA10318の査定額を確認中...\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA10318')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!seller) {
    console.log('❌ AA10318が見つかりません');
    return;
  }

  console.log('📊 DBの査定額（円単位）:');
  console.log(`  査定額1: ${seller.valuation_amount_1 ? seller.valuation_amount_1.toLocaleString() : 'null'}`);
  console.log(`  査定額2: ${seller.valuation_amount_2 ? seller.valuation_amount_2.toLocaleString() : 'null'}`);
  console.log(`  査定額3: ${seller.valuation_amount_3 ? seller.valuation_amount_3.toLocaleString() : 'null'}`);

  console.log('\n📊 DBの査定額（万円単位）:');
  console.log(`  査定額1: ${seller.valuation_amount_1 ? seller.valuation_amount_1 / 10000 : 'null'}万円`);
  console.log(`  査定額2: ${seller.valuation_amount_2 ? seller.valuation_amount_2 / 10000 : 'null'}万円`);
  console.log(`  査定額3: ${seller.valuation_amount_3 ? seller.valuation_amount_3 / 10000 : 'null'}万円`);

  console.log('\n📋 スプレッドシートの期待値:');
  console.log('  CB/CC/CD列（手動入力）: 2250、2600、2800万円');
  console.log('  BC/BD/BE列（自動計算）: 確認が必要');

  console.log('\n✅ 判定:');
  if (seller.valuation_amount_1 === 22500000 && 
      seller.valuation_amount_2 === 26000000 && 
      seller.valuation_amount_3 === 28000000) {
    console.log('  ❌ CB/CC/CD列（手動入力）から同期されています');
    console.log('  → 修正が必要: BC/BD/BE列（自動計算）から同期されるべき');
  } else {
    console.log('  ✅ BC/BD/BE列（自動計算）から同期されている可能性があります');
    console.log('  → スプレッドシートのBC/BD/BE列の値を確認してください');
  }
}

checkAA10318Valuation().catch(console.error);
