/**
 * Send As の displayName を確認して、
 * Gmail が From ヘッダーに付加する表示名を修正するスクリプト
 * 
 * 問題: Gmail API で From: tenant@ifoo-oita.com と送信すると
 * Gmail が Send As の displayName を自動付加するが、
 * その際に文字化けが発生している
 * 
 * 解決: displayName を一度空にしてから正しい値を再設定する
 */
require('dotenv').config({ path: '.env.vercel.pulled' });

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function decrypt(encryptedData) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf-8');
  const buffer = Buffer.from(encryptedData, 'base64');
  const minLen = IV_LENGTH + SALT_LENGTH + TAG_LENGTH;
  if (buffer.length < minLen) return encryptedData;
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const { data: employee } = await supabase
    .from('employees')
    .select('id, email')
    .eq('email', 'tenant@ifoo-oita.com')
    .single();

  const { data: tokenData } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('employee_id', employee.id)
    .single();

  const refreshToken = decrypt(tokenData.encrypted_refresh_token);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // 現在の設定を確認
  const before = await gmail.users.settings.sendAs.list({ userId: 'me' });
  console.log('=== 修正前 ===');
  for (const s of before.data.sendAs || []) {
    console.log(`${s.sendAsEmail}: displayName="${s.displayName}"`);
    console.log(`  hex: ${Buffer.from(s.displayName || '', 'utf-8').toString('hex')}`);
  }

  // Step 1: displayName を一度空にする
  console.log('\nStep 1: displayName を空にする...');
  await gmail.users.settings.sendAs.patch({
    userId: 'me',
    sendAsEmail: 'tenant@ifoo-oita.com',
    requestBody: { displayName: '' },
  });
  console.log('✅ 空にしました');

  // 少し待つ
  await new Promise(r => setTimeout(r, 2000));

  // Step 2: 正しい表示名を再設定
  const correctName = '株式会社いふう';
  console.log(`\nStep 2: displayName を "${correctName}" に再設定...`);
  await gmail.users.settings.sendAs.patch({
    userId: 'me',
    sendAsEmail: 'tenant@ifoo-oita.com',
    requestBody: { displayName: correctName },
  });
  console.log('✅ 再設定しました');

  // 確認
  const after = await gmail.users.settings.sendAs.list({ userId: 'me' });
  console.log('\n=== 修正後 ===');
  for (const s of after.data.sendAs || []) {
    console.log(`${s.sendAsEmail}: displayName="${s.displayName}"`);
    console.log(`  hex: ${Buffer.from(s.displayName || '', 'utf-8').toString('hex')}`);
  }
}

main().catch(console.error);
