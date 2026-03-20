# -*- coding: utf-8 -*-
"""sellers.ts (CRLF) の duplicates エンドポイントにキャッシュを追加"""

def patch(filepath, old_lf, new_lf, label):
    with open(filepath, 'rb') as f:
        raw = f.read()
    # CRLF → LF に正規化して検索・置換
    text = raw.decode('utf-8').replace('\r\n', '\n')
    if old_lf not in text:
        print(f'[SKIP] {label}: pattern not found')
        return False
    text = text.replace(old_lf, new_lf, 1)
    # LF → CRLF に戻して書き込み
    with open(filepath, 'wb') as f:
        f.write(text.replace('\n', '\r\n').encode('utf-8'))
    print(f'[OK] {label}')
    return True

SELLERS_TS = 'backend/src/routes/sellers.ts'

# 1. キャッシュ変数をファイル先頭（router定義の直後）に追加
patch(
    SELLERS_TS,
    'const router = Router();\nconst sellerService = new SellerService();\n\n// 全てのルートに認証を適用\nrouter.use(authenticate);',
    'const router = Router();\nconst sellerService = new SellerService();\n\n// duplicates インメモリキャッシュ（TTL: 60秒）\nconst duplicatesCache = new Map<string, { data: any[]; expiresAt: number }>();\nconst DUPLICATES_CACHE_TTL_MS = 60 * 1000;\n\nfunction getDuplicatesCache(sellerId: string): any[] | null {\n  const entry = duplicatesCache.get(sellerId);\n  if (!entry) return null;\n  if (Date.now() > entry.expiresAt) {\n    duplicatesCache.delete(sellerId);\n    return null;\n  }\n  return entry.data;\n}\n\nfunction setDuplicatesCache(sellerId: string, data: any[]): void {\n  duplicatesCache.set(sellerId, { data, expiresAt: Date.now() + DUPLICATES_CACHE_TTL_MS });\n}\n\nfunction invalidateDuplicatesCache(sellerId: string): void {\n  duplicatesCache.delete(sellerId);\n}\n\n// 全てのルートに認証を適用\nrouter.use(authenticate);',
    'sellers.ts - cache vars'
)

# 2. duplicates エンドポイントにキャッシュ読み込みを追加
patch(
    SELLERS_TS,
    "router.get('/:id/duplicates', async (req: Request, res: Response) => {\n  try {\n    const { id } = req.params;\n    \n    // 売主情報を取得\n    const seller = await sellerService.getSeller(id);",
    "router.get('/:id/duplicates', async (req: Request, res: Response) => {\n  try {\n    const { id } = req.params;\n\n    // キャッシュ確認（60秒TTL）\n    const cached = getDuplicatesCache(id);\n    if (cached) {\n      return res.json({ duplicates: cached });\n    }\n\n    // 売主情報を取得\n    const seller = await sellerService.getSeller(id);",
    'sellers.ts - cache read'
)

# 3. duplicates 結果をキャッシュに保存
patch(
    SELLERS_TS,
    "    res.json({ duplicates });\n  } catch (error) {\n    console.error('Get duplicates error:', error);",
    "    setDuplicatesCache(id, duplicates);\n    res.json({ duplicates });\n  } catch (error) {\n    console.error('Get duplicates error:', error);",
    'sellers.ts - cache write'
)

# 4. updateSeller 時にキャッシュ無効化
patch(
    SELLERS_TS,
    '      // 通常の更新\n      const seller = await sellerService.updateSeller(req.params.id, req.body);\n      res.json(seller);',
    '      // 通常の更新\n      const seller = await sellerService.updateSeller(req.params.id, req.body);\n      invalidateDuplicatesCache(req.params.id);\n      res.json(seller);',
    'sellers.ts - invalidate on update'
)

print('完了')
