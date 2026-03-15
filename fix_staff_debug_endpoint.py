#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
employees.ts にスタッフスプレッドシートのヘッダー確認用デバッグエンドポイントを追加
GET /api/employees/staff-debug
"""

with open('backend/src/routes/employees.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# jimu-initials エンドポイントの後にデバッグエンドポイントを追加
old_after_jimu = """/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {"""
new_after_jimu = """/**
 * スタッフスプレッドシートのヘッダー確認用デバッグエンドポイント
 * GET /api/employees/staff-debug
 */
router.get('/staff-debug', async (req: Request, res: Response) => {
  try {
    const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
    const client = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: 'スタッフ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    const rows = await client.readAll();
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const sampleRows = rows.slice(0, 5).map((row: any) => ({
      イニシャル: row['イニシャル'],
      姓名: row['姓名'],
      電話番号: row['電話番号'],
      固定休: row['固定休'],
      メアド: row['メアド'],
      有効: row['有効'],
      事務あり: row['事務あり'],
      allKeys: Object.keys(row),
    }));
    res.json({ headers, sampleRows, totalRows: rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 全従業員の一覧とカレンダー接続状態を取得
 */
router.get('/', async (req: Request, res: Response) => {"""
text = text.replace(old_after_jimu, new_after_jimu)

with open('backend/src/routes/employees.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('employees.ts にデバッグエンドポイントを追加しました')
print('GET /api/employees/staff-debug でスプレッドシートのヘッダーを確認できます')
