# -*- coding: utf-8 -*-
# inquiry-urlエンドポイントの列設定を修正
# 査定書作成シートの列構成:
#   B列(index 0) = 日付（反響日付と照合）
#   C列(index 1) = 反響URL（取得対象）
#   E列(index 3) = 物件住所（照合）
# 取得範囲: B:E

with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

old = """/**
 * GET /api/sellers/:id/inquiry-url
 * 査定書作成シートから反響URLを取得
 * 取得範囲: C:G
 *   C列(index 0) = 反響URL
 *   E列(index 2) = 物件住所
 *   G列(index 4) = 反響送付日
 * 照合条件:
 *   G列(反響送付日)の日付部分 = DBの inquiry_date（反響日付）
 *   かつ E列(物件住所) = DBの property_address
 */
router.get('/:id/inquiry-url', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 反響日付（inquiry_date）と物件住所で照合
    const inquiryDate = (seller as any).inquiryDate;
    const propertyAddress = seller.propertyAddress;

    if (!inquiryDate && !propertyAddress) {
      return res.json({ inquiryUrl: null });
    }

    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');

    const SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
    const SHEET_NAME = '査定書作成';

    const client = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await client.authenticate();

    // C列(反響URL), D列, E列(物件住所), F列, G列(反響送付日) を取得
    const sheetsInstance = (client as any).sheets;
    const response = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!C:G`,
    });

    const rows: string[][] = response.data.values || [];

    // 正規化: 空白除去
    const normalize = (s: string) => (s || '').trim();

    // 日付文字列を YYYY/M/D 形式に正規化（時刻は無視）
    const toDateStr = (dt: string) => {
      if (!dt) return '';
      const d = new Date(dt);
      if (isNaN(d.getTime())) {
        // すでに YYYY/M/D 形式の場合はそのまま返す
        return normalize(dt).split(' ')[0];
      }
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    const sellerDateStr = toDateStr(inquiryDate);
    const sellerAddress = normalize(propertyAddress || '');

    console.log(`[inquiry-url] seller inquiry_date: ${inquiryDate} → ${sellerDateStr}`);
    console.log(`[inquiry-url] seller property_address: ${sellerAddress}`);

    let inquiryUrl: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowUrl = normalize(row[0] || '');     // C列(index 0) = 反響URL
      const rowAddress = normalize(row[2] || ''); // E列(index 2) = 物件住所
      const rowDate = normalize(row[4] || '');    // G列(index 4) = 反響送付日

      if (!rowUrl) continue;

      const rowDateStr = toDateStr(rowDate);

      const dateMatch = sellerDateStr && rowDateStr && sellerDateStr === rowDateStr;
      const addressMatch = sellerAddress && rowAddress && sellerAddress === rowAddress;

      if (dateMatch && addressMatch) {
        inquiryUrl = rowUrl;
        console.log(`[inquiry-url] 一致: row ${i + 1}, url: ${rowUrl}`);
        break;
      }
    }

    if (!inquiryUrl) {
      console.log(`[inquiry-url] 一致なし: date=${sellerDateStr}, address=${sellerAddress}`);
    }

    res.json({ inquiryUrl });
  } catch (error) {
    console.error('Get inquiry URL error:', error);
    res.status(500).json({ error: 'Failed to get inquiry URL' });
  }
});"""

new = """/**
 * GET /api/sellers/:id/inquiry-url
 * 査定書作成シートから反響URLを取得
 * 取得範囲: B:E
 *   B列(index 0) = 日付（反響日付と照合）
 *   C列(index 1) = 反響URL（取得対象）
 *   E列(index 3) = 物件住所（照合）
 * 照合条件:
 *   B列(日付)の日付部分 = DBの inquiry_date（反響日付）
 *   かつ E列(物件住所) = DBの property_address
 */
router.get('/:id/inquiry-url', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 反響日付（inquiry_date）と物件住所で照合
    const inquiryDate = (seller as any).inquiryDate;
    const propertyAddress = seller.propertyAddress;

    if (!inquiryDate && !propertyAddress) {
      return res.json({ inquiryUrl: null });
    }

    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');

    const SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
    const SHEET_NAME = '査定書作成';

    const client = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await client.authenticate();

    // B列(日付), C列(反響URL), D列, E列(物件住所) を取得
    const sheetsInstance = (client as any).sheets;
    const response = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B:E`,
    });

    const rows: string[][] = response.data.values || [];

    // 正規化: 空白除去
    const normalize = (s: string) => (s || '').trim();

    // 日付文字列を YYYY/M/D 形式に正規化（時刻は無視）
    const toDateStr = (dt: string | Date) => {
      if (!dt) return '';
      const d = new Date(dt as any);
      if (isNaN(d.getTime())) {
        return normalize(String(dt)).split(' ')[0];
      }
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    const sellerDateStr = toDateStr(inquiryDate);
    const sellerAddress = normalize(propertyAddress || '');

    console.log(`[inquiry-url] seller inquiry_date: ${inquiryDate} → ${sellerDateStr}`);
    console.log(`[inquiry-url] seller property_address: ${sellerAddress}`);

    let inquiryUrl: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowDate = normalize(row[0] || '');    // B列(index 0) = 日付
      const rowUrl = normalize(row[1] || '');     // C列(index 1) = 反響URL
      const rowAddress = normalize(row[3] || ''); // E列(index 3) = 物件住所

      if (!rowUrl) continue;

      const rowDateStr = toDateStr(rowDate);

      const dateMatch = sellerDateStr && rowDateStr && sellerDateStr === rowDateStr;
      const addressMatch = sellerAddress && rowAddress && sellerAddress === rowAddress;

      if (dateMatch && addressMatch) {
        inquiryUrl = rowUrl;
        console.log(`[inquiry-url] 一致: row ${i + 1}, url: ${rowUrl}`);
        break;
      }
    }

    if (!inquiryUrl) {
      console.log(`[inquiry-url] 一致なし: date=${sellerDateStr}, address=${sellerAddress}`);
    }

    res.json({ inquiryUrl });
  } catch (error) {
    console.error('Get inquiry URL error:', error);
    res.status(500).json({ error: 'Failed to get inquiry URL' });
  }
});"""

if old in text:
    text = text.replace(old, new)
    print("✅ 列設定を修正しました（B:E範囲、B=日付、C=URL、E=物件住所）")
else:
    print("❌ 対象ブロックが見つかりません")

result = text.replace('\n', '\r\n')
with open('backend/src/routes/sellers.ts', 'wb') as f:
    f.write(result.encode('utf-8'))

print("完了")
