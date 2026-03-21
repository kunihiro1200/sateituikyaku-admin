/**
 * AA13807の物件住所 と AA6のコメント を修正するスクリプト
 *
 * 処理内容:
 * 1. AA13807: スプシの「物件所在地」を確認 → DBに書き込み → スプシに同期
 * 2. AA6: DBのコメントをスプシに書き込む（DB→スプシ方向）
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_NAME = '売主リスト';

async function getSheetsClient(readonly = false) {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '';
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** 列インデックス（0始まり）をA1記法の列文字に変換 */
function colIndexToLetter(colIndex: number): string {
  let letter = '';
  let col = colIndex + 1; // 1-indexed
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/** スプシの特定セルに値を書き込む */
async function writeToSheet(
  sheets: ReturnType<typeof google.sheets>,
  rowIndex: number, // 1-indexed（ヘッダー行=1、データ行=2以降）
  colIndex: number, // 0-indexed
  value: string
) {
  const colLetter = colIndexToLetter(colIndex);
  const range = `${SHEET_NAME}!${colLetter}${rowIndex}`;
  console.log(`  📝 書き込み先: ${range} = "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
  );

  const sheets = await getSheetsClient();

  // スプシ全体を取得
  console.log('📊 スプレッドシートを取得中...');
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
  console.log(`✅ ${rows.length - 1}行取得完了\n`);

  // ターゲット行を検索するヘルパー
  function findRow(sellerNumber: string): { row: any[]; rowIndex: number } | null {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === sellerNumber) {
        return { row: rows[i], rowIndex: i + 1 }; // rowIndex は1-indexed（スプシ上の行番号）
      }
    }
    return null;
  }

  function getRowData(row: any[]): Record<string, string> {
    const data: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      data[headers[i]] = row[i] !== undefined ? String(row[i]) : '';
    }
    return data;
  }

  // =========================================================
  // 問題1: AA13807 の物件住所
  // =========================================================
  console.log('='.repeat(60));
  console.log('【AA13807】物件住所の修正');
  console.log('='.repeat(60));

  const aa13807Found = findRow('AA13807');
  if (!aa13807Found) {
    console.error('❌ AA13807 がスプシに見つかりません');
  } else {
    const aa13807Data = getRowData(aa13807Found.row);
    const spshPropertyAddress = aa13807Data['物件所在地'] || '';
    console.log(`スプシの物件所在地: "${spshPropertyAddress}"`);

    // DBの現在値を確認
    const { data: seller13807 } = await supabase
      .from('sellers')
      .select('id, seller_number, property_address')
      .eq('seller_number', 'AA13807')
      .single();

    console.log(`DBの property_address: "${seller13807?.property_address ?? '(null)'}"`);

    if (spshPropertyAddress && spshPropertyAddress.trim() !== '') {
      // スプシに値あり → DBに書き込む
      console.log('\n✅ スプシに値あり → DBに書き込みます');
      const { error } = await supabase
        .from('sellers')
        .update({ property_address: spshPropertyAddress.trim() })
        .eq('seller_number', 'AA13807');
      if (error) {
        console.error('❌ DB更新エラー:', error.message);
      } else {
        console.log('✅ DB更新完了');
      }
    } else if (seller13807?.property_address && seller13807.property_address.trim() !== '') {
      // DBに値あり、スプシが空 → スプシに書き込む
      console.log('\n✅ DBに値あり、スプシが空 → スプシに書き込みます');
      const colIndex = headers.indexOf('物件所在地');
      if (colIndex === -1) {
        console.error('❌ スプシに「物件所在地」列が見つかりません');
      } else {
        await writeToSheet(sheets, aa13807Found.rowIndex, colIndex, seller13807.property_address.trim());
        console.log('✅ スプシ更新完了');
      }
    } else {
      console.log('\n⚠️  DBもスプシも物件住所が空です');
      console.log('   → スプレッドシートに直接「物件所在地」を入力してください');
      console.log('   → 入力後、GASの10分同期でDBに反映されます');
    }
  }

  // =========================================================
  // 問題2: AA6 のコメント（DB→スプシ）
  // =========================================================
  console.log('\n' + '='.repeat(60));
  console.log('【AA6】コメントのDB→スプシ同期');
  console.log('='.repeat(60));

  // DBからAA6のコメントを取得
  const { data: seller6 } = await supabase
    .from('sellers')
    .select('id, seller_number, comments, unreachable_status')
    .eq('seller_number', 'AA6')
    .single();

  if (!seller6) {
    console.error('❌ AA6 がDBに見つかりません');
  } else {
    console.log(`DBのコメント（先頭100文字）: "${(seller6.comments || '').substring(0, 100)}"`);
    console.log(`DBの不通ステータス: "${seller6.unreachable_status ?? '(null)'}"`);

    const aa6Found = findRow('AA6');
    if (!aa6Found) {
      console.error('❌ AA6 がスプシに見つかりません');
    } else {
      const aa6Data = getRowData(aa6Found.row);
      console.log(`スプシのコメント（先頭100文字）: "${(aa6Data['コメント'] || '').substring(0, 100)}"`);

      // コメントをスプシに書き込む
      if (seller6.comments && seller6.comments.trim() !== '') {
        const commentsColIndex = headers.indexOf('コメント');
        if (commentsColIndex === -1) {
          console.error('❌ スプシに「コメント」列が見つかりません');
        } else {
          console.log('\n✅ DBのコメントをスプシに書き込みます');
          await writeToSheet(sheets, aa6Found.rowIndex, commentsColIndex, seller6.comments.trim());
          console.log('✅ コメントのスプシ書き込み完了');
        }
      } else {
        console.log('\nℹ️  DBのコメントが空のため、スプシへの書き込みをスキップします');
      }

      // 不通ステータスもスプシに書き込む（念のため）
      if (seller6.unreachable_status !== null && seller6.unreachable_status !== undefined) {
        const unreachableColIndex = headers.indexOf('不通');
        if (unreachableColIndex !== -1) {
          console.log('\n✅ 不通ステータスもスプシに書き込みます');
          await writeToSheet(sheets, aa6Found.rowIndex, unreachableColIndex, seller6.unreachable_status || '');
          console.log('✅ 不通ステータスのスプシ書き込み完了');
        }
      }
    }
  }

  console.log('\n✅ 全処理完了');
}

main().catch(console.error);
