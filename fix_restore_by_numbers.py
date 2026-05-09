#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
restore-to-sheetエンドポイントを「買主番号リスト直接指定」方式に修正する。
スプシ取得もDB全件取得も不要。指定された買主番号のDBデータをappendRowするだけ。
"""

file_path = r'C:\Users\kunih\sateituikyaku-admin\backend\src\routes\buyers.ts'

with open(file_path, 'rb') as f:
    content = f.read()

if content[:3] == b'\xef\xbb\xbf':
    content = content[3:]

text = content.decode('utf-8')

# 古いrestore-to-sheetエンドポイントを探して置き換え
# まず現在のエンドポイントの開始を見つける
start_marker = "// DBにあってスプレッドシートにない買主を検出してスプシに書き戻す\n// POST /api/buyers/restore-to-sheet"
end_marker = "// スプシのE列（買主番号）一覧を返す軽量エンドポイント"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f'ERROR: start_idx={start_idx}, end_idx={end_idx}')
    import sys; sys.exit(1)

old_endpoint = text[start_idx:end_idx]
print(f'置き換え対象: {len(old_endpoint)}文字')

new_endpoint = '''// DBにあってスプレッドシートにない買主を検出してスプシに書き戻す
// POST /api/buyers/restore-to-sheet
// body: { buyerNumbers: string[], dryRun?: boolean }
// 書き戻すべき買主番号リストを直接指定（スプシ取得・DB全件取得不要）
router.post('/restore-to-sheet', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    const buyerNumbers: string[] = req.body?.buyerNumbers || [];
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';

    console.log(`[POST /buyers/restore-to-sheet] buyerNumbers=${buyerNumbers.length}件, dryRun=${dryRun}`);

    if (buyerNumbers.length === 0) {
      return res.json({ success: true, message: '処理対象なし', batchSize: 0, restored: 0, failed: 0 });
    }

    // BuyerWriteServiceを初期化
    await (buyerService as any).initSyncServices();
    const writeService = (buyerService as any).writeService as import('../services/BuyerWriteService').BuyerWriteService;
    if (!writeService) {
      return res.status(500).json({ error: 'BuyerWriteService の初期化に失敗しました' });
    }

    // 指定された買主番号のDBデータを取得
    const supabase = (buyerService as any).supabase;
    const { data: buyers, error: dbError } = await supabase
      .from('buyers')
      .select('*')
      .is('deleted_at', null)
      .in('buyer_number', buyerNumbers);

    if (dbError) throw new Error(`DB取得エラー: ${dbError.message}`);
    console.log(`[restore-to-sheet] DB取得: ${(buyers || []).length}件`);

    if (!buyers || buyers.length === 0 || dryRun) {
      return res.json({
        success: true,
        message: dryRun ? `ドライラン: ${(buyers || []).length}件が対象` : '処理対象なし',
        batchSize: (buyers || []).length,
        restored: 0,
        failed: 0,
      });
    }

    // スプシに書き戻す
    let restored = 0;
    let failed = 0;
    const errors: Array<{ buyerNumber: string; error: string }> = [];

    for (const buyer of buyers) {
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

    console.log(`[restore-to-sheet] 完了: 成功=${restored}, 失敗=${failed}`);

    res.json({
      success: true,
      message: `${restored}件をスプレッドシートに書き戻しました`,
      batchSize: buyers.length,
      restored,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[POST /buyers/restore-to-sheet] エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

'''

text = text[:start_idx] + new_endpoint + text[end_idx:]
print('SUCCESS: restore-to-sheetを買主番号リスト直接指定方式に修正しました')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('保存完了')
with open(file_path, 'rb') as f:
    check = f.read()
print('BOMチェック:', repr(check[:3]))
