// 買主番号7260のスプレッドシートデータを簡易確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7260SpreadsheetSimple() {
  console.log('=== 買主番号7260のスプレッドシートデータ簡易確認 ===\n');

  try {
    // 1. 買主番号7260のDBデータを取得
    console.log('1. 買主番号7260のDBデータを取得中...');
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, initial_assignee, last_synced_at, db_updated_at')
      .eq('buyer_number', '7260')
      .maybeSingle();

    if (buyerError) {
      console.error('❌ エラー:', buyerError.message);
      return;
    }

    if (!buyer) {
      console.error('❌ 買主番号7260のレコードが見つかりません');
      return;
    }

    console.log('   買主番号:', buyer.buyer_number);
    console.log('   buyer_id:', buyer.buyer_id || '（null）');
    console.log('   氏名:', buyer.name || '（空欄）');
    console.log('   初動担当（DB）:', buyer.initial_assignee || '（空欄）');
    console.log('   last_synced_at:', buyer.last_synced_at || '（null）');
    console.log('   db_updated_at:', buyer.db_updated_at || '（null）');
    console.log('');

    // 2. 409エラーの原因分析
    console.log('2. 409エラーの原因分析:');
    
    if (!buyer.buyer_id) {
      console.log('❌ buyer_idがnullです');
      console.log('   → 404エラーの原因です');
      console.log('   → fix-buyer-7260-buyer-id.tsスクリプトで修復してください');
      console.log('');
    } else {
      console.log('✅ buyer_idが設定されています');
      console.log('   → 404エラーは解消されているはずです');
      console.log('');
    }

    if (!buyer.last_synced_at) {
      console.log('✅ last_synced_atがnullのため、競合チェックはスキップされます');
      console.log('   → 409エラーは発生しないはずです');
      console.log('');
    } else {
      console.log('⚠️  last_synced_atが設定されています');
      console.log('   → 競合チェックが実行されます');
      console.log('');
      console.log('   競合チェックの仕組み:');
      console.log('   1. スプレッドシートの現在値を取得');
      console.log('   2. DBの期待値（編集前の値）と比較');
      console.log('   3. 異なる場合は409エラーを返す');
      console.log('');
      console.log('   409エラーを回避する方法:');
      console.log('   - force=trueオプションを使用して競合チェックをスキップ');
      console.log('   - スプレッドシートの値をDBに合わせる');
      console.log('   - last_synced_atをnullにリセット（非推奨）');
      console.log('');
    }

    // 3. 結論
    console.log('3. 結論:');
    console.log('');
    console.log('   404エラーの状態:');
    if (buyer.buyer_id) {
      console.log('   ✅ 修復済み（buyer_idが設定されている）');
    } else {
      console.log('   ❌ 未修復（buyer_idがnull）');
    }
    console.log('');
    console.log('   409エラーの状態:');
    if (!buyer.last_synced_at) {
      console.log('   ✅ 発生しない（last_synced_atがnull）');
    } else {
      console.log('   ⚠️  発生する可能性あり（last_synced_atが設定されている）');
      console.log('   → スプレッドシートの初動担当カラムの値がDBと異なる場合');
      console.log('   → 解決策: force=trueオプションを使用');
    }

  } catch (error: any) {
    console.error('❌ 予期しないエラー:', error.message);
  }
}

checkBuyer7260SpreadsheetSimple();
