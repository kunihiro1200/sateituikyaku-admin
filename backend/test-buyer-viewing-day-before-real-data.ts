/**
 * 実際のデータで「内覧日前日」フィルターの動作を確認するテスト
 * 
 * このテストは、実際のデータベースから買主を取得して、
 * サイドバーカウントと一覧表示のカウントが一致するか確認します。
 */

import dotenv from 'dotenv';
import path from 'path';

// 環境変数を最初に読み込む
dotenv.config({ path: path.join(__dirname, '.env.local') });

// 環境変数が読み込まれたことを確認
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 環境変数が読み込まれていません');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? '設定済み' : '未設定');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '設定済み' : '未設定');
  process.exit(1);
}

import { BuyerService } from './src/services/BuyerService';
import { supabase } from './src/config/supabase';

async function testViewingDayBeforeFilter() {
  console.log('🔍 実際のデータで「内覧日前日」フィルターをテスト\n');

  const buyerService = new BuyerService();

  // 1. サイドバーカウントを取得
  console.log('📊 Step 1: サイドバーカウントを取得');
  const { data: sidebarCounts, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'viewingDayBefore');

  if (sidebarError) {
    console.error('❌ サイドバーカウント取得エラー:', sidebarError);
    return;
  }

  console.log('サイドバーカウント:', sidebarCounts);
  const sidebarCount = sidebarCounts?.reduce((sum, row) => sum + (row.count || 0), 0) || 0;
  console.log(`✅ サイドバーカウント合計: ${sidebarCount}件\n`);

  // 2. 一覧表示のカウントを取得
  console.log('📊 Step 2: 一覧表示のカウントを取得');
  const result = await buyerService.getBuyersByStatus('内覧日前日', { page: 1, limit: 1000 });
  console.log(`✅ 一覧表示カウント: ${result.total}件\n`);

  // 3. 結果を比較
  console.log('📊 Step 3: 結果を比較');
  console.log(`サイドバーカウント: ${sidebarCount}件`);
  console.log(`一覧表示カウント: ${result.total}件`);

  if (sidebarCount === result.total) {
    console.log('✅ カウントが一致しています！');
  } else {
    console.log(`❌ カウントが不一致です！差分: ${Math.abs(sidebarCount - result.total)}件`);
    
    // 詳細を表示
    console.log('\n📋 一覧表示の買主（最初の10件）:');
    result.data.slice(0, 10).forEach((buyer, index) => {
      console.log(`  ${index + 1}. 買主番号: ${buyer.buyer_number}, 内覧日: ${buyer.latest_viewing_date}, 通知送信者: ${buyer.notification_sender}`);
    });
  }

  // 4. 現在の日時を表示
  console.log('\n📅 現在の日時（JST）:');
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  console.log(`  ${jstNow.toISOString().split('T')[0]} (${['日', '月', '火', '水', '木', '金', '土'][jstNow.getUTCDay()]}曜日)`);
}

testViewingDayBeforeFilter().catch(console.error);
