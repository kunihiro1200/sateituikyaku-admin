/**
 * Send As の displayName を空にして Gmail の自動付加を無効化するスクリプト
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
  console.log('✅ アクセストークン取得成功');

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // 現在の設定を確認
  const before = await gmail.users.settings.sendAs.list({ userId: 'me' });
  console.log('=== 現在の設定 ===');
  for (const s of before.data.sendAs || []) {
    console.log(`  ${s.sendAsEmail}: displayName="${s.displayName}"`);
  }

  // displayName を空にする（Gmail が自動付加しなくなる）
  await gmail.users.settings.sendAs.patch({
    userId: 'me',
    sendAsEmail: 'tenant@ifoo-oita.com',
    requestBody: { displayName: '' },
  });
  console.log('\n✅ displayName を空に設定しました');

  // 確認
  const after = await gmail.users.settings.sendAs.list({ userId: 'me' });
  console.log('\n=== 変更後の設定 ===');
  for (const s of after.data.sendAs || []) {
    console.log(`  ${s.sendAsEmail}: displayName="${s.displayName}"`);
  }
  
  console.log('\n次のステップ: コードの encodeFrom で "株式会社いふう" を From ヘッダーに明示設定します');
}

main().catch(console.error);
