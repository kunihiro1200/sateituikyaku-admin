// BuyerSpreadsheetReadServiceを使用して買主番号7260のスプレッドシートデータを確認
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { BuyerSpreadsheetReadService } from './src/services/BuyerSpreadsheetReadService';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7260SpreadsheetViaService() {
  console.log('=== BuyerSpreadsheetReadServiceを使用して買主番号7260のスプレッドシートデータを確認 ===\n');

  try {
    const spreadsheetReadService = new BuyerSpreadsheetReadService();

    // 1. 買主番号7260のDBデータを取得
    console.log('1. 買主番号7260のDBデータを取得中...');
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('buyer_id, buyer_number, name, initial_assignee, last_synced_at')
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
    console.log('');

    // 2. スプレッドシートから初動担当フィールドを取得
    console.log('2. スプレッドシートから初動担当フィールドを取得中...');
    const fields = await spreadsheetReadService.getFields('7260', ['initial_assignee']);

    if (!fields) {
      console.error('❌ スプレッドシートから買主番号7260のデータを取得できませんでした');
      console.log('   可能性のある原因:');
      console.log('   - 買主番号7260の行がスプレッドシートに存在しない');
      console.log('   - スプレッドシートの読み取り権限がない');
      console.log('   - Google Sheets APIのエラー');
      return;
    }

    console.log('   初動担当（スプレッドシート）:', fields.initial_assignee || '（空欄）');
    console.log('');

    // 3. 比較
    console.log('3. DBとスプレッドシートの比較:');
    const dbValue = buyer.initial_assignee || '';
    const spreadsheetValue = fields.initial_assignee || '';

    console.log(`   DB: "${dbValue}"`);
    console.log(`   スプレッドシート: "${spreadsheetValue}"`);
    console.log(`   一致: ${dbValue === spreadsheetValue ? 'はい' : 'いいえ'}`);
    console.log('');

    // 4. 409エラーの原因分析
    console.log('4. 409エラーの原因分析:');
    if (!buyer.last_synced_at) {
      console.log('✅ last_synced_atがnullのため、競合チェックはスキップされます');
      console.log('   → 409エラーは発生しないはずです');
    } else {
      console.log(`⚠️  last_synced_at: ${buyer.last_synced_at}`);
      console.log('   → 競合チェックが実行されます');

      if (dbValue === spreadsheetValue) {
        console.log('✅ DBとスプレッドシートの値が一致しています');
        console.log('   → 競合は発生しないはずです');
      } else {
        console.log('❌ DBとスプレッドシートの値が異なります');
        console.log('   → これが409エラーの原因です');
        console.log('');
        console.log('   解決策:');
        console.log('   1. スプレッドシートの値をDBに合わせる');
        console.log('   2. DBの値をスプレッドシートに合わせる');
        console.log('   3. force=trueオプションを使用して競合チェックをスキップ');
      }
    }

    // 5. 404エラーの原因分析
    console.log('');
    console.log('5. 404エラーの原因分析:');
    if (!buyer.buyer_id) {
      console.log('❌ buyer_idがnullです');
      console.log('   → これが404エラーの原因です');
      console.log('   → fix-buyer-id-null.tsスクリプトで修復してください');
    } else {
      console.log('✅ buyer_idが設定されています');
      console.log('   → 404エラーは発生しないはずです');
    }

  } catch (error: any) {
    console.error('❌ 予期しないエラー:', error.message);
    if (error.stack) {
      console.error('   スタックトレース:', error.stack);
    }
  }
}

checkBuyer7260SpreadsheetViaService();
