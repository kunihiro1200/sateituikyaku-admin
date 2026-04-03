/**
 * 「内覧日前日」としてカウントされている買主を確認するスクリプト
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { supabase } from './src/config/supabase';
import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

async function checkViewingDayBeforeBuyers() {
  console.log('🔍 「内覧日前日」の買主を確認\n');

  // 1. 全買主を取得
  const { data: allBuyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, latest_viewing_date, notification_sender')
    .is('deleted_at', null);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📊 全買主数: ${allBuyers?.length || 0}件\n`);

  // 2. 各買主のステータスを計算
  const viewingDayBeforeBuyers: any[] = [];
  
  for (const buyer of allBuyers || []) {
    try {
      const statusResult = calculateBuyerStatus(buyer);
      if (statusResult.status === '内覧日前日') {
        viewingDayBeforeBuyers.push({
          ...buyer,
          calculated_status: statusResult.status,
        });
      }
    } catch (error) {
      // エラーは無視
    }
  }

  console.log(`✅ 「内覧日前日」の買主: ${viewingDayBeforeBuyers.length}件\n`);

  if (viewingDayBeforeBuyers.length > 0) {
    console.log('📋 詳細:');
    viewingDayBeforeBuyers.forEach((buyer, index) => {
      console.log(`  ${index + 1}. 買主番号: ${buyer.buyer_number}`);
      console.log(`     内覧日: ${buyer.latest_viewing_date}`);
      console.log(`     通知送信者: ${buyer.notification_sender}`);
      console.log('');
    });
  }

  // 3. 現在の日時を表示
  console.log('📅 現在の日時（JST）:');
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  console.log(`  ${jstNow.toISOString().split('T')[0]} (${['日', '月', '火', '水', '木', '金', '土'][jstNow.getUTCDay()]}曜日)`);
  console.log(`  時刻: ${jstNow.toISOString().split('T')[1].split('.')[0]}`);
}

checkViewingDayBeforeBuyers().catch(console.error);
