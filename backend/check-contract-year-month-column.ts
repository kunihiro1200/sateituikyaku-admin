unction getColumnLetter(index: number): string {
  let column = '';
  let temp = index;
  
  while (temp >= 0) {
    column = String.fromCharCode((temp % 26) + 65) + column;
    temp = Math.floor(temp / 26) - 1;
  }
  
  return column;
}

checkContractYearMonthColumn().catch(console.error);
}:`);
    
    // 各「契約年月」カラムの値を表示
    for (const col of contractYearMonthColumns) {
      const value = row[col.index - 1]; // B列から始まるので-1
      console.log(`  - ${col.column}列（${col.name}）: ${value || '(空欄)'}`);
    }
    
    // AM列の値も表示
    if (amColumnIndex < headers.length) {
      const amValue = row[amColumnIndex - 1]; // B列から始まるので-1
      console.log(`  - AM列: ${amValue || '(空欄)'}`);
    }
    
    console.log('');
  }
}

/**
 * 列インデックスをExcel列名に変換
 * 例: 0 -> A, 1 -> B, 25 -> Z, 26 -> AA, 38 -> AM
 */
f)'}`);
  } else {
    console.log(`⚠️ AM列（インデックス${amColumnIndex}）はヘッダー範囲外`);
  }
  console.log('');

  // サンプルデータを取得（最初の10行）
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '売主リスト!B2:CZ11', // 最初の10行のデータ
  });

  const rows = dataResponse.data.values || [];
  
  console.log('📊 サンプルデータ（最初の10行）:\n');
  
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    const sellerNumber = row[0]; // B列（インデックス0）
    
    console.log(`${sellerNumbertter(i);
      contractYearMonthColumns.push({
        index: i,
        column: columnLetter,
        name: header
      });
    }
  }

  console.log('📊 「契約年月」を含むカラム:\n');
  for (const col of contractYearMonthColumns) {
    console.log(`  - ${col.column}列（インデックス${col.index}）: ${col.name}`);
  }
  console.log('');

  // AM列（インデックス38）のヘッダーを確認
  const amColumnIndex = 38; // AM列は0-indexedで38
  if (amColumnIndex < headers.length) {
    console.log(`📍 AM列（インデックス${amColumnIndex}）のヘッダー: ${headers[amColumnIndex] || '(空欄sponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '売主リスト!A1:CZ1',
  });

  const headers = headerResponse.data.values?.[0] || [];
  
  console.log('📋 ヘッダー行の列数:', headers.length);
  console.log('');

  // 「契約年月」を含むカラムを検索
  const contractYearMonthColumns: Array<{ index: number; column: string; name: string }> = [];
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header && String(header).includes('契約年月')) {
      const columnLetter = getColumnLe点」列を調査...\n');

  // Google Sheets認証
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';

  // ヘッダー行を取得（A列からCZ列まで）
  const headerReimport { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: 'backend/.env' });

async function checkContractYearMonthColumn() {
  console.log('🔍 スプレッドシートの「契約年月 他決は分かった時