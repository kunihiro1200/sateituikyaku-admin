// 買主番号7260のスプレッドシートデータを詳細確認するスクリプト
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
const SHEET_NAME = '買主リスト';

async function checkBuyer7260Spreadsheet() {
  console.log('=== 買主番号7260のスプレッドシートデータ詳細確認 ===\n');

  try {
    // Google Sheets API認証（環境変数から直接JSONを読み込む）
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
    }
    
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. ヘッダー行を取得（1行目）
    console.log('1. ヘッダー行を取得中...');
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    });

    const headers = headerResponse.data.values?.[0] || [];
    console.log(`   ヘッダー数: ${headers.length}`);

    // 初動担当カラムのインデックスを検索
    const initialAssigneeIndex = headers.findIndex(h => h === '初動担当');
    if (initialAssigneeIndex === -1) {
      console.error('❌ 「初動担当」カラムが見つかりません');
      console.log('   利用可能なヘッダー:', headers.slice(0, 20).join(', '), '...');
      return;
    }

    console.log(`   「初動担当」カラム: 列${initialAssigneeIndex + 1}（${String.fromCharCode(65 + initialAssigneeIndex)}列）\n`);

    // 2. 買主番号7260の行を検索
    console.log('2. 買主番号7260の行を検索中...');
    const buyerNumberIndex = headers.findIndex(h => h === '買主番号');
    if (buyerNumberIndex === -1) {
      console.error('❌ 「買主番号」カラムが見つかりません');
      return;
    }

    // 買主番号カラム全体を取得
    const buyerNumberColumn = String.fromCharCode(65 + buyerNumberIndex);
    const buyerNumberResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!${buyerNumberColumn}:${buyerNumberColumn}`,
    });

    const buyerNumbers = buyerNumberResponse.data.values || [];
    const rowIndex = buyerNumbers.findIndex(row => row[0] === '7260');

    if (rowIndex === -1) {
      console.error('❌ 買主番号7260の行が見つかりません');
      console.log('   スプレッドシートに買主番号7260が存在しない可能性があります');
      return;
    }

    const rowNumber = rowIndex + 1; // 1-indexed
    console.log(`   買主番号7260: 行${rowNumber}\n`);

    // 3. 買主番号7260の全データを取得
    console.log('3. 買主番号7260の全データを取得中...');
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!${rowNumber}:${rowNumber}`,
    });

    const rowData = rowResponse.data.values?.[0] || [];
    console.log(`   データ数: ${rowData.length}\n`);

    // 4. 重要なフィールドを表示
    console.log('4. 重要なフィールド:');
    const importantFields = [
      '買主番号',
      '氏名',
      '初動担当',
      '問合せ元',
      '受付日',
      '問合時ヒアリング',
      '問合時確度',
    ];

    for (const fieldName of importantFields) {
      const fieldIndex = headers.findIndex(h => h === fieldName);
      if (fieldIndex === -1) {
        console.log(`   ${fieldName}: カラムが見つかりません`);
        continue;
      }

      const value = rowData[fieldIndex] || '（空欄）';
      console.log(`   ${fieldName}: ${value}`);
    }

    // 5. 初動担当カラムの詳細
    console.log('\n5. 初動担当カラムの詳細:');
    const initialAssigneeValue = rowData[initialAssigneeIndex] || '';
    console.log(`   現在値: "${initialAssigneeValue}"`);
    console.log(`   型: ${typeof initialAssigneeValue}`);
    console.log(`   長さ: ${initialAssigneeValue.length}`);
    console.log(`   空欄か: ${initialAssigneeValue === ''}`);

    if (initialAssigneeValue) {
      console.log(`   文字コード: ${Array.from(initialAssigneeValue).map(c => c.charCodeAt(0)).join(', ')}`);
    }

    // 6. 結論
    console.log('\n=== 結論 ===');
    if (initialAssigneeValue === '') {
      console.log('✅ 初動担当カラムは空欄です');
      console.log('   → DBの期待値も空欄であれば、競合は発生しないはずです');
      console.log('   → DBの期待値が空欄でない場合、競合が発生します');
    } else if (initialAssigneeValue === '久') {
      console.log('⚠️  初動担当カラムに「久」が既に入っています');
      console.log('   → DBの期待値が「久」であれば、競合は発生しないはずです');
      console.log('   → DBの期待値が「久」でない場合、競合が発生します');
    } else {
      console.log(`⚠️  初動担当カラムに「${initialAssigneeValue}」が入っています`);
      console.log('   → DBの期待値がこの値と異なる場合、競合が発生します');
    }

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response?.data) {
      console.error('   詳細:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkBuyer7260Spreadsheet();
