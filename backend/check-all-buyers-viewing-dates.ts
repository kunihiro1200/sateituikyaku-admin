/**
 * 全買主の内覧日データを確認するスクリプト
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkAllBuyersViewingDates() {
  console.log('🔍 全買主の内覧日データを確認\n');

  // 1. 全買主数を確認
  const { count: totalCount, error: countError } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (countError) {
    console.error('❌ エラー:', countError);
    return;
  }

  console.log(`📊 全買主数: ${totalCount}件\n`);

  // 2. 内覧日が設定されている買主数を確認
  const { count: viewingDateCount, error: viewingDateError } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .not('latest_viewing_date', 'is', null);

  if (viewingDateError) {
    console.error('❌ エラー:', viewingDateError);
    return;
  }

  console.log(`📊 内覧日が設定されている買主: ${viewingDateCount}件\n`);

  // 3. サンプルデータを取得（最新10件）
  const { data: sampleBuyers, error: sampleError } = await supabase
    .from('buyers')
    .select('buyer_number, latest_viewing_date, follow_up_assignee, initial_assignee, notification_sender')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (sampleError) {
    console.error('❌ エラー:', sampleError);
    return;
  }

  console.log('📋 サンプルデータ（最新10件）:\n');
  sampleBuyers?.forEach((buyer, index) => {
    console.log(`  ${index + 1}. 買主番号: ${buyer.buyer_number}`);
    console.log(`     内覧日: ${buyer.latest_viewing_date || '(未設定)'}`);
    console.log(`     追客担当: ${buyer.follow_up_assignee || '(未設定)'}`);
    console.log(`     初回担当: ${buyer.initial_assignee || '(未設定)'}`);
    console.log(`     通知送信者: ${buyer.notification_sender || '(未設定)'}`);
    console.log('');
  });

  // 4. buyer_sidebar_countsテーブルを確認
  console.log('📊 buyer_sidebar_countsテーブルを確認:\n');

  const { data: sidebarCounts, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', '内覧日前日')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (sidebarError) {
    console.error('❌ エラー:', sidebarError);
    return;
  }

  if (sidebarCounts && sidebarCounts.length > 0) {
    const latestCount = sidebarCounts[0];
    console.log(`  カテゴリ: ${latestCount.category}`);
    console.log(`  カウント: ${latestCount.count}`);
    console.log(`  ラベル: ${latestCount.label || '(なし)'}`);
    console.log(`  担当: ${latestCount.assignee || '(なし)'}`);
    console.log(`  更新日時: ${latestCount.updated_at}`);
  } else {
    console.log('  「内覧日前日」カテゴリのデータが見つかりませんでした。');
  }
}

checkAllBuyersViewingDates().catch(console.error);
