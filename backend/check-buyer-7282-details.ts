/**
 * 買主7282の詳細を確認するスクリプト
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkBuyer7282Details() {
  console.log('🔍 買主7282の詳細を確認\n');

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7282')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!buyer) {
    console.log('❌ 買主7282が見つかりません');
    return;
  }

  console.log('📋 買主7282の情報:\n');
  console.log(`  買主番号: ${buyer.buyer_number}`);
  console.log(`  内覧日: ${buyer.latest_viewing_date || '(なし)'}`);
  console.log(`  業者問合せ: ${buyer.broker_inquiry || '(なし)'}`);
  console.log(`  通知送信者: ${buyer.notification_sender || '(空)'}`);
  console.log('');

  // 日付計算
  if (buyer.latest_viewing_date) {
    const viewingDate = new Date(buyer.latest_viewing_date);
    viewingDate.setHours(0, 0, 0, 0);

    const dayOfWeek = viewingDate.getDay();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const daysBeforeViewing = dayOfWeek === 4 ? 2 : 1;

    const notifyDate = new Date(viewingDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('📅 日付計算:\n');
    console.log(`  内覧日: ${viewingDate.toISOString().split('T')[0]} (${dayNames[dayOfWeek]}曜日)`);
    console.log(`  通知日: ${notifyDate.toISOString().split('T')[0]} (${daysBeforeViewing}日前)`);
    console.log(`  今日: ${today.toISOString().split('T')[0]}`);
    console.log('');

    if (today.getTime() === notifyDate.getTime()) {
      console.log('✅ 今日が「内覧日前日」です');
    } else {
      console.log('❌ 今日は「内覧日前日」ではありません');
      console.log(`  差分: ${Math.floor((notifyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}日`);
    }
  }

  // 条件チェック
  console.log('\n🔍 条件チェック:\n');
  console.log(`  1. latest_viewing_dateが空でない: ${buyer.latest_viewing_date ? '✅' : '❌'}`);
  console.log(`  2. broker_inquiryが「業者問合せ」でない: ${buyer.broker_inquiry !== '業者問合せ' ? '✅' : '❌'}`);
  console.log(`  3. notification_senderが空である: ${!buyer.notification_sender ? '✅' : '❌'}`);
}

checkBuyer7282Details().catch(console.error);
