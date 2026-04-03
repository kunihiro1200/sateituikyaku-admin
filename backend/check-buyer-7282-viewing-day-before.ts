/**
 * 買主7282が現在「内覧日前日」条件を満たすか確認
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';

async function checkBuyer7282ViewingDayBefore() {
  console.log('🔍 買主7282が「内覧日前日」条件を満たすか確認\n');

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '7282')
    .single();

  if (error || !buyer) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('📋 買主7282の情報:\n');
  console.log(`  買主番号: ${buyer.buyer_number}`);
  console.log(`  内覧日: ${buyer.latest_viewing_date || '(なし)'}`);
  console.log(`  業者問合せ: ${buyer.broker_inquiry || '(なし)'}`);
  console.log(`  通知送信者: ${buyer.notification_sender || '(空)'}`);
  console.log('');

  // 条件チェック
  console.log('🔍 条件チェック:\n');
  
  const hasViewingDate = !!buyer.latest_viewing_date;
  const isNotBrokerInquiry = buyer.broker_inquiry !== '業者問合せ';
  const hasNoNotificationSender = !buyer.notification_sender;
  
  console.log(`  1. latest_viewing_dateが空でない: ${hasViewingDate ? '✅' : '❌'}`);
  console.log(`  2. broker_inquiryが「業者問合せ」でない: ${isNotBrokerInquiry ? '✅' : '❌'}`);
  console.log(`  3. notification_senderが空である: ${hasNoNotificationSender ? '✅' : '❌'}`);

  if (!hasViewingDate || !isNotBrokerInquiry || !hasNoNotificationSender) {
    console.log('\n❌ 基本条件を満たしていません');
    return;
  }

  // 日付計算
  const viewingDate = new Date(buyer.latest_viewing_date!);
  viewingDate.setHours(0, 0, 0, 0);

  const dayOfWeek = viewingDate.getDay();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const daysBeforeViewing = dayOfWeek === 4 ? 2 : 1;

  const notifyDate = new Date(viewingDate);
  notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('\n📅 日付計算:\n');
  console.log(`  内覧日: ${viewingDate.toISOString().split('T')[0]} (${dayNames[dayOfWeek]}曜日)`);
  console.log(`  通知日: ${notifyDate.toISOString().split('T')[0]} (${daysBeforeViewing}日前)`);
  console.log(`  今日: ${today.toISOString().split('T')[0]}`);
  console.log('');

  const isViewingDayBefore = today.getTime() === notifyDate.getTime();

  if (isViewingDayBefore) {
    console.log('✅ 今日が「内覧日前日」です');
  } else {
    console.log('❌ 今日は「内覧日前日」ではありません');
    const diffDays = Math.floor((notifyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      console.log(`  通知日まであと${diffDays}日`);
    } else {
      console.log(`  通知日は${Math.abs(diffDays)}日前でした`);
    }
  }
}

checkBuyer7282ViewingDayBefore().catch(console.error);
