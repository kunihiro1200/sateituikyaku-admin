/**
 * 買主スプレッドシートの内覧日データを確認するスクリプト
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.local') });

import { google } from 'googleapis';

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyerSpreadsheetViewingDates() {
  console.log('🔍 買主スプレッドシートの内覧日データを確認\n');

  // Google Sheets APIクライアントを初期化
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. ヘッダー行を取得
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] || [];
  console.log(`📊 ヘッダー数: ${headers.length}列\n`);

  // I列（内覧日）のインデックスを確認
  const viewingDateIndex = headers.findIndex((h: string) => h === '●内覧日(最新）');
  console.log(`📋 「●内覧日(最新）」列: ${viewingDateIndex >= 0 ? `${String.fromCharCode(65 + viewingDateIndex)}列（インデックス${viewingDateIndex}）` : '見つかりません'}\n`);

  if (viewingDateIndex < 0) {
    console.log('❌ 「●内覧日(最新）」列が見つかりませんでした。');
    return;
  }

  // 2. 全データを取得
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:BP`,
  });

  const rows = dataResponse.data.values || [];
  console.log(`📊 全行数: ${rows.length}行（ヘッダー含む）\n`);

  // 買主番号列（B列）のインデックスを確認
  const buyerNumberIndex = headers.findIndex((h: string) => h === '買主番号');
  console.log(`📋 「買主番号」列: ${buyerNumberIndex >= 0 ? `${String.fromCharCode(65 + buyerNumberIndex)}列（インデックス${buyerNumberIndex}）` : '見つかりません'}\n`);

  // 3. 内覧日が設定されている買主を検索
  const buyersWithViewingDate: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const buyerNumber = row[buyerNumberIndex]; // 買主番号列
    const viewingDate = row[viewingDateIndex];

    if (viewingDate && viewingDate !== '') {
      buyersWithViewingDate.push({
        rowNumber: i + 1,
        buyerNumber: buyerNumber || '(空欄)',
        viewingDate: viewingDate,
      });
    }
  }

  console.log(`📊 内覧日が設定されている買主: ${buyersWithViewingDate.length}件\n`);

  if (buyersWithViewingDate.length > 0) {
    console.log('📋 詳細（最初の10件）:\n');
    buyersWithViewingDate.slice(0, 10).forEach((buyer, index) => {
      console.log(`  ${index + 1}. 行番号: ${buyer.rowNumber}`);
      console.log(`     買主番号: ${buyer.buyerNumber}`);
      console.log(`     内覧日: ${buyer.viewingDate}`);
      console.log('');
    });
  }

  // 4. 特定の買主（7277, 7278, 7254）を検索
  console.log('📋 特定の買主（7277, 7278, 7254）を検索:\n');

  const targetBuyers = ['7277', '7278', '7254'];
  for (const targetBuyerNumber of targetBuyers) {
    const found = buyersWithViewingDate.find((b) => b.buyerNumber === targetBuyerNumber);
    if (found) {
      console.log(`  ✅ 買主${targetBuyerNumber}: 行${found.rowNumber}, 内覧日=${found.viewingDate}`);
    } else {
      console.log(`  ❌ 買主${targetBuyerNumber}: 見つかりませんでした`);
    }
  }
}

checkBuyerSpreadsheetViewingDates().catch(console.error);
