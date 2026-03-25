import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // 環境変数からスプレッドシートIDを探す
  const spreadsheetId =
    process.env.PROPERTY_LISTING_SPREADSHEET_ID ||
    process.env.GOOGLE_SHEETS_PROPERTY_LISTING_SPREADSHEET_ID ||
    process.env.PROPERTY_LIST_SPREADSHEET_ID;

  if (!spreadsheetId) {
    console.log('スプレッドシートID未設定。環境変数を確認:');
    Object.entries(process.env)
      .filter(([k]) => k.toUpperCase().includes('SPREAD') || k.toUpperCase().includes('SHEET') || k.toUpperCase().includes('PROPERTY'))
      .forEach(([k, v]) => console.log(`  ${k}=${v}`));
    return;
  }

  const config = {
    spreadsheetId,
    sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };

  console.log('spreadsheetId:', spreadsheetId, '/ sheetName:', config.sheetName);

  const client = new GoogleSheetsClient(config);
  await client.authenticate();

  // BB16の行を取得
  const rows = await client.readAll();
  const bb16 = rows.find((r: any) => r['物件番号'] === 'BB16');

  console.log('\n=== BB16のスプレッドシートデータ ===');
  if (bb16) {
    console.log('物件番号:', bb16['物件番号']);
    console.log('名前(売主）[O列]:', bb16['名前(売主）'] ?? '(空/null)');
    console.log('住所(売主）:', bb16['住所(売主）'] ?? '(空/null)');
    console.log('●連絡先(売主）:', bb16['●連絡先(売主）'] ?? '(空/null)');
    console.log('●所有者情報[BL列]:', bb16['●所有者情報'] ?? '(空/null)');
  } else {
    console.log('BB16が見つかりません');
    // 物件番号の一覧を少し表示
    console.log('先頭10件の物件番号:', rows.slice(0, 10).map((r: any) => r['物件番号']));
  }

  // seller_nameがnullの物件をスプレッドシートで確認（最初の5件）
  const { data: nullNameProps } = await supabase
    .from('property_listings')
    .select('property_number, seller_name')
    .is('seller_name', null)
    .limit(5);

  console.log('\n=== DBでseller_nameがnullの物件（5件）のスプレッドシート値 ===');
  for (const prop of nullNameProps ?? []) {
    const row = rows.find((r: any) => r['物件番号'] === prop.property_number);
    const sheetValue = row ? (row['名前(売主）'] ?? '(空)') : '(スプシに行なし)';
    console.log(`  ${prop.property_number}: スプシO列="${sheetValue}"`);
  }
}

check().catch(console.error);
