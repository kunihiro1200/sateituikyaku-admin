/**
 * AA13810 の全フィールド（電話番号・メアド含む）を強制同期するスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { encrypt } from './src/utils/encryption';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_NAME = '売主リスト';

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

function parseDate(value: any): string | null {
  if (!value || String(value).trim() === '') return null;
  const str = String(value).trim();
  // YYYY/MM/DD → YYYY-MM-DD
  const fullMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (fullMatch) {
    return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`;
  }
  // YYYY-MM-DD はそのまま
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // M/D または MM/DD（年なし）→ 今年として解釈
  const shortMatch = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortMatch) {
    const year = new Date().getFullYear();
    return `${year}-${shortMatch[1].padStart(2, '0')}-${shortMatch[2].padStart(2, '0')}`;
  }
  return null;
}

async function forceSyncSeller(sellerNumber: string) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 スプレッドシートからAA13810のデータを取得中...');

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
  console.log(`📋 ヘッダー行: ${headers.length}列`);

  // AA13810の行を検索（B列 = index 0）
  let targetRow: any[] | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'AA13810') {
      targetRow = rows[i];
      console.log(`✅ AA13810 を ${i + 1} 行目で発見`);
      break;
    }
  }

  if (!targetRow) {
    console.error('❌ AA13810 がスプレッドシートに見つかりませんでした');
    return;
  }

  // ヘッダーとデータをマッピング
  const rowData: Record<string, any> = {};
  for (let i = 0; i < headers.length; i++) {
    rowData[headers[i]] = targetRow[i] !== undefined ? targetRow[i] : '';
  }

  console.log('\n📋 スプレッドシートのデータ:');
  console.log('  売主番号:', rowData['売主番号']);
  console.log('  名前:', rowData['名前(漢字のみ）']);
  console.log('  電話番号:', rowData['電話番号\nハイフン不要'] || rowData['電話番号']);
  console.log('  メールアドレス:', rowData['メールアドレス']);
  console.log('  物件所在地:', rowData['物件所在地']);
  console.log('  状況（売主）:', rowData['状況（売主）']);
  console.log('  状況（当社）:', rowData['状況（当社）']);
  console.log('  次電日:', rowData['次電日']);
  console.log('  反響日付:', rowData['反響日付']);
  console.log('  査定方法:', rowData['査定方法']);
  console.log('  査定額1（手動）:', rowData['査定額1']);
  console.log('  査定額2（手動）:', rowData['査定額2']);
  console.log('  査定額3（手動）:', rowData['査定額3']);

  const updateData: Record<string, any> = {};

  // 氏名（暗号化）
  const name = rowData['名前(漢字のみ）'];
  if (name && name.trim() !== '') {
    updateData.name = encrypt(name.trim());
    console.log('\n✅ 氏名を暗号化して更新します');
  }

  // 電話番号（暗号化）- ヘッダー名に改行が含まれる場合がある
  const phoneRaw = rowData['電話番号\nハイフン不要'] || rowData['電話番号'];
  if (phoneRaw && String(phoneRaw).trim() !== '') {
    updateData.phone_number = encrypt(String(phoneRaw).trim());
    console.log('✅ 電話番号を暗号化して更新します');
  }

  // メールアドレス（暗号化）
  const email = rowData['メールアドレス'];
  if (email && String(email).trim() !== '') {
    updateData.email = encrypt(String(email).trim());
    console.log('✅ メールアドレスを暗号化して更新します:', String(email).trim());
  } else {
    updateData.email = null;
    console.log('ℹ️  メールアドレスは空欄 → nullで更新');
  }

  // 物件住所
  const propertyAddress = rowData['物件所在地'];
  if (propertyAddress && propertyAddress.trim() !== '') {
    updateData.property_address = propertyAddress.trim();
    console.log('✅ 物件住所を更新します:', propertyAddress.trim());
  }

  // 状況（売主）
  const currentStatus = rowData['状況（売主）'];
  updateData.current_status = currentStatus && currentStatus.trim() !== '' ? currentStatus.trim() : null;
  console.log('✅ 状況（売主）:', updateData.current_status ?? 'null');

  // 状況（当社）
  const status = rowData['状況（当社）'];
  if (status && status.trim() !== '') {
    updateData.status = status.trim();
    console.log('✅ 状況（当社）を更新します:', status.trim());
  }

  // 次電日
  const nextCallDate = parseDate(rowData['次電日']);
  updateData.next_call_date = nextCallDate;
  console.log('✅ 次電日:', nextCallDate ?? 'null');

  // 反響日付
  const inquiryDate = parseDate(rowData['反響日付']);
  if (inquiryDate) {
    updateData.inquiry_date = inquiryDate;
    console.log('✅ 反響日付:', inquiryDate);
  }

  // 査定方法
  const valuationMethod = rowData['査定方法'];
  if (valuationMethod && valuationMethod.trim() !== '') {
    updateData.valuation_method = valuationMethod.trim();
    console.log('✅ 査定方法:', valuationMethod.trim());
  }

  // 査定額（手動入力優先、なければ自動計算）
  const val1Raw = rowData['査定額1'] || rowData['査定額1（自動計算）v'];
  const val2Raw = rowData['査定額2'] || rowData['査定額2（自動計算）v'];
  const val3Raw = rowData['査定額3'] || rowData['査定額3（自動計算）v'];

  const val1 = parseNumeric(val1Raw);
  const val2 = parseNumeric(val2Raw);
  const val3 = parseNumeric(val3Raw);

  if (val1 !== null) {
    updateData.valuation_amount_1 = val1 * 10000;
    console.log(`✅ 査定額1: ${val1}万円 → ${val1 * 10000}円`);
  }
  if (val2 !== null) {
    updateData.valuation_amount_2 = val2 * 10000;
    console.log(`✅ 査定額2: ${val2}万円 → ${val2 * 10000}円`);
  }
  if (val3 !== null) {
    updateData.valuation_amount_3 = val3 * 10000;
    console.log(`✅ 査定額3: ${val3}万円 → ${val3 * 10000}円`);
  }

  // コミュニケーション情報
  const phoneContactPerson = rowData['電話担当（任意）'];
  if (phoneContactPerson && phoneContactPerson.trim() !== '') {
    updateData.phone_contact_person = phoneContactPerson.trim();
    console.log('✅ 電話担当:', phoneContactPerson.trim());
  }

  const preferredContactTime = rowData['連絡取りやすい日、時間帯'];
  if (preferredContactTime && preferredContactTime.trim() !== '') {
    updateData.preferred_contact_time = preferredContactTime.trim();
    console.log('✅ 連絡取りやすい時間:', preferredContactTime.trim());
  }

  const contactMethod = rowData['連絡方法'];
  if (contactMethod && contactMethod.trim() !== '') {
    updateData.contact_method = contactMethod.trim();
    console.log('✅ 連絡方法:', contactMethod.trim());
  }

  updateData.updated_at = new Date().toISOString();

  console.log('\n🔄 DBを更新中...');
  const { error } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', 'AA13810');

  if (error) {
    console.error('❌ 更新エラー:', error.message);
    return;
  }

  // 確認
  const { data, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, email, property_address, current_status, status, next_call_date, valuation_method, valuation_amount_1, valuation_amount_2, valuation_amount_3, phone_contact_person, preferred_contact_time, contact_method')
    .eq('seller_number', 'AA13810')
    .single();

  if (fetchError) {
    console.error('❌ 確認エラー:', fetchError.message);
    return;
  }

  console.log('\n✅ 更新完了:');
  console.log('  name (暗号化済):', data?.name ? '設定済み' : 'null');
  console.log('  phone_number (暗号化済):', data?.phone_number ? '設定済み' : 'null');
  console.log('  email (暗号化済):', data?.email ? '設定済み' : 'null');
  console.log('  property_address:', data?.property_address);
  console.log('  current_status:', data?.current_status);
  console.log('  status:', data?.status);
  console.log('  next_call_date:', data?.next_call_date);
  console.log('  valuation_method:', data?.valuation_method);
  console.log('  valuation_amount_1:', data?.valuation_amount_1);
  console.log('  valuation_amount_2:', data?.valuation_amount_2);
  console.log('  valuation_amount_3:', data?.valuation_amount_3);
  console.log('  phone_contact_person:', data?.phone_contact_person);
  console.log('  preferred_contact_time:', data?.preferred_contact_time);
  console.log('  contact_method:', data?.contact_method);
}

forceSyncAA13810Complete().catch(console.error);
