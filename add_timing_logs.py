#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/api/sellers/:id ルートにタイムスタンプログを追加して
どのステップがボトルネックか特定する
"""

import re

filepath = 'backend/src/routes/sellers.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# GET /:id ルートにタイムスタンプログを追加
old = """/**
 * 売主情報を取得
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const seller = await sellerService.getSeller(req.params.id);

    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }

    res.json(seller);
  } catch (error) {
    console.error('Get seller error:', error);
    res.status(500).json({
      error: {
        code: 'GET_SELLER_ERROR',
        message: 'Failed to get seller',
        retryable: true,
      },
    });
  }
});"""

new = """/**
 * 売主情報を取得
 */
router.get('/:id', async (req: Request, res: Response) => {
  const t0 = Date.now();
  console.log(`[PERF] GET /api/sellers/${req.params.id} start`);
  try {
    const seller = await sellerService.getSeller(req.params.id);
    const t1 = Date.now();
    console.log(`[PERF] getSeller done: ${t1 - t0}ms`);

    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }

    res.json(seller);
    console.log(`[PERF] GET /api/sellers/${req.params.id} total: ${Date.now() - t0}ms`);
  } catch (error) {
    console.error('Get seller error:', error);
    res.status(500).json({
      error: {
        code: 'GET_SELLER_ERROR',
        message: 'Failed to get seller',
        retryable: true,
      },
    });
  }
});"""

if old in text:
    text = text.replace(old, new)
    print('✅ GET /:id にタイムスタンプログを追加しました')
else:
    print('❌ 対象箇所が見つかりません')
    import sys
    sys.exit(1)

# getSeller メソッドにも詳細ログを追加
old2 = """  async getSeller(sellerId: string, includeDeleted: boolean = false): Promise<Seller | null> {
    // キャッシュをチェック（includeDeletedがfalseの場合のみキャッシュを使用）
    if (!includeDeleted) {
      const cacheKey = CacheHelper.generateKey('seller', sellerId);
      const cached = await CacheHelper.get<Seller>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 売主情報を取得
    let query = this.table('sellers')
      .select('*')
      .eq('id', sellerId);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data: seller, error: sellerError } = await query.single();

    if (sellerError || !seller) {
      return null;
    }

    // 物件情報取得と decryptSeller を並列実行（パフォーマンス改善）
    const [{ data: properties, error: propertyError }, decryptedSeller] = await Promise.all([
      this.table('properties')
        .select('*')
        .eq('seller_id', sellerId),
      this.decryptSeller(seller),
    ]);"""

new2 = """  async getSeller(sellerId: string, includeDeleted: boolean = false): Promise<Seller | null> {
    const _t0 = Date.now();
    // キャッシュをチェック（includeDeletedがfalseの場合のみキャッシュを使用）
    if (!includeDeleted) {
      const cacheKey = CacheHelper.generateKey('seller', sellerId);
      const cached = await CacheHelper.get<Seller>(cacheKey);
      if (cached) {
        console.log(`[PERF] getSeller cache hit: ${Date.now() - _t0}ms`);
        return cached;
      }
    }
    console.log(`[PERF] getSeller cache miss: ${Date.now() - _t0}ms`);

    // 売主情報を取得
    let query = this.table('sellers')
      .select('*')
      .eq('id', sellerId);
    
    // デフォルトで削除済みを除外
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data: seller, error: sellerError } = await query.single();
    console.log(`[PERF] getSeller DB query: ${Date.now() - _t0}ms`);

    if (sellerError || !seller) {
      return null;
    }

    // 物件情報取得と decryptSeller を並列実行（パフォーマンス改善）
    const [{ data: properties, error: propertyError }, decryptedSeller] = await Promise.all([
      this.table('properties')
        .select('*')
        .eq('seller_id', sellerId),
      this.decryptSeller(seller),
    ]);
    console.log(`[PERF] getSeller properties+decrypt: ${Date.now() - _t0}ms`);"""

filepath2 = 'backend/src/services/SellerService.supabase.ts'
with open(filepath2, 'rb') as f:
    content2 = f.read()
text2 = content2.decode('utf-8')

if old2 in text2:
    text2 = text2.replace(old2, new2)
    print('✅ getSeller にタイムスタンプログを追加しました')
else:
    print('❌ getSeller の対象箇所が見つかりません')
    import sys
    sys.exit(1)

# decryptSeller にもログを追加
old3 = """  private async decryptSeller(seller: any): Promise<Seller> {
    try {
      // イニシャルをフルネームに変換（並列処理で高速化）
      const [visitAssigneeFullName, visitValuationAcquirerFullName] = await Promise.all([
        getEmployeeNameByInitials(seller.visit_assignee),
        getEmployeeNameByInitials(seller.visit_valuation_acquirer),
      ]);"""

new3 = """  private async decryptSeller(seller: any): Promise<Seller> {
    const _dt0 = Date.now();
    try {
      // イニシャルをフルネームに変換（並列処理で高速化）
      const [visitAssigneeFullName, visitValuationAcquirerFullName] = await Promise.all([
        getEmployeeNameByInitials(seller.visit_assignee),
        getEmployeeNameByInitials(seller.visit_valuation_acquirer),
      ]);
      console.log(`[PERF] decryptSeller getEmployeeNames: ${Date.now() - _dt0}ms`);"""

if old3 in text2:
    text2 = text2.replace(old3, new3)
    print('✅ decryptSeller にタイムスタンプログを追加しました')
else:
    print('❌ decryptSeller の対象箇所が見つかりません')

# ファイルを書き込む
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))
print(f'✅ {filepath} を保存しました')

with open(filepath2, 'wb') as f:
    f.write(text2.encode('utf-8'))
print(f'✅ {filepath2} を保存しました')
