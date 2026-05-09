#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
restore-to-sheetエンドポイントをrouter.use(authenticate)より前に移動する。
"""

file_path = r'C:\Users\kunih\sateituikyaku-admin\backend\src\routes\buyers.ts'

with open(file_path, 'rb') as f:
    content = f.read()

if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

text = content.decode('utf-8')

# 移動するブロック（restore-to-sheetエンドポイント全体）
block_to_move = '''
// DBにあってスプレッドシートにない買主を検出してスプシに書き戻す
// POST /api/buyers/restore-to-sheet
// body: { offset?: number, limit?: number, dryRun?: boolean }
// offset/limitでバッチ処理対応（Vercel 60秒タイムアウト回避）
router.post('/restore-to-sheet', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    const batchOffset = parseInt(req.body?.offset ?? '0', 10) || 0;
    const batchLimit = parseInt(req.body?.limit ?? '30', 10) || 30;
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';

    console.log(`[POST /buyers/restore-to-sheet] offset=${batchOffset}, limit=${batchLimit}, dryRun=${dryRun}`);

    // BuyerWriteServiceを初期化
    await (buyerService as any).initSyncServices();
    const writeService = (buyerService as any).writeService as import('../services/BuyerWriteService').BuyerWriteService;
    if (!writeService) {
      return res.status(500).json({ error: 'BuyerWriteService の初期化に失敗しました' });
    }

    // 1. スプレッドシートの全買主番号を取得（E列 = 買主番号）
    const { google } = await import('googleapis');
    const pathMod = await import('path');
    const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
    const sheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

    // サービスアカウント認証（環境変数JSONを優先）
    let authConfig: any;
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
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
    console.log(`[restore-to-sheet] スプレッドシートの買主数: ${sheetBuyerNumbers.size}`);

    // 2. DBのアクティブな全買主を取得
    const supabase = (buyerService as any).supabase;
    const PAGE_SIZE = 1000;
    const allDbBuyers: any[] = [];
    let dbOffset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .is('deleted_at', null)
        .range(dbOffset, dbOffset + PAGE_SIZE - 1);
      if (error) throw new Error(`DB取得エラー: ${error.message}`);
      if (!data || data.length === 0) { hasMore = false; }
      else {
        allDbBuyers.push(...data);
        dbOffset += PAGE_SIZE;
        if (data.length < PAGE_SIZE) hasMore = false;
      }
    }
    console.log(`[restore-to-sheet] DBの買主数: ${allDbBuyers.length}`);

    // 3. スプシにない買主を特定してソート
    const allMissing = allDbBuyers
      .filter(b => b.buyer_number && /^\\d+$/.test(String(b.buyer_number).trim()) && !sheetBuyerNumbers.has(String(b.buyer_number).trim()))
      .sort((a, b) => parseInt(String(a.buyer_number), 10) - parseInt(String(b.buyer_number), 10));

    const totalMissing = allMissing.length;
    console.log(`[restore-to-sheet] スプシに存在しない買主数: ${totalMissing}`);

    // 4. バッチ範囲を切り出す
    const batchBuyers = allMissing.slice(batchOffset, batchOffset + batchLimit);
    const hasNextBatch = batchOffset + batchLimit < totalMissing;

    if (batchBuyers.length === 0) {
      return res.json({
        success: true,
        message: '処理対象なし',
        totalMissing,
        batchOffset,
        batchLimit,
        restored: 0,
        failed: 0,
        hasNextBatch: false,
        nextOffset: null,
      });
    }

    console.log(`[restore-to-sheet] バッチ処理: ${batchBuyers[0].buyer_number} ～ ${batchBuyers[batchBuyers.length-1].buyer_number} (${batchBuyers.length}件)`);

    // 5. スプシに書き戻す
    let restored = 0;
    let failed = 0;
    const errors: Array<{ buyerNumber: string; error: string }> = [];

    if (!dryRun) {
      for (const buyer of batchBuyers) {
        try {
          const result = await writeService.appendNewBuyer(buyer);
          if (result.success) { restored++; }
          else {
            failed++;
            errors.push({ buyerNumber: buyer.buyer_number, error: result.error || 'Unknown' });
          }
        } catch (err: any) {
          failed++;
          errors.push({ buyerNumber: buyer.buyer_number, error: err.message });
        }
      }
    }

    res.json({
      success: true,
      message: dryRun ? `ドライラン: ${batchBuyers.length}件が対象` : `${restored}件をスプレッドシートに書き戻しました`,
      totalMissing,
      batchOffset,
      batchLimit,
      batchSize: batchBuyers.length,
      restored: dryRun ? 0 : restored,
      failed: dryRun ? 0 : failed,
      hasNextBatch,
      nextOffset: hasNextBatch ? batchOffset + batchLimit : null,
      processedBuyerNumbers: batchBuyers.map(b => b.buyer_number),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[POST /buyers/restore-to-sheet] エラー:', error);
    res.status(500).json({ error: error.message });
  }
});'''

# 挿入先: router.use(authenticate) の直前
insert_before = '''// 全てのルートに認証を適用（sidebar-countsの後、PUT /:id の後に配置）
router.use(authenticate);'''

if block_to_move not in text:
    print('ERROR: 移動するブロックが見つかりません')
    import sys; sys.exit(1)

if insert_before not in text:
    print('ERROR: 挿入先が見つかりません')
    import sys; sys.exit(1)

# 1. 元の位置から削除
text = text.replace(block_to_move, '')

# 2. router.use(authenticate)の直前に挿入
text = text.replace(insert_before, block_to_move + '\n\n' + insert_before)

print('SUCCESS: restore-to-sheetをrouter.use(authenticate)より前に移動しました')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('保存完了')
with open(file_path, 'rb') as f:
    check = f.read()
print('BOMチェック:', repr(check[:3]))
