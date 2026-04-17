/**
 * 2026年4月1日以降の受付日で物件番号がある買主の
 * CH〜CN列（pre_viewing_notes, key_info, sale_reason, price_reduction_history,
 *           viewing_notes, parking, viewing_parking）を
 * DBからスプレッドシートに一括同期するスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env.local') });

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { BuyerColumnMapper } from './src/services/BuyerColumnMapper';

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

const TARGET_FIELDS = [
  'pre_viewing_notes',       // CH: 内覧前伝達事項
  'key_info',                // CI: 鍵等
  'sale_reason',             // CJ: 売却理由
  'price_reduction_history', // CK: 値下げ履歴
  'viewing_notes',           // CL: 内覧の時の伝達事項
  'parking',                 // CM: 駐車場
  'viewing_parking',         // CN: 内覧時駐車場
];

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 2026年4月1日以降の受付日で物件番号がある買主を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select(`buyer_number, reception_date, property_number, ${TARGET_FIELDS.join(', ')}`)
    .gte('reception_date', '2026-04-01')
    .not('property_number', 'is', null)
    .neq('property_number', '')
    .order('reception_date', { ascending: true });

  if (error) {
    console.error('❌ DB取得エラー:', error.message);
    process.exit(1);
  }

  console.log(`✅ 対象買主数: ${buyers?.length ?? 0}件`);
  if (!buyers || buyers.length === 0) {
    console.log('対象データなし。終了します。');
    return;
  }

  // Google Sheets認証（BuyerSyncServiceと同じ方法）
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダー取得
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });
  const headers = headerResponse.data.values?.[0] || [];
  console.log(`✅ スプレッドシート認証完了（ヘッダー列数: ${headers.length}）\n`);

  const columnMapper = new BuyerColumnMapper();

  // シートIDを取得（batchUpdate用）
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
  const sheetId = sheet?.properties?.sheetId!;

  // 買主番号列のインデックスを取得
  const buyerNumberColIndex = headers.indexOf('買主番号');
  if (buyerNumberColIndex === -1) {
    console.error('❌ 買主番号列が見つかりません');
    process.exit(1);
  }

  // スプレッドシートの全データを取得（行番号検索用）
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A2:GZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const allRows = dataResponse.data.values || [];
  console.log(`スプレッドシート行数: ${allRows.length}行\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const buyer of buyers) {
    // 更新するフィールドを収集
    const updates: Record<string, any> = {};
    for (const field of TARGET_FIELDS) {
      if (buyer[field] !== null && buyer[field] !== undefined && buyer[field] !== '') {
        updates[field] = buyer[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      console.log(`⏭️  買主 ${buyer.buyer_number}: CH〜CN列に値なし、スキップ`);
      skipCount++;
      continue;
    }

    // スプレッドシートの行番号を検索
    const rowIndex = allRows.findIndex(row => String(row[buyerNumberColIndex]) === String(buyer.buyer_number));
    if (rowIndex === -1) {
      console.warn(`⚠️  買主 ${buyer.buyer_number}: スプレッドシートに見つかりません`);
      failCount++;
      continue;
    }
    const rowNumber = rowIndex + 2; // 1-indexed、ヘッダー行=1

    // DBフィールド名 → スプレッドシートカラム名に変換
    const spreadsheetValues = columnMapper.mapDatabaseToSpreadsheet(updates);

    // batchUpdateで部分更新
    const requests: any[] = [];
    for (const [colName, value] of Object.entries(spreadsheetValues)) {
      const colIndex = headers.indexOf(colName);
      if (colIndex === -1) continue;

      let userEnteredValue: any;
      if (value === null || value === undefined || value === '') {
        userEnteredValue = { stringValue: '' };
      } else if (typeof value === 'number') {
        userEnteredValue = { numberValue: value };
      } else {
        userEnteredValue = { stringValue: String(value) };
      }

      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: rowNumber - 1,
            endRowIndex: rowNumber,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1,
          },
          rows: [{ values: [{ userEnteredValue }] }],
          fields: 'userEnteredValue',
        },
      });
    }

    if (requests.length === 0) {
      skipCount++;
      continue;
    }

    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests },
      });
      console.log(`✅ 買主 ${buyer.buyer_number} (行${rowNumber}): ${Object.keys(spreadsheetValues).join(', ')}`);
      successCount++;
    } catch (err: any) {
      console.error(`❌ 買主 ${buyer.buyer_number}: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n========== 完了 ==========`);
  console.log(`✅ 成功: ${successCount}件`);
  console.log(`⏭️  スキップ: ${skipCount}件`);
  console.log(`❌ 失敗: ${failCount}件`);
}

main().catch(console.error);
