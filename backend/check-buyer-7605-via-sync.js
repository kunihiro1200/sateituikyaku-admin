#!/usr/bin/env node
/**
 * BuyerSyncServiceを使って7605の同期を試みるスクリプト
 * スプレッドシートに7605が存在するかどうかを確認する
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim() || '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

console.log('SPREADSHEET_ID:', SPREADSHEET_ID);
console.log('SHEET_NAME:', SHEET_NAME);

async function checkSpreadsheet() {
  console.log('\n🔍 スプレッドシートから買主7605を調査中...\n');

  // サービスアカウントJSONを環境変数から取得
  let auth;
  
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    console.log('✅ GOOGLE_SERVICE_ACCOUNT_JSON環境変数を使用');
    try {
      const credentials = JSON.parse(serviceAccountJson);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } catch (e) {
      console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSONのパースに失敗:', e.message);
      process.exit(1);
    }
  } else {
    // ファイルから読み込み
    const keyFile = path.join(__dirname, 'google-service-account.json');
    console.log('📁 サービスアカウントファイルを使用:', keyFile);
    auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダー取得
  console.log('📋 ヘッダーを取得中...');
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });
  const headers = headerResponse.data.values?.[0] || [];
  console.log(`  総カラム数: ${headers.length}`);
  
  const buyerNumberIndex = headers.indexOf('買主番号');
  console.log(`  '買主番号'カラムのインデックス: ${buyerNumberIndex}`);
  
  if (buyerNumberIndex === -1) {
    console.error('❌ 買主番号カラムが見つかりません');
    console.log('  最初の10ヘッダー:', headers.slice(0, 10));
    process.exit(1);
  }

  // データ取得
  console.log('\n📥 データを取得中...');
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:GZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = dataResponse.data.values || [];
  console.log(`  総行数（ヘッダー含む）: ${rows.length}`);

  // 7605を検索
  console.log('\n=== 7605の検索 ===\n');
  const found7605 = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const val = row[buyerNumberIndex];
    if (val !== undefined && String(val).trim() === '7605') {
      found7605.push({ rowNum: i + 1, row });
    }
  }

  if (found7605.length > 0) {
    console.log(`✅ 7605が見つかりました（${found7605.length}行）`);
    for (const { rowNum, row } of found7605) {
      console.log(`\n  行番号: ${rowNum}`);
      console.log(`  買主番号: ${row[buyerNumberIndex]}`);
      console.log(`  受付日（F列）: ${row[5]}`);
      console.log(`  氏名（G列）: ${row[6]}`);
      console.log(`  最初の10列: ${JSON.stringify(row.slice(0, 10))}`);
    }
  } else {
    console.log(`❌ 7605が見つかりません`);
    
    // 7600-7620の範囲を確認
    console.log('\n7600-7620の範囲を確認:');
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const val = row[buyerNumberIndex];
      try {
        const num = parseInt(String(val).trim(), 10);
        if (!isNaN(num) && num >= 7600 && num <= 7620) {
          console.log(`  行${i + 1}: ${num} - ${row[6] || 'N/A'} (受付日: ${row[5] || 'N/A'})`);
        }
      } catch (e) {}
    }
    
    // 最大buyer_numberを確認
    let maxNum = 0;
    let maxRowNum = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const val = row[buyerNumberIndex];
      try {
        const num = parseInt(String(val).trim(), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
          maxRowNum = i + 1;
        }
      } catch (e) {}
    }
    console.log(`\n最大buyer_number: ${maxNum} (行${maxRowNum})`);
    
    // 7500以上の買主番号一覧
    console.log('\n7500以上の買主番号一覧:');
    const highNumbers = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const val = row[buyerNumberIndex];
      try {
        const num = parseInt(String(val).trim(), 10);
        if (!isNaN(num) && num >= 7500) {
          highNumbers.push({ rowNum: i + 1, num, name: row[6] || 'N/A', date: row[5] || 'N/A' });
        }
      } catch (e) {}
    }
    highNumbers.sort((a, b) => a.num - b.num);
    for (const { rowNum, num, name, date } of highNumbers) {
      console.log(`  行${rowNum}: ${num} - ${name} (受付日: ${date})`);
    }
  }
}

checkSpreadsheet().catch(err => {
  console.error('❌ エラー:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
