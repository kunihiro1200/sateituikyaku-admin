/**
 * Gmail の Send As 設定を確認して表示名を修正するスクリプト
 */
require('dotenv').config({ path: '.env.vercel.pulled' });

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function decrypt(encryptedData) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf-8');
  const buffer = Buffer.from(encryptedData, 'base64');

  const minLen = IV_LENGTH + SALT_LENGTH + TAG_LENGTH;
  if (buffer.length < minLen) {
    // 平文として扱う
    return encryptedData;
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // tenant@ifoo-oita.com のトークンを取得
  const { data: employee } = await supabase
    .from('employees')
    .select('id, email')
    .eq('email', 'tenant@ifoo-oita.com')
    .single();

  if (!employee) {
    console.error('tenant@ifoo-oita.com が見つかりません');
    return;
  }
  console.log('Employee:', employee.id, employee.email);

  const { data: tokenData } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('employee_id', employee.id)
    .single();

  if (!tokenData) {
    console.error('トークンが見つかりません');
    return;
  }
  console.log('Token found, expiry:', tokenData.token_expiry);

  const refreshToken = decrypt(tokenData.encrypted_refresh_token);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // アクセストークンを更新
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);
  console.log('✅ アクセストークン取得成功');

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Send As 設定を取得
  const result = await gmail.users.settings.sendAs.list({ userId: 'me' });
  const sendAsList = result.data.sendAs || [];

  console.log('\n=== Send As 設定 ===');
  for (const s of sendAsList) {
    console.log(`  email: ${s.sendAsEmail}`);
    console.log(`  displayName: ${JSON.stringify(s.displayName)}`);
    console.log(`  isDefault: ${s.isDefault}`);
    console.log('---');
  }

  // 文字化けしている表示名を修正
  // 文字化けパターン: UTF-8バイト列をLatin-1で読んだ場合に現れる文字
  for (const s of sendAsList) {
    const name = s.displayName || '';
    // Latin-1の特殊文字が含まれているか（文字化けの典型パターン）
    const hasGarbled = /[\u00c0-\u00ff]/.test(name) && !/^[\x00-\x7F\u3000-\u9fff\uff00-\uffef]*$/.test(name);
    
    if (hasGarbled) {
      console.log(`\n⚠️  文字化けを検出: "${name}"`);
      // Latin-1として解釈されたUTF-8バイト列を正しく復元
      try {
        const fixed = Buffer.from(name, 'latin1').toString('utf8');
        console.log(`  修正後: "${fixed}"`);

        await gmail.users.settings.sendAs.patch({
          userId: 'me',
          sendAsEmail: s.sendAsEmail,
          requestBody: { displayName: fixed },
        });
        console.log(`  ✅ 修正完了: ${s.sendAsEmail} の表示名を "${fixed}" に更新しました`);
      } catch (e) {
        console.error(`  ❌ 修正失敗:`, e.message);
      }
    } else if (name) {
      console.log(`\n✅ "${name}" は正常です`);
    } else {
      console.log(`\n  (表示名なし)`);
    }
  }
}

main().catch(console.error);
