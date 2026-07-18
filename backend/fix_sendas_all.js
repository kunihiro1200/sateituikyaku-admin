/**
 * Gmail の全 Send As 設定を確認して表示名を強制的に正しく設定するスクリプト
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

  // 全 Send As 設定を取得
  const result = await gmail.users.settings.sendAs.list({ userId: 'me' });
  const sendAsList = result.data.sendAs || [];

  console.log('\n=== 現在の Send As 設定（全件）===');
  for (const s of sendAsList) {
    // バイト列を16進数で表示して文字化けを検出
    const nameBytes = Buffer.from(s.displayName || '', 'utf-8');
    const nameLatin1 = Buffer.from(s.displayName || '', 'latin1');
    console.log(`  email: ${s.sendAsEmail}`);
    console.log(`  displayName: ${JSON.stringify(s.displayName)}`);
    console.log(`  displayName (hex): ${nameBytes.toString('hex')}`);
    console.log(`  isDefault: ${s.isDefault}`);
    console.log(`  isPrimary: ${s.isPrimary}`);
    console.log('---');
  }

  // 文字化けチェック: Latin-1 の拡張文字（0xC0-0xFF）が含まれているか
  // UTF-8の日本語は0xE3-0xE9などのバイトで始まるが、
  // それをLatin-1で読むと0xC3-0xC9などになる
  for (const s of sendAsList) {
    const name = s.displayName || '';
    if (!name) continue;

    // 文字化けパターン: æ(0xE6→0xC3 0xA6), å(0xE5→0xC3 0xA5) などのLatin-1文字
    // UTF-8の「株」は E6 A0 AA → Latin-1で読むと æ  ª
    const hasGarbled = /[æåäöüÄÖÜàáâãèéêëìíîïòóôõùúûýÿ]/.test(name);

    if (hasGarbled) {
      console.log(`\n⚠️  文字化けを検出: "${name}"`);
      const fixed = Buffer.from(name, 'latin1').toString('utf8');
      console.log(`  修正後: "${fixed}"`);

      try {
        await gmail.users.settings.sendAs.patch({
          userId: 'me',
          sendAsEmail: s.sendAsEmail,
          requestBody: { displayName: fixed },
        });
        console.log(`  ✅ 修正完了`);
      } catch (e) {
        console.error(`  ❌ 修正失敗:`, e.message);
      }
    } else {
      // 正常に見えても念のため UTF-8 として有効か確認
      try {
        Buffer.from(name, 'utf-8'); // エラーなければOK
        console.log(`\n✅ "${name}" は正常です`);
      } catch (e) {
        console.log(`\n⚠️  "${name}" は無効なUTF-8です`);
      }
    }
  }

  // 再確認
  console.log('\n=== 修正後の Send As 設定 ===');
  const result2 = await gmail.users.settings.sendAs.list({ userId: 'me' });
  for (const s of result2.data.sendAs || []) {
    console.log(`  ${s.sendAsEmail}: "${s.displayName}"`);
  }
}

main().catch(console.error);
