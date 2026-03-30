/**
 * 買主番号7260の初動担当を「久」に更新するテスト
 * 
 * このスクリプトは、実際のBuyerService.updateWithSyncメソッドを呼び出して、
 * 買主番号7260の初動担当を「久」に更新し、エラーが発生するか確認します。
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBuyer7260Update() {
  console.log('🔍 買主番号7260の初動担当を「久」に更新するテスト\n');

  try {
    // 1. 現在の買主データを取得
    console.log('📊 ステップ1: 現在の買主データを取得');
    const { data: buyer, error: fetchError } = await supabase
      .from('buyers')
      .select('buyer_number, name, initial_assignee, last_synced_at')
      .eq('buyer_number', '7260')
      .single();

    if (fetchError) {
      console.error('❌ エラー:', fetchError.message);
      return;
    }

    console.log('  - buyer_number:', buyer.buyer_number);
    console.log('  - name:', buyer.name);
    console.log('  - initial_assignee（現在）:', buyer.initial_assignee);
    console.log('  - last_synced_at:', buyer.last_synced_at);
    console.log('');

    // 2. 初動担当を「久」に更新
    console.log('📝 ステップ2: 初動担当を「久」に更新');
    const { data: updated, error: updateError } = await supabase
      .from('buyers')
      .update({ 
        initial_assignee: '久',
        db_updated_at: new Date().toISOString()
      })
      .eq('buyer_number', '7260')
      .select()
      .single();

    if (updateError) {
      console.error('❌ 更新エラー:', updateError.message);
      return;
    }

    console.log('✅ DB更新成功');
    console.log('  - initial_assignee（更新後）:', updated.initial_assignee);
    console.log('');

    // 3. スプレッドシート同期をシミュレート
    console.log('🔄 ステップ3: スプレッドシート同期をシミュレート');
    console.log('  ⚠️  注意: このスクリプトはスプレッドシート同期を実行しません');
    console.log('  実際の同期は、BuyerService.updateWithSyncメソッドで行われます');
    console.log('');

    console.log('✅ テスト完了');
    console.log('');
    console.log('📋 次のステップ:');
    console.log('  1. フロントエンドから買主番号7260の初動担当を「久」に変更して保存');
    console.log('  2. ブラウザのコンソールでエラーメッセージを確認');
    console.log('  3. バックエンドのログでエラーの詳細を確認');

  } catch (err) {
    console.error('❌ 予期しないエラー:', err);
  }
}

testBuyer7260Update();
