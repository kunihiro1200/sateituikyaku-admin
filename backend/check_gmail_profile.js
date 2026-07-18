/**
 * Gmail プロファイル（アカウント表示名）を確認するスクリプト
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

  // Gmail プロファイルを取得
  const profile = await gmail.users.getProfile({ userId: 'me' });
  console.log('\n=== Gmail プロファイル ===');
  console.log('emailAddress:', profile.data.emailAddress);
  console.log('messagesTotal:', profile.data.messagesTotal);

  // Send As 設定を全て取得（Raw バイト表示）
  const result = await gmail.users.settings.sendAs.list({ userId: 'me' });
  console.log('\n=== Send As 設定（Raw バイト詳細） ===');
  for (const s of result.data.sendAs || []) {
    const nameRaw = s.displayName || '';
    const nameHex = Buffer.from(nameRaw).toString('hex');
    const nameUtf8Valid = (() => {
      try {
        const re = Buffer.from(nameRaw, 'utf-8').toString('utf-8');
        return re === nameRaw;
      } catch(e) { return false; }
    })();
    console.log(`email: ${s.sendAsEmail}`);
    console.log(`displayName: ${JSON.stringify(nameRaw)}`);
    console.log(`displayName hex: ${nameHex}`);
    console.log(`UTF-8 valid: ${nameUtf8Valid}`);
    console.log(`isDefault: ${s.isDefault}, isPrimary: ${s.isPrimary}`);

    // 文字化けパターン検出（UTF-8の多バイト文字がLatin-1で解釈された場合）
    // 「株式会社」の UTF-8: e6 a0 aa e5 bc 8f e4 bc 9a e7 a4 be
    // Latin-1として読むと: æ   ª å ¼  ä ¼ š ç ¤ ¾
    const charCodes = Array.from(nameRaw).map(c => c.charCodeAt(0));
    const hasHighLatin = charCodes.some(c => c >= 0xC0 && c <= 0xFF);
    const hasFullWidth = charCodes.some(c => c >= 0x3000);
    console.log(`高位Latin文字含む(文字化け可能性): ${hasHighLatin}, 日本語含む: ${hasFullWidth}`);
    console.log('---');
  }
}

main().catch(console.error);
