/**
 * 一般カテゴリの実際のフィルタリング結果を確認
 */

// 環境変数を最初に読み込む
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { SellerService } from './src/services/SellerService.supabase';

// 今日の日付（JST）を取得
function getTodayJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
}

async function checkActualFiltering() {
  console.log('🔍 一般カテゴリの実際のフィルタリング結果を確認...\n');

  const todayJST = getTodayJST();
  console.log(`📅 今日: ${todayJST}\n`);

  const sellerService = new SellerService();

  try {
    // 一般カテゴリでフィルタリング
    const result = await sellerService.listSellers({
      statusCategory: 'general',
      page: 1,
      limit: 100,
    });

    console.log(`📊 フィルタリング結果: ${result?.sellers?.length || 0}件`);
    console.log(`📊 総件数: ${result?.total || 0}件\n`);

    if (result && result.sellers && result.sellers.length > 0) {
      console.log(`📋 フィルタリング結果（最初の10件）:`);
      result.sellers.slice(0, 10).forEach(s => {
        console.log(`   - ${s.sellerNumber}: 次電日=${s.nextCallDate}, 状況=${s.status}`);
      });
    } else {
      console.log('⚠️  フィルタリング結果が0件です');
      console.log('\n🔍 条件を確認:');
      console.log('   - 専任他決打合せ <> "完了"');
      console.log('   - 次電日 <> 今日（2026-04-01）');
      console.log('   - 状況 = "一般媒介"');
      console.log('   - 契約年月 >= "2025-06-23"');
    }
  } catch (error) {
    console.error('❌ エラー:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
      console.error('   スタック:', error.stack);
    }
  }
}

checkActualFiltering().catch(console.error);
