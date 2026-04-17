#!/usr/bin/env node
/**
 * スプレッドシートから買主7605のデータを直接確認するスクリプト
 */

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyer7605() {
  console.log('🔍 スプレッドシートから買主7605を調査中...\n');

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダー取得
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });
  const headers = headerResponse.data.values?.[0] || [];
  console.log(`📋 総カラム数: ${headers.length}`);

  // 買主番号カラムのインデックスを確認
  const buyerNumberIndex = headers.indexOf('買主番号');
  console.log(`📌 '買主番号'カラムのインデックス: ${buyerNumberIndex} (${buyerNumberIndex === 4 ? 'E列 ✅' : `E列ではない ⚠️ (期待値: 4)`})`);
  
  // E列（index 4）のヘッダーも確認
  console.log(`📌 E列（index 4）のヘッダー: '${headers[4] || 'N/A'}'`);

  // データ取得（UNFORMATTED_VALUE使用）
  console.log('\n📥 スプレッドシートデータを取得中...');
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:GZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = dataResponse.data.values || [];
  console.log(`📊 総行数（ヘッダー含む）: ${rows.length}`);

  // 7605を検索（E列 = index 4）
  console.log('\n=== 7605の検索（E列 = index 4）===\n');
  const found7605 = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const val = row[4]; // E列
    if (val !== undefined && String(val).trim() === '7605') {
      found7605.push({ rowNum: i + 1, row });
    }
  }

  if (found7605.length > 0) {
    console.log(`✅ 7605が見つかりました（${found7605.length}行）`);
    for (const { rowNum, row } of found7605) {
      console.log(`\n  行番号: ${rowNum}`);
      console.log(`  E列（買主番号）: ${row[4]}`);
      console.log(`  F列（受付日）: ${row[5]}`);
      console.log(`  G列（氏名）: ${row[6]}`);
      console.log(`  最初の10列: ${JSON.stringify(row.slice(0, 10))}`);
    }
  } else {
    console.log(`❌ 7605が見つかりません（E列で検索）`);
    
    // 全列で7605を検索
    console.log('\n全列で7605を検索中...');
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        if (String(row[j]).trim() === '7605') {
          console.log(`  行${i + 1}, 列${j}（${headers[j] || '不明'}）に7605が見つかりました`);
          console.log(`  行データ（最初の10列）: ${JSON.stringify(row.slice(0, 10))}`);
        }
      }
    }
  }

  // 7600-7610の範囲を確認
  console.log('\n=== 7600-7610の範囲の確認（E列）===\n');
  const rangeFound = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const val = row[4]; // E列
    try {
      const num = parseInt(String(val).trim(), 10);
      if (num >= 7600 && num <= 7610) {
        rangeFound.push({ rowNum: i + 1, num, name: row[6] || 'N/A', receptionDate: row[5] || 'N/A' });
      }
    } catch (e) {}
  }

  if (rangeFound.length > 0) {
    rangeFound.sort((a, b) => a.num - b.num);
    for (const { rowNum, num, name, receptionDate } of rangeFound) {
      console.log(`  行${rowNum}: ${num} - ${name} (受付日: ${receptionDate})`);
    }
  } else {
    console.log('  7600-7610の範囲の買主が見つかりません');
  }

  // 最大buyer_numberを確認
  console.log('\n=== スプレッドシートの最大buyer_number ===\n');
  let maxNum = 0;
  let maxRow = null;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const val = row[4]; // E列
    try {
      const num = parseInt(String(val).trim(), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
        maxRow = { rowNum: i + 1, row };
      }
    } catch (e) {}
  }
  console.log(`  最大buyer_number: ${maxNum}`);
  if (maxRow) {
    console.log(`  行番号: ${maxRow.rowNum}`);
    console.log(`  氏名: ${maxRow.row[6] || 'N/A'}`);
    console.log(`  受付日: ${maxRow.row[5] || 'N/A'}`);
  }

  // 7000以上の買主番号一覧
  console.log('\n=== 7000以上の買主番号一覧 ===\n');
  const highNumbers = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const val = row[4]; // E列
    try {
      const num = parseInt(String(val).trim(), 10);
      if (!isNaN(num) && num >= 7000) {
        highNumbers.push({ rowNum: i + 1, num, name: row[6] || 'N/A', receptionDate: row[5] || 'N/A' });
      }
    } catch (e) {}
  }
  highNumbers.sort((a, b) => a.num - b.num);
  console.log(`  7000以上の買主番号: ${highNumbers.length}件`);
  for (const { rowNum, num, name, receptionDate } of highNumbers) {
    console.log(`  行${rowNum}: ${num} - ${name} (受付日: ${receptionDate})`);
  }
}

checkBuyer7605().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
