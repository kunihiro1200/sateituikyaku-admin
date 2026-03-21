/**
 * AA13607の営担（visit_assignee）強制同期スクリプト
 * スプレッドシートの「営担」列の値を確認してDBに同期する
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

const SELLER_NUMBER = 'AA13607';

function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // スプレッドシートからデータ取得
  const sheetsConfig = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };

  const sheetsClient = new GoogleSheetsClient(sheetsConfig);
  await sheetsClient.authenticate();

  const rows = await sheetsClient.readAll();
  const row = rows.find((r: any) => r['売主番号'] === SELLER_NUMBER);

  if (!row) {
    console.error(`❌ ${SELLER_NUMBER} がスプレッドシートに見つかりません`);
    return;
  }

  // 訪問関連フィールドを確認
  const visitAssignee = row['営担'];
  const visitDate = row['訪問日 Y/M/D'] || row['訪問日\nY/M/D'] || row['訪問日'];
  const visitAcquisitionDate = row['訪問取得日\n年/月/日'] || row['訪問取得日'];

  console.log('📋 スプレッドシートの訪問関連データ:');
  console.log('  営担 (visitAssignee):', visitAssignee === undefined ? '(undefined - カラムなし)' : visitAssignee === '' ? '(空文字)' : visitAssignee);
  console.log('  訪問日:', visitDate || '(空)');
  console.log('  訪問取得日:', visitAcquisitionDate || '(空)');

  // 全カラムキーを表示（デバッグ用）
  console.log('\n📊 スプレッドシートの全カラムキー（訪問関連）:');
  const visitKeys = Object.keys(row).filter(k => k.includes('訪問') || k.includes('営担'));
  visitKeys.forEach(k => console.log(`  "${k}": "${row[k]}"`));

  // DBの現状確認
  const { data: dbSeller } = await supabase
    .from('sellers')
    .select('seller_number, visit_assignee, visit_date, visit_acquisition_date')
    .eq('seller_number', SELLER_NUMBER)
    .single();

  console.log('\n📦 DB現状:');
  console.log('  visit_assignee:', dbSeller?.visit_assignee || '(null/空)');
  console.log('  visit_date:', dbSeller?.visit_date || '(null/空)');
  console.log('  visit_acquisition_date:', dbSeller?.visit_acquisition_date || '(null/空)');

  // 営担の値が有効な場合のみ更新
  if (visitAssignee && visitAssignee !== '' && visitAssignee !== '外す') {
    console.log(`\n🔄 visit_assignee を "${visitAssignee}" に更新します...`);

    const { error } = await supabase
      .from('sellers')
      .update({
        visit_assignee: String(visitAssignee),
        updated_at: new Date().toISOString(),
      })
      .eq('seller_number', SELLER_NUMBER);

    if (error) {
      console.error('❌ 更新エラー:', error);
    } else {
      console.log('✅ visit_assignee の同期完了');
    }
  } else {
    console.log('\n⚠️ スプレッドシートの営担が空または「外す」のため、DBは更新しません');
    console.log('   スプレッドシートに営担を入力してから再実行してください');
  }
}

main().catch(console.error);
