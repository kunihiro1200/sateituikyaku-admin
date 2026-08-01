/**
 * 恩田 透を売主リストスプレッドシートに手動追加するスクリプト
 */
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.vercel.check から環境変数を手動で読み込む
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env.vercel.check');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx);
    let value = trimmed.substring(eqIdx + 1);
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';
const CRON_SECRET = process.env.CRON_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'https://sateituikyaku-admin-backend.vercel.app';

async function getAuthClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  }
  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

async function main() {
  console.log('=== 恩田 透を売主リストに追加 ===');
  console.log(`スプレッドシートID: ${SPREADSHEET_ID}`);
  console.log(`シート名: ${SHEET_NAME}`);

  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // Step 1: 最新の売主番号を取得（B列）
  console.log('\n Step 1: 最新の売主番号を確認...');
  const sellerNumbersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!B:B`,
  });

  const sellerNumbers = sellerNumbersRes.data.values || [];
  
  // AA番号の最大値を取得
  let maxNumber = 0;
  for (const row of sellerNumbers) {
    const val = row[0];
    if (val && typeof val === 'string' && /^AA\d+$/.test(val)) {
      const num = parseInt(val.substring(2), 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextSellerNumber = `AA${maxNumber + 1}`;
  console.log(`  最新の売主番号: AA${maxNumber}`);
  console.log(`  次の売主番号: ${nextSellerNumber}`);

  // Step 2: ヘッダー行を取得して列位置を確認
  console.log('\n Step 2: ヘッダー行を確認...');
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A1:FZ1`,
  });

  const headers = headersRes.data.values?.[0] || [];
  console.log(`  ヘッダー列数: ${headers.length}`);

  // 必要なカラムの位置を特定
  const columnIndexes = {};

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim();
    if (header.includes('売主番号')) columnIndexes['売主番号'] = i;
    if (header.includes('名前') && header.includes('漢字')) columnIndexes['名前'] = i;
    if (header.includes('電話番号')) columnIndexes['電話番号'] = i;
    if (header.includes('メールアドレス')) columnIndexes['メールアドレス'] = i;
    if (header.includes('物件所在地')) columnIndexes['物件所在地'] = i;
    if (header === 'サイト') columnIndexes['サイト'] = i;
    if (header.includes('反響日付')) columnIndexes['反響日付'] = i;
    if (header.includes('状況（当社）')) columnIndexes['状況（当社）'] = i;
    if (header.includes('査定方法')) columnIndexes['査定方法'] = i;
  }

  console.log('  カラム位置:');
  for (const [key, idx] of Object.entries(columnIndexes)) {
    console.log(`    ${key}: 列${idx}`);
  }

  // Step 3: 恩田 透のデータを作成
  console.log('\n Step 3: 恩田 透のデータを作成...');
  
  // 空の行を作成（ヘッダーと同じ長さ）
  const newRow = new Array(headers.length).fill('');

  // データを設定
  if (columnIndexes['売主番号'] !== undefined) newRow[columnIndexes['売主番号']] = nextSellerNumber;
  if (columnIndexes['名前'] !== undefined) newRow[columnIndexes['名前']] = '恩田 透';
  if (columnIndexes['電話番号'] !== undefined) newRow[columnIndexes['電話番号']] = '08072072768';
  if (columnIndexes['物件所在地'] !== undefined) newRow[columnIndexes['物件所在地']] = '福岡県筑紫野市';
  if (columnIndexes['サイト'] !== undefined) newRow[columnIndexes['サイト']] = 'HOME4U';
  if (columnIndexes['反響日付'] !== undefined) newRow[columnIndexes['反響日付']] = '2026/05/21';
  if (columnIndexes['状況（当社）'] !== undefined) newRow[columnIndexes['状況（当社）']] = '追客中';
  if (columnIndexes['査定方法'] !== undefined) newRow[columnIndexes['査定方法']] = '机上査定';

  console.log(`  売主番号: ${nextSellerNumber}`);
  console.log(`  名前: 恩田 透`);
  console.log(`  電話番号: 08072072768`);
  console.log(`  物件所在地: 福岡県筑紫野市`);
  console.log(`  サイト: HOME4U`);
  console.log(`  反響日付: 2026/05/21`);
  console.log(`  状況（当社）: 追客中`);

  // Step 4: スプレッドシートに追加
  console.log('\n Step 4: スプレッドシートに追加...');
  
  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:FZ`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [newRow],
    },
  });

  console.log(`  追加完了: ${appendRes.data.updates?.updatedRange}`);
  console.log(`  更新セル数: ${appendRes.data.updates?.updatedCells}`);

  // Step 5: 同期トリガーを呼び出し（スプシ→DB）
  console.log('\n Step 5: DB同期をトリガー...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/sync/trigger?additionOnly=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();
    console.log(`  ステータス: ${response.status}`);
    console.log(`  結果:`, JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\n 完了！恩田 透（${nextSellerNumber}）が売主リストに追加されました。`);
    } else {
      console.log(`\n DB同期でエラーが発生しました。10分後の自動同期で反映される可能性があります。`);
    }
  } catch (error) {
    console.log(`  DB同期呼び出しエラー: ${error.message}`);
    console.log('  スプレッドシートへの追加は完了しています。10分後の自動同期で反映されます。');
  }

  console.log('\n=== 完了 ===');
}

main().catch(console.error);
