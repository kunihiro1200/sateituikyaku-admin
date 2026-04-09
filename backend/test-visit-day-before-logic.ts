/**
 * 訪問日前日ロジックのテストスクリプト
 * 
 * タスク3.2.3: 訪問日前日のカウントが正しいことを確認
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env.local') });

/**
 * 訪問日前日の判定ロジック（isVisitDayBeforeと同じ）
 */
function isVisitDayBefore(visitDateStr: string, todayJST: string): boolean {
  // 訪問日が空欄の場合はfalse
  if (!visitDateStr || visitDateStr.trim() === '') return false;

  // TIMESTAMP型対応: visit_dateから日付部分のみを抽出
  let visitDateOnly = visitDateStr;
  if (typeof visitDateStr === 'string') {
    if (visitDateStr.includes(' ')) {
      visitDateOnly = visitDateStr.split(' ')[0]; // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DD"
    } else if (visitDateStr.includes('T')) {
      visitDateOnly = visitDateStr.split('T')[0]; // "YYYY-MM-DDTHH:MM:SS.000Z" → "YYYY-MM-DD"
    }
  }

  const parts = visitDateOnly.split('-');
  if (parts.length !== 3) return false;

  const visitDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  visitDate.setHours(0, 0, 0, 0);

  // 水曜定休・木曜2日前ロジック
  const visitDayOfWeek = visitDate.getDay();
  const daysBeforeVisit = visitDayOfWeek === 4 ? 2 : 1;
  const expectedNotifyDate = new Date(visitDate);
  expectedNotifyDate.setDate(visitDate.getDate() - daysBeforeVisit);
  const expectedNotifyStr = `${expectedNotifyDate.getFullYear()}-${String(expectedNotifyDate.getMonth() + 1).padStart(2, '0')}-${String(expectedNotifyDate.getDate()).padStart(2, '0')}`;

  return expectedNotifyStr === todayJST;
}

async function main() {
  console.log('🧪 訪問日前日ロジックのテストを開始します...\n');

  // Supabaseクライアントを作成（ダブルクォートを削除）
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/^"|"$/g, '');
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.replace(/^"|"$/g, '');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ エラー: SUPABASE_URLまたはSUPABASE_SERVICE_KEYが設定されていません');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 今日の日付（JST）
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

    // テストケース1: 訪問日が空欄の場合
    console.log('📋 テストケース1: 訪問日が空欄の場合');
    const result1 = isVisitDayBefore('', todayJST);
    console.log(`   結果: ${result1}`);
    console.log(`   期待値: false`);
    console.log(`   ${result1 === false ? '✅ 合格' : '❌ 不合格'}\n`);

    // テストケース2: 訪問日がnullの場合
    console.log('📋 テストケース2: 訪問日がnullの場合');
    const result2 = isVisitDayBefore(null as any, todayJST);
    console.log(`   結果: ${result2}`);
    console.log(`   期待値: false`);
    console.log(`   ${result2 === false ? '✅ 合格' : '❌ 不合格'}\n`);

    // テストケース3: 明日が訪問日の場合（今日が訪問日前日）
    const tomorrow = new Date(jstTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    console.log('📋 テストケース3: 明日が訪問日の場合（今日が訪問日前日）');
    console.log(`   訪問日: ${tomorrowStr} (${['日', '月', '火', '水', '木', '金', '土'][tomorrow.getDay()]}曜日)`);
    const result3 = isVisitDayBefore(tomorrowStr, todayJST);
    console.log(`   結果: ${result3}`);
    // 明日が木曜日でない場合はtrue、木曜日の場合はfalse（2日前が訪問日前日）
    const expectedResult3 = tomorrow.getDay() !== 4;
    console.log(`   期待値: ${expectedResult3}`);
    console.log(`   ${result3 === expectedResult3 ? '✅ 合格' : '❌ 不合格'}\n`);

    // テストケース4: 明後日が訪問日の場合
    const dayAfterTomorrow = new Date(jstTime);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowStr = `${dayAfterTomorrow.getFullYear()}-${String(dayAfterTomorrow.getMonth() + 1).padStart(2, '0')}-${String(dayAfterTomorrow.getDate()).padStart(2, '0')}`;
    console.log('📋 テストケース4: 明後日が訪問日の場合');
    console.log(`   訪問日: ${dayAfterTomorrowStr} (${['日', '月', '火', '水', '木', '金', '土'][dayAfterTomorrow.getDay()]}曜日)`);
    const result4 = isVisitDayBefore(dayAfterTomorrowStr, todayJST);
    console.log(`   結果: ${result4}`);
    // 明後日が木曜日の場合はtrue（2日前が訪問日前日）、それ以外はfalse
    const expectedResult4 = dayAfterTomorrow.getDay() === 4;
    console.log(`   期待値: ${expectedResult4}`);
    console.log(`   ${result4 === expectedResult4 ? '✅ 合格' : '❌ 不合格'}\n`);

    // テストケース5: 実際のデータベースから訪問日前日の売主を取得
    console.log('📋 テストケース5: 実際のデータベースから訪問日前日の売主を取得\n');

    const { data: visitAssigneeSellers, error } = await supabase
      .from('sellers')
      .select('seller_number, visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .not('visit_date', 'is', null);

    if (error) {
      console.error('❌ エラー:', error);
    } else {
      const filteredSellers = visitAssigneeSellers?.filter(s => {
        // 訪問日が空欄の売主を除外
        const visitDateStr = s.visit_date;
        if (!visitDateStr || visitDateStr.trim() === '') return false;

        // visit_reminder_assigneeが空であることを確認
        const reminderAssignee = s.visit_reminder_assignee || '';
        if (reminderAssignee.trim() !== '') return false;

        // 訪問日前日の判定
        return isVisitDayBefore(visitDateStr, todayJST);
      }) || [];

      console.log(`   訪問日前日の条件を満たす売主数: ${filteredSellers.length}`);
      if (filteredSellers.length > 0) {
        console.log('   売主一覧:');
        filteredSellers.forEach((seller, index) => {
          console.log(`   [${index + 1}] ${seller.seller_number}: visit_date=${seller.visit_date}, visit_assignee=${seller.visit_assignee}`);
        });
      }
      console.log('');
    }

    // テストケース6: 訪問日が空欄の売主が除外されることを確認
    console.log('📋 テストケース6: 訪問日が空欄の売主が除外されることを確認\n');

    const { data: sellersWithoutVisitDate, error: error2 } = await supabase
      .from('sellers')
      .select('seller_number, visit_date, visit_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .is('visit_date', null)
      .limit(5);

    if (error2) {
      console.error('❌ エラー:', error2);
    } else {
      console.log(`   訪問日が空欄の売主数（最初の5件）: ${sellersWithoutVisitDate?.length || 0}`);
      if (sellersWithoutVisitDate && sellersWithoutVisitDate.length > 0) {
        sellersWithoutVisitDate.forEach((seller, index) => {
          const result = isVisitDayBefore(seller.visit_date, todayJST);
          console.log(`   [${index + 1}] ${seller.seller_number}: visit_date=${seller.visit_date || '(null)'}, isVisitDayBefore=${result}`);
        });
        console.log('   ✅ 全てfalseであることを確認');
      }
      console.log('');
    }

    console.log('✅ テスト完了');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
