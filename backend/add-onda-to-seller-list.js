/**
 * 恩田 透を売主リストスプレッドシートに手動追加するスクリプト
 * 外部パッケージ不要 - JWT署名にcryptoモジュールのみ使用
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
const SHEET_NAME = '売主リスト';
const CRON_SECRET = 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';
const BACKEND_URL = 'https://sateituikyaku-admin-backend.vercel.app';

// サービスアカウント情報
const SERVICE_ACCOUNT = {
  client_email: 'spreadsheet-sync@koukaibukkennsaito.iam.gserviceaccount.com',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDXt92lGDO0Ts1M
u9ScJs2RUXVZyWVe6sxwA3WEe5F5WTm9ZqC5kojx13BXEi+o+ODnObYT0MB7PJNN
3ZFIrvYOWKyv5pRGk2evWB/BEu86Rf1oyV1D8aEStpUoKSvI8hGXmLNgowXr2Tnp
yHPJg8nRKNSzqTjmp89ToI6P1T2PJC9hXxwtWJxVO/4WubPd+qHJyME724ZaMyl7
clzvfYXK+C1K+ppnYWy8oWH6AsDsEy4hSU1fa92p5jgCD21BPVYaQeAXqXzOiV2/
X5Ui+WvjsoG5quAXgskJNz340CRmk8gqMDBFL0oXYLRpz/bqHZWzikixBWEZmmSN
YhzbIACNAgMBAAECggEADPPGRCZq3FWq8AOLJYES8LnCYQy9oHBarBMZGEZPGskn
tV6XIe1Reavk2+WEpRGkd124uAHdvMiLU66NDZ8ruPrMC5e9qWsqW5Xf+jjH0mjn
aUZF6lF0yWnbFNk7/snCEqchhhjjvyCA4K+ffCcElCFufAcaGodS5IOMa8hy9Mgs
IHSHLp8HUFFAJE4mrdHFoT3mQnqj9Xdqu6Ynw3sVgLPeYNi77rNcLkjXoc3yQ7Vz
X59PLujnaAPBHkU+JN62hr1lyL/Cgd3Ed1KgtzS2kRLOW07M3p5L47Y2PBwCu+ma
0tW5m9n8VgZ4TQ68/tRR7eh2mdn+iCyry9+1o1qNoQKBgQD80varOSWeCkchC7uA
yWCBsFpUI2QbspLgB2cyjHB/amEnx/A27A4NV7F+BJEvytYLSJYoKjU8uELNjbbf
PeH6g8oI02qXAaf0I0FtribVbWWyCwAl+Y53Gi7RN2qkaH+HW+nN8uIew3C5rl+1
WMoiPVs8ROp9lLxAfhED8EncNQKBgQDabZOZBPhhjCwRLsFfQZefvZnqskSkvm/O
bQZTEkKAw4SKPz5iN6WtfGvUbt4kkmRLkUmin7TRrVFevhjm37b/X035m3O1GMjM
nvlk8jmWioIx+e2HeayYEJiHqxDe6nmQeOJcwQ4d3D6taPGFc1Botl6jI6hc+EQW
XMRYaLWt+QKBgHIPv2eKNbVyT5rSDzrQH3EDHg19lgmE7AyUanN8trhVRxXKd05f
+wr7+ECxUMsuCJk4mz3tpO0K+GCCQfG/mncKBBktQJZ2Ec7sJPWVr0F0xH+pxNxd
FXAYaOzMwpj/6CEqT3Yx0OAuLmonCFjpgPAnnES5ls0nUDMMbSLIwpnNAoGBAIAZ
kV1Fd/GlhlaRaCDYU/b/+BuXbwB7GxEiCXqAk/X2NG3rh0eMwSKMfKS6XJdwL1fO
HjQ8m4v4rGb2752/CBCesRk5HNPRdDnk5fhYwoNSOebbX317U0hfO0UdgyhotOCQ
tJiXNBM5Dp0elb6hEUBH7BqbF+tmQnAm+ZOr3RjpAoGAY9trQhYIgecFcuVNekNQ
FRcXIcVCckzJoFWdBnNoXQ0NUPAVpIoELGO5ZieibAN/+PWyLmq/sWlp6/EehbAy
ivrJD01hJoVKSf46rTxH9kyQncCYDZdvHr99JtjlpJoByvdfCANjdOgY7qbN7Cl/
2OlR6WeDHFpEyrO0vLQ8VPA=
-----END PRIVATE KEY-----
`,
};

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: SERVICE_ACCOUNT.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  
  const signInput = header + '.' + payload;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(SERVICE_ACCOUNT.private_key, 'base64url');
  
  const jwt = signInput + '.' + signature;
  
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error('Token error: ' + errText);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function sheetsGet(accessToken, range) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID + '/values/' + encodeURIComponent(range);
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + accessToken },
  });
  if (!res.ok) throw new Error('Sheets GET error: ' + res.status + ' ' + await res.text());
  return await res.json();
}

async function sheetsAppend(accessToken, range, values) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID + '/values/' + encodeURIComponent(range) + ':append?valueInputOption=USER_ENTERED';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error('Sheets APPEND error: ' + res.status + ' ' + await res.text());
  return await res.json();
}

async function main() {
  console.log('=== 恩田 透を売主リストに追加 ===');

  const accessToken = await getAccessToken();
  console.log('Google認証成功');

  // Step 1: 最新の売主番号を取得（B列）
  console.log('\nStep 1: 最新の売主番号を確認...');
  const sellerNumbersData = await sheetsGet(accessToken, "'" + SHEET_NAME + "'!B:B");
  const sellerNumbers = sellerNumbersData.values || [];
  
  let maxNumber = 0;
  for (const row of sellerNumbers) {
    const val = row[0];
    if (val && typeof val === 'string' && /^AA\d+$/.test(val)) {
      const num = parseInt(val.substring(2), 10);
      if (num > maxNumber) maxNumber = num;
    }
  }

  const nextSellerNumber = 'AA' + (maxNumber + 1);
  console.log('  最新の売主番号: AA' + maxNumber);
  console.log('  次の売主番号:', nextSellerNumber);

  // Step 2: ヘッダー行を取得して列位置を確認
  console.log('\nStep 2: ヘッダー行を確認...');
  const headersData = await sheetsGet(accessToken, "'" + SHEET_NAME + "'!A1:FZ1");
  const headers = headersData.values?.[0] || [];
  console.log('  ヘッダー列数:', headers.length);

  const columnIndexes = {};
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).trim();
    if (header.includes('売主番号')) columnIndexes['売主番号'] = i;
    if (header.includes('名前') && header.includes('漢字')) columnIndexes['名前'] = i;
    if (header.includes('電話番号')) columnIndexes['電話番号'] = i;
    if (header.includes('メールアドレス')) columnIndexes['メールアドレス'] = i;
    if (header.includes('物件所在地')) columnIndexes['物件所在地'] = i;
    if (header === 'サイト') columnIndexes['サイト'] = i;
    if (header.includes('反響日付')) columnIndexes['反響日付'] = i;
    if (header.includes('状況（当社）')) columnIndexes['状況（当社）'] = i;
    if (header.includes('査定方法')) columnIndexes['査定方法'] = i;
  }

  console.log('  カラム位置:');
  for (const [key, idx] of Object.entries(columnIndexes)) {
    console.log('    ' + key + ': 列' + idx);
  }

  // Step 3: 恩田 透のデータを作成
  console.log('\nStep 3: 恩田 透のデータを作成...');
  const newRow = new Array(headers.length).fill('');

  if (columnIndexes['売主番号'] !== undefined) newRow[columnIndexes['売主番号']] = nextSellerNumber;
  if (columnIndexes['名前'] !== undefined) newRow[columnIndexes['名前']] = '恩田 透';
  if (columnIndexes['電話番号'] !== undefined) newRow[columnIndexes['電話番号']] = '08072072768';
  if (columnIndexes['物件所在地'] !== undefined) newRow[columnIndexes['物件所在地']] = '福岡県筑紫野市';
  if (columnIndexes['サイト'] !== undefined) newRow[columnIndexes['サイト']] = 'HOME4U';
  if (columnIndexes['反響日付'] !== undefined) newRow[columnIndexes['反響日付']] = '2026/05/21';
  if (columnIndexes['状況（当社）'] !== undefined) newRow[columnIndexes['状況（当社）']] = '追客中';
  if (columnIndexes['査定方法'] !== undefined) newRow[columnIndexes['査定方法']] = '机上査定';

  console.log('  売主番号:', nextSellerNumber);
  console.log('  名前: 恩田 透');
  console.log('  電話番号: 08072072768');
  console.log('  物件所在地: 福岡県筑紫野市');
  console.log('  サイト: HOME4U');
  console.log('  反響日付: 2026/05/21');
  console.log('  状況（当社）: 追客中');

  // Step 4: スプレッドシートに追加
  console.log('\nStep 4: スプレッドシートに追加...');
  const appendRes = await sheetsAppend(accessToken, "'" + SHEET_NAME + "'!A:FZ", [newRow]);
  console.log('  追加完了:', JSON.stringify(appendRes.updates || appendRes));

  // Step 5: 同期トリガーを呼び出し（スプシ→DB）
  console.log('\nStep 5: DB同期をトリガー...');
  try {
    const response = await fetch(BACKEND_URL + '/api/sync/trigger?additionOnly=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CRON_SECRET,
      },
      body: JSON.stringify({}),
    });
    const result = await response.json();
    console.log('  ステータス:', response.status);
    console.log('  結果:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n完了! 恩田 透（' + nextSellerNumber + '）が売主リストに追加されDBに同期されました。');
    } else {
      console.log('\nDB同期でエラー。10分後の自動同期で反映される可能性があります。');
    }
  } catch (error) {
    console.log('  DB同期エラー:', error.message);
    console.log('  スプレッドシートへの追加は完了。10分後の自動同期で反映されます。');
  }

  console.log('\n=== 完了 ===');
}

main().catch(console.error);
