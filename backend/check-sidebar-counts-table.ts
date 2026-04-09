/**
 * seller_sidebar_countsテーブル確認スクリプト
 * 
 * タスク3.2.2: seller_sidebar_countsテーブルを確認
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function main() {
  console.log('🔍 seller_sidebar_countsテーブルを確認します...\n');

  // Supabaseクライアントを作成（ダブルクォートを削除）
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/^"|"$/g, '');
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.replace(/^"|"$/g, '');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ エラー: SUPABASE_URLまたはSUPABASE_SERVICE_KEYが設定されていません');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. visitDayBeforeカテゴリーのレコードを確認
    console.log('📊 1. visitDayBeforeカテゴリーのレコードを確認\n');
    const { data: visitDayBeforeRecords, error: visitDayBeforeError } = await supabase
      .from('seller_sidebar_counts')
      .select('*')
      .eq('category', 'visitDayBefore')
      .order('id', { ascending: true });

    if (visitDayBeforeError) {
      console.error('❌ エラー:', visitDayBeforeError);
    } else {
      console.log(`   レコード数: ${visitDayBeforeRecords?.length || 0}`);
      if (visitDayBeforeRecords && visitDayBeforeRecords.length > 0) {
        visitDayBeforeRecords.forEach((record, index) => {
          console.log(`   [${index + 1}] id: ${record.id}, count: ${record.count}, label: ${record.label || '(null)'}, assignee: ${record.assignee || '(null)'}`);
        });
      }
      console.log('');

      // 期待値チェック
      if (visitDayBeforeRecords && visitDayBeforeRecords.length === 1) {
        console.log('   ✅ レコード数が1件のみ（正常）');
      } else {
        console.log(`   ⚠️ レコード数が${visitDayBeforeRecords?.length || 0}件（期待値: 1件）`);
      }

      if (visitDayBeforeRecords && visitDayBeforeRecords.every(r => !r.label || r.label === '')) {
        console.log('   ✅ labelフィールドが空（正常）');
      } else {
        console.log('   ⚠️ labelフィールドに値が入っているレコードがあります');
      }
      console.log('');
    }

    // 2. 訪問日が空欄の売主を確認
    console.log('📊 2. 訪問日が空欄の売主を確認\n');
    const { data: sellersWithoutVisitDate, error: sellersError } = await supabase
      .from('sellers')
      .select('id, seller_number, name, visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .is('visit_date', null);

    if (sellersError) {
      console.error('❌ エラー:', sellersError);
    } else {
      console.log(`   訪問日が空欄の売主数: ${sellersWithoutVisitDate?.length || 0}`);
      if (sellersWithoutVisitDate && sellersWithoutVisitDate.length > 0) {
        console.log('   売主一覧:');
        sellersWithoutVisitDate.forEach((seller, index) => {
          console.log(`   [${index + 1}] ${seller.seller_number}: visit_date=${seller.visit_date || '(null)'}, visit_assignee=${seller.visit_assignee}, visit_reminder_assignee=${seller.visit_reminder_assignee || '(null)'}`);
        });
      }
      console.log('');
    }

    // 3. 訪問日前日の条件を満たす売主を確認
    console.log('📊 3. 訪問日前日の条件を満たす売主を確認\n');

    // 今日の日付（JST）
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    console.log(`   今日の日付（JST）: ${todayJST}\n`);

    // 訪問日前日の条件を満たす売主を取得
    const { data: visitDayBeforeSellers, error: visitDayBeforeSellersError } = await supabase
      .from('sellers')
      .select('id, seller_number, name, visit_date, visit_assignee, visit_reminder_assignee')
      .is('deleted_at', null)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .not('visit_date', 'is', null);

    if (visitDayBeforeSellersError) {
      console.error('❌ エラー:', visitDayBeforeSellersError);
    } else {
      // フィルタリング（isVisitDayBefore()と同じロジック）
      const filteredSellers = visitDayBeforeSellers?.filter(s => {
        // 訪問日が空欄の売主を除外
        const visitDateStr = s.visit_date;
        if (!visitDateStr || visitDateStr.trim() === '') return false;

        // visit_reminder_assigneeが空であることを確認
        const reminderAssignee = s.visit_reminder_assignee || '';
        if (reminderAssignee.trim() !== '') return false;

        // 訪問日前日の判定
        let visitDateOnly = visitDateStr;
        if (typeof visitDateStr === 'string') {
          if (visitDateStr.includes(' ')) {
            visitDateOnly = visitDateStr.split(' ')[0];
          } else if (visitDateStr.includes('T')) {
            visitDateOnly = visitDateStr.split('T')[0];
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

    // 4. 全カテゴリーのサマリーを表示
    console.log('📊 4. 全カテゴリーのサマリー\n');
    const { data: allRecords, error: allError } = await supabase
      .from('seller_sidebar_counts')
      .select('category, count')
      .order('category', { ascending: true });

    if (allError) {
      console.error('❌ エラー:', allError);
    } else {
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

    console.log('✅ 確認完了');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
