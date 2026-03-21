/**
 * AA13607の強制同期スクリプト
 * スプレッドシートからDBへ name/phone_number/email/address/property_address を再同期する
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { encrypt } from './src/utils/encryption';

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

  const name = toStr(row['名前(漢字のみ）']);
  const phone = toStr(row['電話番号\nハイフン不要']) || toStr(row['電話番号']);
  const email = toStr(row['メールアドレス']);
  const address = toStr(row['依頼者住所(物件所在と異なる場合）']);
  const propertyAddress = toStr(row['物件所在地']);

  console.log('� スプレッドシートのデータ:');
  console.log('  名前:', name || '(空)');
  console.log('  電話番号:', phone || '(空)');
  console.log('  メール:', email || '(空)');
  console.log('  住所:', address || '(空)');
  console.log('  物件住所:', propertyAddress || '(空)');

  // DBの現状確認
  const { data: dbSeller } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, email, address, property_address')
    .eq('seller_number', SELLER_NUMBER)
    .single();

  console.log('\n📦 DB現状:');
  console.log('  name:', dbSeller?.name ? '(暗号化済み)' : '(null/空)');
  console.log('  phone_number:', dbSeller?.phone_number ? '(暗号化済み)' : '(null/空)');
  console.log('  email:', dbSeller?.email ? '(暗号化済み)' : '(null/空)');
  console.log('  address:', dbSeller?.address ? '(暗号化済み)' : '(null/空)');
  console.log('  property_address:', dbSeller?.property_address || '(null/空)');

  // 更新データを構築（値がある場合のみ）
  const updateData: any = { updated_at: new Date().toISOString() };

  if (name) updateData.name = encrypt(name);
  if (phone) updateData.phone_number = encrypt(phone);
  if (email) updateData.email = encrypt(email);
  if (address) updateData.address = encrypt(address);
  if (propertyAddress) updateData.property_address = propertyAddress;

  if (Object.keys(updateData).length === 1) {
    console.log('\n⚠️ スプレッドシートに更新すべき値がありません');
    return;
  }

  console.log('\n🔄 更新するフィールド:', Object.keys(updateData).filter(k => k !== 'updated_at'));

  const { error } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', SELLER_NUMBER);

  if (error) {
    console.error('❌ 更新エラー:', error);
  } else {
    console.log('✅ AA13607 の同期完了');
  }
}

main().catch(console.error);
