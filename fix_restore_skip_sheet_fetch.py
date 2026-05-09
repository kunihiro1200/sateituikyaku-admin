#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
restore-to-sheetエンドポイントを修正:
- sheetBuyerNumbersをリクエストボディで受け取れるようにする
- スプシのE列取得をスキップして、DBクエリ+appendRowだけ行う
"""

file_path = r'C:\Users\kunih\sateituikyaku-admin\backend\src\routes\buyers.ts'

with open(file_path, 'rb') as f:
    content = f.read()

if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

text = content.decode('utf-8')

# restore-to-sheetエンドポイントのスプシ取得部分を修正
# sheetBuyerNumbersをリクエストボディで受け取れるようにする

old_sheet_fetch = '''    // 1. スプレッドシートのE列（買主番号）を取得
    const { google } = await import('googleapis');
    const pathMod = await import('path');
    const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
    const sheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let authConfig: any;
    if (saJson) {
      try {
        const creds = JSON.parse(saJson);
        authConfig = { credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
      } catch {
        authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
      }
    } else {
      authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
    }
    const auth = new google.auth.GoogleAuth(authConfig);
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!E:E`,
    });
    const sheetValues = sheetResponse.data.values || [];
    const sheetBuyerNumbers = new Set<string>(
      sheetValues.slice(1)
        .map((row: any[]) => String(row[0] || '').trim())
        .filter((v: string) => v && /^\\d+$/.test(v))
    );
    console.log(`[restore-to-sheet] スプレッドシートの買主数: ${sheetBuyerNumbers.size}`);'''

new_sheet_fetch = '''    // 1. スプレッドシートの買主番号を取得
    // knownSheetNumbersがリクエストで渡された場合はそれを使用（スプシ取得をスキップ）
    // 渡されない場合はスプシから取得
    let sheetBuyerNumbers: Set<string>;
    const knownSheetNumbers: string[] | undefined = req.body?.knownSheetNumbers;

    if (knownSheetNumbers && Array.isArray(knownSheetNumbers) && knownSheetNumbers.length > 0) {
      sheetBuyerNumbers = new Set<string>(knownSheetNumbers.map(String));
      console.log(`[restore-to-sheet] knownSheetNumbers使用: ${sheetBuyerNumbers.size}件`);
    } else {
      const { google } = await import('googleapis');
      const pathMod = await import('path');
      const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
      const sheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

      const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      let authConfig: any;
      if (saJson) {
        try {
          const creds = JSON.parse(saJson);
          authConfig = { credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
        } catch {
          authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
        }
      } else {
        authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
      }
      const auth = new google.auth.GoogleAuth(authConfig);
      const sheets = google.sheets({ version: 'v4', auth });

      const sheetResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!E:E`,
      });
      const sheetValues = sheetResponse.data.values || [];
      sheetBuyerNumbers = new Set<string>(
        sheetValues.slice(1)
          .map((row: any[]) => String(row[0] || '').trim())
          .filter((v: string) => v && /^\\d+$/.test(v))
      );
      console.log(`[restore-to-sheet] スプレッドシートから取得: ${sheetBuyerNumbers.size}件`);
    }'''

if old_sheet_fetch in text:
    text = text.replace(old_sheet_fetch, new_sheet_fetch)
    print('SUCCESS: restore-to-sheetをknownSheetNumbers対応に修正しました')
else:
    print('ERROR: 対象が見つかりません')
    # デバッグ: 現在のrestore-to-sheetの内容を確認
    idx = text.find('restore-to-sheet')
    if idx != -1:
        print('restore-to-sheet周辺:')
        print(repr(text[idx:idx+200]))
    import sys; sys.exit(1)

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('保存完了')
with open(file_path, 'rb') as f:
    check = f.read()
print('BOMチェック:', repr(check[:3]))
