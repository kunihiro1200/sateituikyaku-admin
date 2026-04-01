/**
 * スプレッドシートの一般媒介データを確認
 */

// 環境変数を最初に読み込む
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

// 今日の日付（JST）を取得
function getTodayJST(): string {
  const now = new Date();
  const jstOffset = 9 * 60;
  const jstTime = new Date(now.getTime() + jstOffset * 60 * 1000);
  return jstTime.toISOString().split('T')[0];
}

async function checkSpreadsheetData() {
  console.log('🔍 スプレッドシートの一般媒介データを確認...\n');

  const todayJST = getTodayJST();
  console.log(`📅 今日: ${todayJST}\n`);

  const client = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!,
  });

  await client.authenticate();

  // ヘッダー行を取得
  const headers = await client.readRawRange('1:1');
  const headerRow = headers[0];

  console.log(`📋 ヘッダー行: ${headerRow.length}列\n`);

  // 必要なカラムのインデックスを取得
  const statusIndex = headerRow.indexOf('状況（当社）');
  const nextCallDateIndex = headerRow.indexOf('次電日');
  const exclusiveOtherDecisionMeetingIndex = headerRow.indexOf('専任他決打合せ');
  const contractYearMonthIndex = headerRow.indexOf('契約年月 他決は分かった時点');
  const sellerNumberIndex = headerRow.indexOf('売主番号');

  console.log(`📊 カラムインデックス:`);
  console.log(`   - 売主番号: ${sellerNumberIndex}`);
  console.log(`   - 状況（当社）: ${statusIndex}`);
  console.log(`   - 次電日: ${nextCallDateIndex}`);
  console.log(`   - 専任他決打合せ: ${exclusiveOtherDecisionMeetingIndex}`);
  console.log(`   - 契約年月: ${contractYearMonthIndex}\n`);

  // 全データを取得
  const allData = await client.readRawRange('2:1000');

  console.log(`📊 全データ: ${allData.length}行\n`);

  // 一般媒介の売主をフィルタリング（条件を段階的に確認）
  console.log('🔍 条件を段階的に確認:\n');

  // ステップ1: 状況が一般媒介
  const step1 = allData.filter(row => row[statusIndex] === '一般媒介');
  console.log(`ステップ1: 状況 = "一般媒介" → ${step1.length}件`);

  // ステップ2: 専任他決打合せ ≠ "完了"
  const step2 = step1.filter(row => row[exclusiveOtherDecisionMeetingIndex] !== '完了');
  console.log(`ステップ2: 専任他決打合せ ≠ "完了" → ${step2.length}件`);

  // ステップ3: 次電日が存在
  const step3 = step2.filter(row => row[nextCallDateIndex]);
  console.log(`ステップ3: 次電日が存在 → ${step3.length}件`);

  // ステップ4: 次電日 ≠ 今日
  const step4 = step3.filter(row => row[nextCallDateIndex] !== todayJST);
  console.log(`ステップ4: 次電日 ≠ 今日（${todayJST}） → ${step4.length}件`);

  // ステップ5: 契約年月が存在
  const step5 = step4.filter(row => row[contractYearMonthIndex]);
  console.log(`ステップ5: 契約年月が存在 → ${step5.length}件`);

  // ステップ6: 契約年月 >= "2025-06-23"
  const step6 = step5.filter(row => {
    const contractYearMonth = row[contractYearMonthIndex];
    console.log(`   契約年月: "${contractYearMonth}" >= "2025-06-23" ? ${contractYearMonth >= '2025-06-23'}`);
    return contractYearMonth >= '2025-06-23';
  });
  console.log(`ステップ6: 契約年月 >= "2025-06-23" → ${step6.length}件\n`);

  const generalSellers = step6;

  console.log(`📊 一般媒介の売主（条件に一致）: ${generalSellers.length}件\n`);

  if (generalSellers.length > 0) {
    console.log(`📋 一般媒介の売主（全件）:`);
    generalSellers.forEach(row => {
      const sellerNumber = row[sellerNumberIndex];
      const nextCallDate = row[nextCallDateIndex];
      const status = row[statusIndex];
      const contractYearMonth = row[contractYearMonthIndex];
      const exclusiveOtherDecisionMeeting = row[exclusiveOtherDecisionMeetingIndex];
      console.log(`   - ${sellerNumber}: 次電日=${nextCallDate}, 状況=${status}, 契約年月=${contractYearMonth}, 専任他決打合せ=${exclusiveOtherDecisionMeeting}`);
    });
  } else {
    console.log('⚠️  条件に一致する一般媒介の売主が存在しません');
  }
}

checkSpreadsheetData().catch(console.error);
