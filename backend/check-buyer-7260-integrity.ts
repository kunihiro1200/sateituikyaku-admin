// 買主番号7260のデータ整合性チェックスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7260Integrity() {
  console.log('=== 買主番号7260のデータ整合性チェック ===\n');

  try {
    // 1. 買主番号7260のレコードを取得
    console.log('1. 買主番号7260のレコードを取得中...');
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('*')
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

    console.log('✅ 買主番号7260のレコードが見つかりました\n');

    // 2. buyer_idの確認
    console.log('2. buyer_idの確認:');
    if (!buyer.buyer_id) {
      console.error('❌ buyer_idが存在しません');
    } else {
      console.log(`✅ buyer_id: ${buyer.buyer_id}`);
    }

    // 3. deleted_atの確認
    console.log('\n3. deleted_atの確認:');
    if (buyer.deleted_at) {
      console.warn(`⚠️  deleted_at: ${buyer.deleted_at}（ソフトデリート済み）`);
    } else {
      console.log('✅ deleted_at: null（アクティブ）');
    }

    // 4. last_synced_atの確認
    console.log('\n4. last_synced_atの確認:');
    if (buyer.last_synced_at) {
      console.log(`✅ last_synced_at: ${buyer.last_synced_at}（同期済み）`);
    } else {
      console.log('⚠️  last_synced_at: null（未同期）');
    }

    // 5. initial_assigneeの確認
    console.log('\n5. initial_assigneeの確認:');
    if (buyer.initial_assignee) {
      console.log(`✅ initial_assignee: "${buyer.initial_assignee}"`);
    } else {
      console.log('⚠️  initial_assignee: 空欄');
    }

    // 6. db_updated_atの確認
    console.log('\n6. db_updated_atの確認:');
    if (buyer.db_updated_at) {
      console.log(`✅ db_updated_at: ${buyer.db_updated_at}`);
    } else {
      console.log('⚠️  db_updated_at: null');
    }

    // 7. 全フィールドの表示
    console.log('\n7. 全フィールド:');
    console.log(JSON.stringify(buyer, null, 2));

    // 8. 結論
    console.log('\n=== 結論 ===');
    const issues: string[] = [];
    if (!buyer.buyer_id) issues.push('buyer_idが存在しない');
    if (buyer.deleted_at) issues.push('ソフトデリート済み');

    if (issues.length === 0) {
      console.log('✅ データ整合性に問題はありません');
      console.log('   404エラーの原因は別の箇所にある可能性があります');
    } else {
      console.log('❌ 以下の問題が見つかりました:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n   修復スクリプトの実行が必要です');
    }

  } catch (error: any) {
    console.error('❌ 予期しないエラー:', error.message);
  }
}

checkBuyer7260Integrity();
