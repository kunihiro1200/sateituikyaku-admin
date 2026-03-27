/**
 * AA6の暗号化文字列がDBに残っている問題を修正するスクリプト
 * 
 * 問題: スプシ→DB同期でAA6のname/phone_number/emailが
 *       暗号化済み文字列のままDBに保存されている
 * 
 * 解決: スプシから正しい値を読み取り、正しく暗号化してDBに保存する
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { encrypt, decrypt } from './src/utils/encryption';
import * as fs from 'fs';

const SELLER_NUMBER = 'AA6';

async function main() {
  // Supabaseクライアント初期化
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('=== AA6 暗号化データ修正スクリプト ===\n');

  // 1. 現在のDBの状態を確認
  console.log('1. 現在のDBの状態を確認...');
  const { data: currentSeller, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, email')
    .eq('seller_number', SELLER_NUMBER)
    .single();

  if (fetchError) {
    console.error('❌ DBからの取得エラー:', fetchError.message);
    return;
  }

  console.log('現在のDB値:');
  console.log('  name:', currentSeller.name?.substring(0, 30) + '...');
  console.log('  phone_number:', currentSeller.phone_number?.substring(0, 30) + '...');
  console.log('  email:', currentSeller.email?.substring(0, 30) + '...');

  // 暗号化済みかどうかチェック（Base64+特殊文字が含まれていれば暗号化済み）
  const isEncryptedString = (val: string | null) => {
    if (!val) return false;
    // 暗号化済み文字列はBase64形式（英数字+/+=）で長い
    return /^[A-Za-z0-9+/=]{20,}/.test(val) && val.length > 30;
  };

  const nameIsEncrypted = isEncryptedString(currentSeller.name);
  const phoneIsEncrypted = isEncryptedString(currentSeller.phone_number);
  const emailIsEncrypted = isEncryptedString(currentSeller.email);

  console.log('\n暗号化状態チェック:');
  console.log('  name 暗号化済み?:', nameIsEncrypted);
  console.log('  phone_number 暗号化済み?:', phoneIsEncrypted);
  console.log('  email 暗号化済み?:', emailIsEncrypted);

  // 2. スプレッドシートから正しい値を取得
  console.log('\n2. スプレッドシートから正しい値を取得...');

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';
  const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';

  let auth;
  try {
    const keyFile = path.resolve(__dirname, serviceAccountKeyPath);
    const keyContent = JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
    auth = new google.auth.GoogleAuth({
      credentials: keyContent,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } catch (e: any) {
    console.error('❌ Google認証エラー:', e.message);
    console.log('\n代替手段: スプシの正しい値を直接入力してDBを更新します');
    await manualUpdate(supabase);
    return;
  }

  const sheets = google.sheets({ version: 'v4', auth });

  // B列（売主番号）を検索してAA6の行を見つける
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!B:F`, // B=売主番号, C=名前, D=住所, E=電話番号, F=メール
  });

  const rows = response.data.values || [];
  let targetRow: any[] | null = null;
  let targetRowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === SELLER_NUMBER) {
      targetRow = rows[i];
      targetRowIndex = i;
      break;
    }
  }

  if (!targetRow) {
    console.error(`❌ スプシにAA6が見つかりません`);
    await manualUpdate(supabase);
    return;
  }

  const name = targetRow[1] || null;      // C列: 名前
  const address = targetRow[2] || null;   // D列: 住所
  const phone = targetRow[3] || null;     // E列: 電話番号
  const email = targetRow[4] || null;     // F列: メール

  console.log(`スプシの値（行 ${targetRowIndex + 1}）:`);
  console.log('  name:', name);
  console.log('  address:', address);
  console.log('  phone_number:', phone);
  console.log('  email:', email);

  // 3. 正しく暗号化してDBを更新
  console.log('\n3. 正しく暗号化してDBを更新...');

  const updateData: any = {};
  if (name) updateData.name = encrypt(name);
  if (phone) updateData.phone_number = encrypt(phone);
  if (email) updateData.email = encrypt(email);

  const { error: updateError } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', SELLER_NUMBER);

  if (updateError) {
    console.error('❌ DB更新エラー:', updateError.message);
    return;
  }

  console.log('✅ DB更新完了');

  // 4. 更新後の確認
  console.log('\n4. 更新後の確認...');
  const { data: updatedSeller } = await supabase
    .from('sellers')
    .select('seller_number, name, phone_number, email')
    .eq('seller_number', SELLER_NUMBER)
    .single();

  if (updatedSeller) {
    try {
      const decryptedName = updatedSeller.name ? decrypt(updatedSeller.name) : null;
      const decryptedPhone = updatedSeller.phone_number ? decrypt(updatedSeller.phone_number) : null;
      const decryptedEmail = updatedSeller.email ? decrypt(updatedSeller.email) : null;
      console.log('復号後の値:');
      console.log('  name:', decryptedName);
      console.log('  phone_number:', decryptedPhone);
      console.log('  email:', decryptedEmail);
      console.log('\n✅ 修正完了！');
    } catch (e: any) {
      console.error('❌ 復号エラー（暗号化が正しくない可能性）:', e.message);
    }
  }
}

/**
 * スプシへのアクセスができない場合の手動更新
 * スプシで確認した正しい値をここに直接入力して実行する
 */
async function manualUpdate(supabase: any) {
  console.log('\n=== 手動更新モード ===');
  console.log('スプシで確認したAA6の正しい値を以下に入力してください:');
  console.log('（このスクリプトを編集して値を設定してください）\n');

  // ここにスプシで確認した正しい値を入力してください
  const CORRECT_NAME = '';        // 例: '山田 太郎'
  const CORRECT_PHONE = '';       // 例: '09012345678'
  const CORRECT_EMAIL = '';       // 例: 'yamada@example.com'

  if (!CORRECT_NAME && !CORRECT_PHONE && !CORRECT_EMAIL) {
    console.log('⚠️  値が設定されていません。スクリプトを編集して正しい値を設定してください。');
    console.log('   backend/fix-aa6-encrypted-data.ts の manualUpdate 関数内の');
    console.log('   CORRECT_NAME, CORRECT_PHONE, CORRECT_EMAIL を設定してください。');
    return;
  }

  const updateData: any = {};
  if (CORRECT_NAME) updateData.name = encrypt(CORRECT_NAME);
  if (CORRECT_PHONE) updateData.phone_number = encrypt(CORRECT_PHONE);
  if (CORRECT_EMAIL) updateData.email = encrypt(CORRECT_EMAIL);

  const { error } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', 'AA6');

  if (error) {
    console.error('❌ 更新エラー:', error.message);
  } else {
    console.log('✅ 手動更新完了');
  }
}

main().catch(console.error);
