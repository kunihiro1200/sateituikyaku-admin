/**
 * AA13918のスプレッドシートデータを確認するスクリプト
 */
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

// 環境変数を読み込む
dotenv.config({ path: 'backend/.env.local' });

async function checkAA13918SpreadsheetData() {
  console.log('🔍 AA13918のスプレッドシートデータを確認中...\n');

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = '売主リスト';

  if (!spreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_SPREADSHEET_ID が設定されていません');
    return;
  }

  try {
    // Google Sheets APIクライアントを初期化
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // スプレッドシートからヘッダーとデータを取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!B:CZ`,
    });
    
    if (!response.data.values || response.data.values.length === 0) {
      console.error('❌ スプレッドシートからデータを取得できませんでした');
      return;
    }

    const headers = response.data.values[0];
    const rows = response.data.values.slice(1);

    // 売主番号のインデックスを取得（B列 = 0）
    const sellerNumberIndex = 0;
    
    // 除外日のインデックスを取得
    const exclusionDateIndex = headers.indexOf('除外日');
    const valuationMethodIndex = headers.indexOf('査定方法');
    const statusIndex = headers.indexOf('状況（当社）');
    const inquiryDateIndex = headers.indexOf('反響日付');
    const visitAssigneeIndex = headers.indexOf('営担');

    console.log('📊 カラムインデックス:');
    console.log(`   売主番号: ${sellerNumberIndex}`);
    console.log(`   除外日: ${exclusionDateIndex}`);
    console.log(`   査定方法: ${valuationMethodIndex}`);
    console.log(`   状況（当社）: ${statusIndex}`);
    console.log(`   反響日付: ${inquiryDateIndex}`);
    console.log(`   営担: ${visitAssigneeIndex}\n`);

    // AA13918を検索
    const aa13918Row = rows.find(row => row[sellerNumberIndex] === 'AA13918');

    if (!aa13918Row) {
      console.error('❌ AA13918がスプレッドシートに見つかりませんでした');
      return;
    }

    console.log('✅ AA13918のスプレッドシートデータ:');
    console.log(`   売主番号: ${aa13918Row[sellerNumberIndex]}`);
    console.log(`   除外日: "${aa13918Row[exclusionDateIndex] || ''}"`);
    console.log(`   査定方法: "${aa13918Row[valuationMethodIndex] || ''}"`);
    console.log(`   状況（当社）: "${aa13918Row[statusIndex] || ''}"`);
    console.log(`   反響日付: "${aa13918Row[inquiryDateIndex] || ''}"`);
    console.log(`   営担: "${aa13918Row[visitAssigneeIndex] || ''}"\n`);

    // 除外日が空かどうか確認
    const exclusionDate = aa13918Row[exclusionDateIndex];
    if (!exclusionDate || exclusionDate === '') {
      console.log('✅ スプレッドシートの除外日は空です');
      console.log('⚠️  データベースには除外日が設定されているため、同期が必要です');
    } else {
      console.log('⚠️  スプレッドシートの除外日は設定されています');
      console.log('   データベースと一致しています');
    }

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
  }
}

checkAA13918SpreadsheetData().catch(console.error);
