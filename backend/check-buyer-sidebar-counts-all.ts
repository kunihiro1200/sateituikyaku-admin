/**
 * buyer_sidebar_countsテーブルの全データを確認するスクリプト
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkBuyerSidebarCountsAll() {
  console.log('🔍 buyer_sidebar_countsテーブルの全データを確認\n');

  // 1. 全レコード数を確認
  const { count: totalCount, error: countError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ エラー:', countError);
    return;
  }

  console.log(`📊 全レコード数: ${totalCount}件\n`);

  // 2. 全データを取得
  const { data: allCounts, error: allError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (allError) {
    console.error('❌ エラー:', allError);
    return;
  }

  if (!allCounts || allCounts.length === 0) {
    console.log('データが見つかりませんでした。');
    return;
  }

  console.log('📋 全データ:\n');
  allCounts.forEach((count, index) => {
    console.log(`  ${index + 1}. カテゴリ: ${count.category}`);
    console.log(`     カウント: ${count.count}`);
    console.log(`     ラベル: ${count.label || '(なし)'}`);
    console.log(`     担当: ${count.assignee || '(なし)'}`);
    console.log(`     更新日時: ${count.updated_at}`);
    console.log('');
  });

  // 3. カテゴリ別の集計
  console.log('📊 カテゴリ別の集計:\n');
  const categoryMap = new Map<string, number>();
  allCounts.forEach((count) => {
    const current = categoryMap.get(count.category) || 0;
    categoryMap.set(count.category, current + count.count);
  });

  Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, total]) => {
      console.log(`  ${category}: ${total}件`);
    });
}

checkBuyerSidebarCountsAll().catch(console.error);
