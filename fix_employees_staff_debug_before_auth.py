with open('backend/src/routes/employees.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# staff-debug エンドポイントを router.use(authenticate) の前に移動
# 現在の staff-debug ブロックを削除
old_staff_debug = """/**
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
});"""

# router.use(authenticate) の前に挿入する位置を探す
insert_before = "// 全てのルートに認証を適用\nrouter.use(authenticate);"

if old_staff_debug in text and insert_before in text:
    # まず既存の staff-debug を削除
    text = text.replace('\n\n' + old_staff_debug, '')
    # router.use(authenticate) の前に挿入
    text = text.replace(
        insert_before,
        old_staff_debug + '\n\n' + insert_before
    )
    with open('backend/src/routes/employees.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('OK: staff-debug を認証前に移動しました')
else:
    if old_staff_debug not in text:
        print('ERROR: staff-debug ブロックが見つかりません')
    if insert_before not in text:
        print('ERROR: router.use(authenticate) が見つかりません')
    # 現在の状態を確認
    for i, line in enumerate(text.split('\n')):
        if 'authenticate' in line or 'staff-debug' in line:
            print(f'Line {i+1}: {line}')
