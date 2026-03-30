/**
 * 買主番号7260のデータ整合性を確認するスクリプト
 * 
 * 確認項目:
 * 1. buyer_numberが存在するか
 * 2. deleted_atがnullか（ソフトデリートされていないか）
 * 3. 初動担当フィールドの値
 * 4. その他の基本情報
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer7260() {
  console.log('🔍 買主番号7260のデータ整合性を確認中...\n');

  try {
    // 買主番号7260を取得
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, initial_assignee, deleted_at, created_at, updated_at')
      .eq('buyer_number', '7260')
      .single();

    if (error) {
      console.error('❌ エラー:', error.message);
      console.error('詳細:', error);
      return;
    }

    if (!buyer) {
      console.error('❌ 買主番号7260が見つかりません');
      return;
    }

    console.log('✅ 買主番号7260が見つかりました\n');
    console.log('📊 データ詳細:');
    console.log('  - buyer_number:', buyer.buyer_number);
    console.log('  - name:', buyer.name);
    console.log('  - initial_assignee:', buyer.initial_assignee);
    console.log('  - deleted_at:', buyer.deleted_at);
    console.log('  - created_at:', buyer.created_at);
    console.log('  - updated_at:', buyer.updated_at);
    console.log('');

    // データ整合性チェック
    console.log('🔍 データ整合性チェック:');
    
    if (buyer.deleted_at) {
      console.log('  ⚠️  deleted_atが設定されています（ソフトデリート済み）');
    } else {
      console.log('  ✅ deleted_atはnull（アクティブ）');
    }

    console.log('');
    console.log('✅ 確認完了');

  } catch (err) {
    console.error('❌ 予期しないエラー:', err);
  }
}

checkBuyer7260();
