/**
 * GASが「内覧日前日」としてカウントした買主を確認するスクリプト
 * 
 * 2026-04-03 20:11時点で3件あった買主を特定します。
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkGasViewingDayBeforeLogic() {
  console.log('🔍 GASが「内覧日前日」としてカウントした買主を確認\n');

  // 1. 内覧日が2026-03-01～2026-05-31の買主を取得
  // （2026-04-03時点で「内覧日前日」としてカウントされた可能性がある）
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, latest_viewing_date, follow_up_assignee, initial_assignee, notification_sender')
    .is('deleted_at', null)
    .gte('latest_viewing_date', '2026-03-01')
    .lte('latest_viewing_date', '2026-05-31');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 内覧日が2026-03-01～2026-05-31の買主: ${buyers?.length || 0}件\n`);

  if (!buyers || buyers.length === 0) {
    console.log('該当する買主が見つかりませんでした。');
    return;
  }

  // 2. GASのロジックで「内覧日前日」に該当するか確認
  console.log('📋 GASのロジックで確認:\n');

  const gasLogicMatches: any[] = [];

  for (const buyer of buyers) {
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee;
    const isAssigneeValid = assignee && assignee !== '外す';
    const viewingDate = buyer.latest_viewing_date;
    const notificationSender = buyer.notification_sender;

    if (!isAssigneeValid || !viewingDate || notificationSender) {
      continue;
    }

    // GASのロジック: 2026-04-03時点で判定
    const gasCheckDate = new Date('2026-04-03T00:00:00+09:00');
    const vDate = new Date(viewingDate + 'T00:00:00+09:00');
    const vDay = vDate.getDay();
    const daysBeforeViewing = (vDay === 4) ? 2 : 1;  // 木曜内覧のみ2日前
    const notifyDate = new Date(vDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

    if (notifyDate.getTime() === gasCheckDate.getTime()) {
      gasLogicMatches.push({
        buyer_number: buyer.buyer_number,
        viewing_date: viewingDate,
        viewing_day: ['日', '月', '火', '水', '木', '金', '土'][vDay],
        assignee: assignee,
        notification_sender: notificationSender,
        notify_date: notifyDate.toISOString().split('T')[0],
        days_before: daysBeforeViewing,
      });
    }
  }

  console.log(`✅ GASのロジックで「内覧日前日」に該当: ${gasLogicMatches.length}件\n`);

  if (gasLogicMatches.length > 0) {
    console.log('📋 詳細:');
    gasLogicMatches.forEach((buyer, index) => {
      console.log(`  ${index + 1}. 買主番号: ${buyer.buyer_number}`);
      console.log(`     内覧日: ${buyer.viewing_date} (${buyer.viewing_day}曜日)`);
      console.log(`     通知日: ${buyer.notify_date} (${buyer.days_before}日前)`);
      console.log(`     担当: ${buyer.assignee}`);
      console.log(`     通知送信者: ${buyer.notification_sender || '(空)'}`);
      console.log('');
    });
  }

  // 3. バックエンドのロジックで確認（2026-04-04時点）
  console.log('📋 バックエンドのロジックで確認（2026-04-04時点）:\n');

  const backendLogicMatches: any[] = [];

  for (const buyer of buyers) {
    const assignee = buyer.follow_up_assignee || buyer.initial_assignee;
    const isAssigneeValid = assignee && assignee !== '外す';
    const viewingDate = buyer.latest_viewing_date;
    const notificationSender = buyer.notification_sender;

    if (!isAssigneeValid || !viewingDate || notificationSender) {
      continue;
    }

    // バックエンドのロジック: 2026-04-04時点で判定
    const backendCheckDate = new Date('2026-04-04T00:00:00+09:00');
    const vDate = new Date(viewingDate + 'T00:00:00+09:00');
    const vDay = vDate.getDay();
    const daysBeforeViewing = (vDay === 4) ? 2 : 1;
    const notifyDate = new Date(vDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

    if (notifyDate.getTime() === backendCheckDate.getTime()) {
      backendLogicMatches.push({
        buyer_number: buyer.buyer_number,
        viewing_date: viewingDate,
        viewing_day: ['日', '月', '火', '水', '木', '金', '土'][vDay],
        assignee: assignee,
        notification_sender: notificationSender,
        notify_date: notifyDate.toISOString().split('T')[0],
        days_before: daysBeforeViewing,
      });
    }
  }

  console.log(`✅ バックエンドのロジックで「内覧日前日」に該当: ${backendLogicMatches.length}件\n`);

  if (backendLogicMatches.length > 0) {
    console.log('📋 詳細:');
    backendLogicMatches.forEach((buyer, index) => {
      console.log(`  ${index + 1}. 買主番号: ${buyer.buyer_number}`);
      console.log(`     内覧日: ${buyer.viewing_date} (${buyer.viewing_day}曜日)`);
      console.log(`     通知日: ${buyer.notify_date} (${buyer.days_before}日前)`);
      console.log(`     担当: ${buyer.assignee}`);
      console.log(`     通知送信者: ${buyer.notification_sender || '(空)'}`);
      console.log('');
    });
  }

  // 4. 結論
  console.log('📊 結論:');
  console.log(`  GAS（2026-04-03時点）: ${gasLogicMatches.length}件`);
  console.log(`  バックエンド（2026-04-04時点）: ${backendLogicMatches.length}件`);
  console.log(`  差分: ${Math.abs(gasLogicMatches.length - backendLogicMatches.length)}件`);
}

checkGasViewingDayBeforeLogic().catch(console.error);
