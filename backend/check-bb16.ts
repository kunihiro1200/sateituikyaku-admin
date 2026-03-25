import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// BL列 = 64列目（0-indexed: 63）
const BL_INDEX = 63;

async function check() {
  // 1. property_listingsのBB16を確認
  const { data: pl, error: e1 } = await supabase
    .from('property_listings')
    .select('property_number, seller_name, seller_contact, address')
    .eq('property_number', 'BB16')
    .single();
  console.log('=== property_listings BB16 ===');
  console.log(JSON.stringify(pl, null, 2));
  if (e1) console.log('error:', e1.message);

  // 2. 物件リストスプレッドシートのヘッダーを確認（BL列周辺）
  console.log('\n=== 物件リストスプレッドシートのヘッダー確認 ===');
  const propertyListingConfig = {
    spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_PROPERTY_LISTING_SPREADSHEET_ID!,
    sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };
  console.log('spreadsheetId:', propertyListingConfig.spreadsheetId);
  console.log('sheetName:', propertyListingConfig.sheetName);

  try {
    const sheetsClient = new GoogleSheetsClient(propertyListingConfig);
    await sheetsClient.authenticate();
    const headers = await sheetsClient.getHeaders();
    
    console.log(`総ヘッダー数: ${headers.length}`);
    console.log(`BL列(index ${BL_INDEX})のヘッダー: "${headers[BL_INDEX]}"`);
    
    // BK〜BN列周辺を表示
    console.log('\nBJ〜BN列のヘッダー:');
    for (let i = 61; i <= 66; i++) {
      const colLetter = indexToColLetter(i);
      console.log(`  ${colLetter}列(index ${i}): "${headers[i] ?? '(なし)'}"`);
    }

    // "名前"を含むヘッダーを全て検索
    console.log('\n"名前"を含むヘッダー:');
    headers.forEach((h, i) => {
      if (h && h.includes('名前')) {
        console.log(`  ${indexToColLetter(i)}列(index ${i}): "${h}"`);
      }
    });

    // BB16の行データを取得してBL列の値を確認
    console.log('\n=== BB16のスプレッドシートデータ（BL列） ===');
    const rows = await sheetsClient.readAll();
    const bb16Row = rows.find((r: any) => r['物件番号'] === 'BB16');
    if (bb16Row) {
      console.log('物件番号:', bb16Row['物件番号']);
      console.log('名前(売主）:', bb16Row['名前(売主）'] ?? '(null/空)');
      // seller関連フィールドを全て表示
      Object.entries(bb16Row).forEach(([k, v]) => {
        if (k.includes('名前') || k.includes('売主')) {
          console.log(`  ${k}: ${v ?? '(null)'}`);
        }
      });
    } else {
      console.log('BB16の行が見つかりませんでした');
    }
  } catch (err: any) {
    console.log('スプレッドシート取得エラー:', err.message);
    // 環境変数を確認
    console.log('\n利用可能な環境変数（SPREADSHEET関連）:');
    Object.entries(process.env).filter(([k]) => k.includes('SPREADSHEET') || k.includes('SHEET')).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}`);
    });
  }
}

function indexToColLetter(index: number): string {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

check().catch(console.error);
