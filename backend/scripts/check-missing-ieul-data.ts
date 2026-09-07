/**
 * イエウールメールが転記されていないケースを検出するスクリプト
 * 
 * 実行方法:
 * cd backend
 * npx tsx scripts/check-missing-ieul-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface IeulEmail {
  date: string;
  name: string;
  tel: string;
  address: string;
  found: boolean;
  sellerNumber?: string;
}

async function checkMissingData() {
  console.log('='.repeat(60));
  console.log('イエウール転記漏れチェック開始');
  console.log('='.repeat(60));

  // 2026年6月1日以降のイエウール案件を確認
  const startDate = new Date('2026-06-01');
  const endDate = new Date('2026-08-31');

  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, inquiry_site, inquiry_detailed_datetime, property_address, created_at')
    .eq('inquiry_site', 'ウ')
    .gte('inquiry_date', startDate.toISOString().split('T')[0])
    .lte('inquiry_date', endDate.toISOString().split('T')[0])
    .is('deleted_at', null)
    .order('inquiry_detailed_datetime', { ascending: true });

  if (error) {
    console.error('エラー:', error);
    return;
  }

  console.log(`\n✅ DB登録済みイエウール案件: ${sellers.length}件\n`);

  // 日付ごとの件数集計
  const countsByDate: Record<string, number> = {};
  sellers.forEach(s => {
    if (s.inquiry_detailed_datetime) {
      const date = s.inquiry_detailed_datetime.split(' ')[0];
      countsByDate[date] = (countsByDate[date] || 0) + 1;
    }
  });

  console.log('📊 日付別登録件数:');
  console.log('-'.repeat(40));
  Object.entries(countsByDate)
    .sort()
    .forEach(([date, count]) => {
      console.log(`${date}: ${count}件`);
    });

  // 異常に少ない日を検出（平均の50%以下）
  const counts = Object.values(countsByDate);
  const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
  const threshold = avgCount * 0.5;

  console.log(`\n⚠️  平均件数: ${avgCount.toFixed(1)}件/日`);
  console.log(`⚠️  閾値（50%以下）: ${threshold.toFixed(1)}件/日`);
  console.log('\n🔍 異常に少ない日（データロスの可能性）:');
  console.log('-'.repeat(40));

  let suspiciousDays = 0;
  Object.entries(countsByDate)
    .sort()
    .forEach(([date, count]) => {
      if (count < threshold) {
        console.log(`⚠️  ${date}: ${count}件 ← 異常に少ない`);
        suspiciousDays++;
      }
    });

  if (suspiciousDays === 0) {
    console.log('✅ 異常に少ない日は検出されませんでした');
  } else {
    console.log(`\n❌ 合計 ${suspiciousDays}日間で異常に少ない件数を検出`);
  }

  // 0件の日を検出
  console.log('\n🔍 登録0件の日（mail_notify_serverダウンの可能性）:');
  console.log('-'.repeat(40));

  const allDates: string[] = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    allDates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const zeroDays = allDates.filter(date => !countsByDate[date]);
  if (zeroDays.length > 0) {
    zeroDays.forEach(date => {
      console.log(`⚠️  ${date}: 0件 ← メール監視サーバーダウン？`);
    });
    console.log(`\n❌ 合計 ${zeroDays.length}日間で0件を検出`);
  } else {
    console.log('✅ 0件の日は検出されませんでした');
  }

  // レポート出力
  const reportPath = path.join(__dirname, 'ieul-missing-data-report.txt');
  const report = `
イエウール転記漏れチェックレポート
生成日時: ${new Date().toISOString()}

===========================================
サマリー
===========================================
調査期間: ${startDate.toISOString().split('T')[0]} 〜 ${endDate.toISOString().split('T')[0]}
DB登録済み件数: ${sellers.length}件
平均件数: ${avgCount.toFixed(1)}件/日
異常に少ない日: ${suspiciousDays}日
0件の日: ${zeroDays.length}日

===========================================
日付別登録件数
===========================================
${Object.entries(countsByDate)
  .sort()
  .map(([date, count]) => {
    const flag = count < threshold ? ' ⚠️ 異常' : '';
    return `${date}: ${count}件${flag}`;
  })
  .join('\n')}

===========================================
0件の日（詳細）
===========================================
${zeroDays.length > 0 ? zeroDays.join('\n') : 'なし'}

===========================================
推奨アクション
===========================================
${suspiciousDays > 0 || zeroDays.length > 0 ? `
1. Railwayのmail_notify_serverログを確認
   - 該当日時に認証エラーがないか
   - サーバーがダウンしていないか

2. Gmailで直接検索して転記漏れを確認
   - 件名: 【イエウール】不動産査定依頼のお知らせ
   - 日付: 該当日

3. 転記漏れが確認された場合
   - メール本文をコピーして手動転記
   - または notified_ids_server.json から該当IDを削除して再実行
` : `
✅ 特に異常は検出されませんでした。
`}
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📝 レポートを出力しました: ${reportPath}`);
  console.log('='.repeat(60));
}

checkMissingData().catch(console.error);
