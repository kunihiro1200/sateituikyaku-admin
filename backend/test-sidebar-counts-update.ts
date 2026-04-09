/**
 * サイドバーカウント更新テストスクリプト
 * 
 * タスク3.2.1: ローカル環境でサイドバーカウント更新を実行
 */

import { createClient } from '@supabase/supabase-js';
import { SellerSidebarCountsUpdateService } from './src/services/SellerSidebarCountsUpdateService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function main() {
  console.log('🚀 サイドバーカウント更新テストを開始します...\n');

  // 環境変数を読み込む（ダブルクォートを削除）
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/^"|"$/g, '');
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.replace(/^"|"$/g, '');

  console.log('環境変数の確認:');
  console.log('  SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '(未設定)');
  console.log('  SUPABASE_SERVICE_KEY:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : '(未設定)');
  console.log('');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ エラー: SUPABASE_URLまたはSUPABASE_SERVICE_KEYが設定されていません');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // サイドバーカウント更新サービスを作成
  const updateService = new SellerSidebarCountsUpdateService(supabase);

  try {
    // サイドバーカウント更新を実行
    console.log('📊 サイドバーカウント更新を実行中...\n');
    await updateService.updateSellerSidebarCounts();
    console.log('\n✅ サイドバーカウント更新が完了しました\n');

    // 更新後のデータを確認
    console.log('📋 更新後のデータを確認します...\n');

    // visitDayBeforeカテゴリーのレコードを取得
    const { data: visitDayBeforeRecords, error: visitDayBeforeError } = await supabase
      .from('seller_sidebar_counts')
      .select('*')
      .eq('category', 'visitDayBefore')
      .order('id', { ascending: true });

    if (visitDayBeforeError) {
      console.error('❌ エラー:', visitDayBeforeError);
    } else {
      console.log('📊 visitDayBeforeカテゴリーのレコード:');
      console.log(`   レコード数: ${visitDayBeforeRecords?.length || 0}`);
      if (visitDayBeforeRecords && visitDayBeforeRecords.length > 0) {
        visitDayBeforeRecords.forEach((record, index) => {
          console.log(`   [${index + 1}] id: ${record.id}, count: ${record.count}, label: ${record.label || '(null)'}, assignee: ${record.assignee || '(null)'}`);
        });
      }
      console.log('');
    }

    // 全カテゴリーのサマリーを表示
    const { data: allRecords, error: allError } = await supabase
      .from('seller_sidebar_counts')
      .select('category, count')
      .order('category', { ascending: true });

    if (allError) {
      console.error('❌ エラー:', allError);
    } else {
      console.log('📊 全カテゴリーのサマリー:');
      const categorySummary: Record<string, number> = {};
      allRecords?.forEach(record => {
        if (!categorySummary[record.category]) {
          categorySummary[record.category] = 0;
        }
        categorySummary[record.category] += record.count;
      });
      Object.entries(categorySummary).forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });
      console.log('');
    }

    console.log('✅ テスト完了');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
