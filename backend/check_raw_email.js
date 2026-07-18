/**
 * 最新の送信済みメールの Raw From ヘッダーを確認するスクリプト
 */
require('dotenv').config({ path: '.env.vercel.pulled' });

const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
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
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
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

  // 送信済みメールの最新5件を取得
  const list = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['SENT'],
    maxResults: 5,
  });

  const messages = list.data.messages || [];
  console.log(`送信済みメール ${messages.length} 件を確認\n`);

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = detail.data.payload?.headers || [];
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    console.log(`Date: ${date}`);
    console.log(`From (raw): ${JSON.stringify(from)}`);
    console.log(`Subject: ${subject}`);
    console.log('---');
  }
}

main().catch(console.error);
