#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
スプシのE列（買主番号）だけを返す軽量エンドポイントを追加する。
"""

file_path = r'C:\Users\kunih\sateituikyaku-admin\backend\src\routes\buyers.ts'

with open(file_path, 'rb') as f:
    content = f.read()

if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

text = content.decode('utf-8')

new_endpoint = '''
// スプシのE列（買主番号）一覧を返す軽量エンドポイント
// POST /api/buyers/get-sheet-buyer-numbers
router.post('/get-sheet-buyer-numbers', authenticateOrApiKey, async (_req: Request, res: Response) => {
  try {
    const { google } = await import('googleapis');
    const pathMod = await import('path');
    const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
    const sheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let authConfig: any;
    if (saJson) {
      try {
        const creds = JSON.parse(saJson);
        authConfig = { credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
      } catch {
        authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
      }
    } else {
      authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    }
    const auth = new google.auth.GoogleAuth(authConfig);
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!E:E`,
    });
    const sheetValues = sheetResponse.data.values || [];
    const buyerNumbers = sheetValues.slice(1)
      .map((row: any[]) => String(row[0] || '').trim())
      .filter((v: string) => v && /^\\d+$/.test(v));

    res.json({ success: true, buyerNumbers, count: buyerNumbers.length });
  } catch (error: any) {
    console.error('[POST /buyers/get-sheet-buyer-numbers] エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

'''

# router.use(authenticate)の直前に挿入
insert_before = '// 全てのルートに認証を適用（sidebar-countsの後、PUT /:id の後に配置）\nrouter.use(authenticate);'

if insert_before in text:
    text = text.replace(insert_before, new_endpoint + insert_before)
    print('SUCCESS: get-sheet-buyer-numbersエンドポイントを追加しました')
else:
    print('ERROR: 挿入位置が見つかりません')
    import sys; sys.exit(1)

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('保存完了')
with open(file_path, 'rb') as f:
    check = f.read()
print('BOMチェック:', repr(check[:3]))
