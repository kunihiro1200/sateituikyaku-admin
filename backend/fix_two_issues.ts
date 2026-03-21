/**
 * 2つの問題を修正するスクリプト
 * 1. AA13807: properties テーブルの property_address を sellers テーブルから更新
 * 2. AA6: DB の comments をスプレッドシートに書き込む
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_NAME = '売主リスト';

async function getSheetsClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '';
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ===== 問題1: AA13807 の properties テーブルを修正 =====
  console.log('\n===== 問題1: AA13807 の物件住所修正 =====');

  const { data: aa13807, error: e1 } = await supabase
    .from('sellers')
    .select('id, seller_number, property_address')
    .eq('seller_number', 'AA13807')
    .single();

  if (e1 || !aa13807) {
    console.error('❌ AA13807 が見つかりません:', e1?.message);
  } else {
    console.log('sellers.property_address:', aa13807.property_address);

    // properties テーブルのカラム構造を確認
    const { data: props, error: e2 } = await supabase
      .from('properties')
      .select('*')
      .eq('seller_id', aa13807.id);

    if (e2) {
      console.error('❌ properties 取得エラー:', e2.message);
    } else if (!props || props.length === 0) {
      console.log('ℹ️  properties テーブルに AA13807 のレコードなし');
      console.log('   → sellers.property_address が直接使われるため問題なし');
    } else {
      console.log('properties レコード数:', props.length);
      console.log('properties カラム一覧:', Object.keys(props[0]));

      // property_address カラムが存在するか確認
      const prop = props[0];
      if ('property_address' in prop) {
        console.log('現在の property_address:', prop.property_address);
        if (!prop.property_address || prop.property_address === '未入力') {
          const { error: e3 } = await supabase
            .from('properties')
            .update({ property_address: aa13807.property_address })
            .eq('seller_id', aa13807.id);
          if (e3) {
            console.error('❌ 更新エラー:', e3.message);
          } else {
            console.log('✅ property_address を更新しました:', aa13807.property_address);
          }
        } else {
          console.log('ℹ️  property_address は既に設定済み:', prop.property_address);
        }
      } else {
        console.log('ℹ️  properties テーブルに property_address カラムなし');
        console.log('   → getSeller() は sellers.property_address を直接使用するため問題なし');
      }
    }
  }

  // ===== 問題2: AA6 のコメントをスプレッドシートに書き込む =====
  console.log('\n===== 問題2: AA6 コメントをスプシに書き込む =====');

  const { data: aa6, error: e4 } = await supabase
    .from('sellers')
    .select('id, seller_number, comments')
    .eq('seller_number', 'AA6')
    .single();

  if (e4 || !aa6) {
    console.error('❌ AA6 が見つかりません:', e4?.message);
    return;
  }

  console.log('DB の comments (先頭200文字):', aa6.comments?.substring(0, 200) ?? '(空)');

  if (!aa6.comments || aa6.comments.trim() === '') {
    console.log('ℹ️  コメントが空のため、スプシへの書き込みをスキップします');
    return;
  }

  // スプレッドシートのヘッダーと AA6 の行を取得
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
  console.log('ヘッダー数:', headers.length);

  // コメント列のインデックスを取得
  const commentColIndex = headers.indexOf('コメント');
  if (commentColIndex === -1) {
    console.error('❌ スプレッドシートに「コメント」列が見つかりません');
    console.log('利用可能なヘッダー（一部）:', headers.slice(0, 50));
    return;
  }
  console.log('「コメント」列インデックス:', commentColIndex, '（B列基準）');

  // AA6 の行を検索
  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'AA6') {
      targetRowIndex = i + 1; // 1-indexed（ヘッダーが1行目）
      console.log(`✅ AA6 を ${targetRowIndex} 行目で発見`);
      break;
    }
  }

  if (targetRowIndex === -1) {
    console.error('❌ AA6 がスプレッドシートに見つかりません');
    return;
  }

  // 現在のコメント値を確認
  const currentComment = rows[targetRowIndex - 1]?.[commentColIndex] ?? '';
  console.log('現在のスプシのコメント (先頭200文字):', String(currentComment).substring(0, 200));

  // スプレッドシートの列番号を計算（B列=2列目が基準なので +2）
  // B列がインデックス0なので、実際の列番号は commentColIndex + 2
  const actualColNumber = commentColIndex + 2; // A=1, B=2, ...
  const colLetter = columnNumberToLetter(actualColNumber);
  const cellAddress = `${SHEET_NAME}!${colLetter}${targetRowIndex}`;

  console.log(`書き込み先セル: ${cellAddress}`);

  const { data: updateResult, ...updateResponse } = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: cellAddress,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[aa6.comments]],
    },
  });

  console.log('✅ スプレッドシートへの書き込み完了');
  console.log('更新セル数:', updateResult?.updatedCells);
}

function columnNumberToLetter(n: number): string {
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

main().catch(console.error);
