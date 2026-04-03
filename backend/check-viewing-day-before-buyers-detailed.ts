/**
 * viewingDayBeforeカテゴリの買主を詳細確認するスクリプト
 * 
 * 目的: データベースに2件表示される理由を調査
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkViewingDayBeforeBuyersDetailed() {
  console.log('🔍 viewingDayBeforeカテゴリの買主を詳細確認\n');

  // 1. buyer_sidebar_countsテーブルからviewingDayBeforeを取得
  console.log('📊 ステップ1: buyer_sidebar_countsテーブルを確認');
  const { data: sidebarData, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'viewingDayBefore');

  if (sidebarError) {
    console.error('❌ エラー:', sidebarError);
    return;
  }

  console.log(`  レコード数: ${sidebarData?.length || 0}件\n`);
  
  if (sidebarData && sidebarData.length > 0) {
    sidebarData.forEach((record, index) => {
      console.log(`  ${index + 1}. カテゴリ: ${record.category}`);
      console.log(`     カウント: ${record.count}`);
      console.log(`     ラベル: ${record.label || '(なし)'}`);
      console.log(`     担当: ${record.assignee || '(なし)'}`);
      console.log(`     更新日時: ${record.updated_at}`);
      console.log('');
    });
  }

  const totalCount = sidebarData?.reduce((sum, record) => sum + (record.count || 0), 0) || 0;
  console.log(`  合計カウント: ${totalCount}件\n`);

  // 2. 全買主を取得して手動で「内覧日前日」条件を満たす買主を計算
  console.log('📋 ステップ2: 全買主から「内覧日前日」条件を満たす買主を手動計算');
  
  // ページネーション対応で全買主を取得
  let allBuyers: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number, latest_viewing_date, broker_inquiry, notification_sender')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ エラー:', error);
      return;
    }

    if (!data || data.length === 0) break;

    allBuyers = allBuyers.concat(data);

    if (data.length < pageSize) break;
    page++;
  }

  const buyersError = null;

  if (buyersError) {
    console.error('❌ エラー:', buyersError);
    return;
  }

  console.log(`  全買主数: ${allBuyers?.length || 0}件\n`);

  // 今日の日付（JST）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  console.log(`  今日の日付（JST）: ${today.toISOString().split('T')[0]}\n`);

  // 「内覧日前日」条件を満たす買主を手動で計算
  const viewingDayBeforeBuyers = allBuyers?.filter(buyer => {
    // 条件1: latest_viewing_dateが空でない
    if (!buyer.latest_viewing_date) return false;

    // 条件2: broker_inquiryが「業者問合せ」でない
    if (buyer.broker_inquiry === '業者問合せ') return false;

    // 条件3: notification_senderが空である
    if (buyer.notification_sender) return false;

    // 日付計算
    const viewingDate = new Date(buyer.latest_viewing_date);
    viewingDate.setHours(0, 0, 0, 0);

    const dayOfWeek = viewingDate.getDay();
    const daysBeforeViewing = dayOfWeek === 4 ? 2 : 1; // 木曜日は2日前、それ以外は1日前

    const notifyDate = new Date(viewingDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

    return today.getTime() === notifyDate.getTime();
  }) || [];

  console.log(`  「内覧日前日」条件を満たす買主: ${viewingDayBeforeBuyers.length}件\n`);

  if (viewingDayBeforeBuyers.length > 0) {
    console.log('  詳細:\n');
    viewingDayBeforeBuyers.forEach((buyer, index) => {
      const viewingDate = new Date(buyer.latest_viewing_date!);
      viewingDate.setHours(0, 0, 0, 0);
      const dayOfWeek = viewingDate.getDay();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const daysBeforeViewing = dayOfWeek === 4 ? 2 : 1;

      console.log(`  ${index + 1}. 買主番号: ${buyer.buyer_number}`);
      console.log(`     内覧日: ${buyer.latest_viewing_date} (${dayNames[dayOfWeek]}曜日)`);
      console.log(`     通知日: ${daysBeforeViewing}日前`);
      console.log(`     業者問合せ: ${buyer.broker_inquiry || '(なし)'}`);
      console.log(`     通知送信者: ${buyer.notification_sender || '(空)'}`);
      console.log('');
    });
  } else {
    console.log('  該当する買主はいません。\n');
  }

  // 3. 比較
  console.log('📊 ステップ3: 比較');
  console.log(`  buyer_sidebar_countsテーブル: ${totalCount}件`);
  console.log(`  手動計算結果: ${viewingDayBeforeBuyers.length}件`);
  console.log(`  差分: ${Math.abs(totalCount - viewingDayBeforeBuyers.length)}件\n`);

  if (totalCount === viewingDayBeforeBuyers.length) {
    console.log('✅ カウント一致');
  } else {
    console.log('❌ カウント不一致');
    console.log('\n🚨 不一致の原因を調査する必要があります:');
    console.log('  1. GASが古いデータを削除せずに追加している可能性');
    console.log('  2. 複数回実行されて重複している可能性');
    console.log('  3. 別の買主が条件を満たしている可能性');
  }
}

checkViewingDayBeforeBuyersDetailed().catch(console.error);
