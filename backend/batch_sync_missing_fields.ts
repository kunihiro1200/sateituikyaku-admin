/**
 * DBが空欄/null/「不明」/「未入力」の売主に対して、スプレッドシートから
 * 氏名・住所・電話番号・メアド・物件住所・査定額・査定方法を一括同期するバッチスクリプト
 *
 * 対象条件（いずれかが空欄/null/「不明」/「未入力」）:
 *   - name が null
 *   - address が null
 *   - phone_number が null
 *   - email が null（空欄はnullのまま、スプシに値があれば更新）
 *   - property_address が null または '不明' または '未入力'
 *   - valuation_amount_1 が null
 *   - valuation_method が null
 *
 * タイムアウト対策: 50件ずつ処理して都度進捗を表示
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { encrypt } from './src/utils/encryption';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_NAME = '売主リスト';
const BATCH_SIZE = 50;

// 「空欄扱い」とみなす文字列
const EMPTY_VALUES = ['', '不明', '未入力'];

function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  return EMPTY_VALUES.includes(String(value).trim());
}

async function getSheetsClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '';
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

async function batchSyncMissingFields() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Step 1: DBから対象売主を全件取得（削除済み除外）
  console.log('📊 DBから売主を全件取得中...');

  const { data: allSellers, error: dbError } = await supabase
    .from('sellers')
    .select('seller_number, name, address, phone_number, email, property_address, valuation_amount_1, valuation_method')
    .is('deleted_at', null)
    .order('seller_number', { ascending: true });

  if (dbError) {
    console.error('❌ DB取得エラー:', dbError.message);
    return;
  }

  if (!allSellers || allSellers.length === 0) {
    console.log('✅ 売主データがありません');
    return;
  }

  // 対象（いずれかのフィールドが空欄/不明/未入力）に絞り込む
  const targets = allSellers.filter(s =>
    isEmpty(s.name) ||
    isEmpty(s.address) ||
    isEmpty(s.phone_number) ||
    isEmpty(s.property_address) ||
    s.valuation_amount_1 === null ||
    isEmpty(s.valuation_method)
  );

  console.log(`📋 全売主: ${allSellers.length}件 → 対象: ${targets.length}件`);

  if (targets.length === 0) {
    console.log('✅ 補完が必要な売主はありません');
    return;
  }

  // Step 2: スプレッドシートから全データを取得
  console.log('📊 スプレッドシートからデータを取得中...');
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B:CZ`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    console.error('❌ スプレッドシートのデータが取得できませんでした');
    return;
  }

  const headers = rows[0];
  console.log(`📋 スプレッドシート: ${rows.length - 1}行\n`);

  // 売主番号 → 行データのマップを作成
  const sheetMap = new Map<string, Record<string, any>>();
  for (let i = 1; i < rows.length; i++) {
    const sellerNumber = rows[i][0]; // B列 = index 0
    if (sellerNumber && String(sellerNumber).startsWith('AA')) {
      const rowData: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        rowData[headers[j]] = rows[i][j] !== undefined ? rows[i][j] : '';
      }
      sheetMap.set(String(sellerNumber), rowData);
    }
  }

  console.log(`📋 スプレッドシートマップ: ${sheetMap.size}件\n`);

  // Step 3: バッチ処理
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let batchStart = 0; batchStart < targets.length; batchStart += BATCH_SIZE) {
    const batch = targets.slice(batchStart, batchStart + BATCH_SIZE);
    const batchEnd = Math.min(batchStart + BATCH_SIZE, targets.length);
    console.log(`🔄 バッチ処理: ${batchStart + 1}〜${batchEnd}件目 / ${targets.length}件`);

    for (const dbSeller of batch) {
      const sellerNumber = dbSeller.seller_number;
      const rowData = sheetMap.get(sellerNumber);

      if (!rowData) {
        console.log(`  ⚠️  ${sellerNumber}: スプレッドシートに見つかりません`);
        totalSkipped++;
        continue;
      }

      const updateData: Record<string, any> = {};
      const updatedFields: string[] = [];

      // 氏名（DBが空欄/不明/未入力の場合のみ）
      if (isEmpty(dbSeller.name)) {
        const name = rowData['名前(漢字のみ）'];
        if (name && !isEmpty(name)) {
          updateData.name = encrypt(name.trim());
          updatedFields.push('name');
        }
      }

      // 住所（DBが空欄/不明/未入力の場合のみ）
      if (isEmpty(dbSeller.address)) {
        const address = rowData['依頼者住所(物件所在と異なる場合）'];
        if (address && !isEmpty(address)) {
          updateData.address = encrypt(address.trim());
          updatedFields.push('address');
        }
      }

      // 電話番号（DBが空欄/不明/未入力の場合のみ）
      if (isEmpty(dbSeller.phone_number)) {
        const phoneRaw = rowData['電話番号\nハイフン不要'] || rowData['電話番号'];
        if (phoneRaw && !isEmpty(phoneRaw)) {
          updateData.phone_number = encrypt(String(phoneRaw).trim());
          updatedFields.push('phone_number');
        }
      }

      // メールアドレス（DBが空欄/nullの場合のみ、スプシに値があれば更新）
      if (isEmpty(dbSeller.email)) {
        const email = rowData['メールアドレス'];
        if (email && !isEmpty(email)) {
          updateData.email = encrypt(String(email).trim());
          updatedFields.push('email');
        }
      }

      // 物件住所（DBが空欄/不明/未入力の場合のみ）
      if (isEmpty(dbSeller.property_address)) {
        const propertyAddress = rowData['物件所在地'];
        if (propertyAddress && !isEmpty(propertyAddress)) {
          updateData.property_address = propertyAddress.trim();
          updatedFields.push('property_address');
        }
      }

      // 査定額（DBがnullの場合のみ）
      if (dbSeller.valuation_amount_1 === null) {
        const val1Raw = rowData['査定額1'] || rowData['査定額1（自動計算）v'];
        const val2Raw = rowData['査定額2'] || rowData['査定額2（自動計算）v'];
        const val3Raw = rowData['査定額3'] || rowData['査定額3（自動計算）v'];
        const val1 = parseNumeric(val1Raw);
        const val2 = parseNumeric(val2Raw);
        const val3 = parseNumeric(val3Raw);
        if (val1 !== null) { updateData.valuation_amount_1 = val1 * 10000; updatedFields.push('valuation_amount_1'); }
        if (val2 !== null) { updateData.valuation_amount_2 = val2 * 10000; updatedFields.push('valuation_amount_2'); }
        if (val3 !== null) { updateData.valuation_amount_3 = val3 * 10000; updatedFields.push('valuation_amount_3'); }
      }

      // 査定方法（DBが空欄/不明/未入力の場合のみ）
      if (isEmpty(dbSeller.valuation_method)) {
        const valuationMethod = rowData['査定方法'];
        if (valuationMethod && !isEmpty(valuationMethod)) {
          updateData.valuation_method = valuationMethod.trim();
          updatedFields.push('valuation_method');
        }
      }

      if (updatedFields.length === 0) {
        totalSkipped++;
        continue;
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('sellers')
        .update(updateData)
        .eq('seller_number', sellerNumber);

      if (error) {
        console.log(`  ❌ ${sellerNumber}: ${error.message}`);
        totalErrors++;
      } else {
        console.log(`  ✅ ${sellerNumber}: [${updatedFields.join(', ')}]`);
        totalUpdated++;
      }
    }

    console.log(`  → バッチ完了\n`);
  }

  console.log('=== 完了 ===');
  console.log(`✅ 更新: ${totalUpdated}件`);
  console.log(`⏭️  スキップ: ${totalSkipped}件`);
  console.log(`❌ エラー: ${totalErrors}件`);
}

batchSyncMissingFields().catch(console.error);
