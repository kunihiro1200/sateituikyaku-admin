#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
getSeller の Redis キャッシュをモジュールレベルのインメモリキャッシュに変更する。
Redis await を排除して getSeller のレスポンスを高速化する。
"""

file_path = 'backend/src/services/SellerService.supabase.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# モジュールレベルのインメモリキャッシュ定義を追加（getInitialsMap の後に追加）
old_getinitialsmap_end = '''/**
 * イニシャルマップを取得（キャッシュ有効期限チェック付き）
 * キャッシュが古い場合はバックグラウンドで更新（stale-while-revalidate）
 */
function getInitialsMap(): Record<string, string> {
  const now = Date.now();
  if (_employeeInitialsMap && (now - _employeeInitialsCachedAt) < EMPLOYEE_INITIALS_CACHE_TTL_MS) {
    return _employeeInitialsMap;
  }
  // キャッシュが古い or 未初期化 → バックグラウンドで更新（今回は古いデータを返す）
  refreshEmployeeCache().catch(console.error);
  return _employeeInitialsMap || {};
}'''

new_getinitialsmap_end = '''/**
 * イニシャルマップを取得（キャッシュ有効期限チェック付き）
 * キャッシュが古い場合はバックグラウンドで更新（stale-while-revalidate）
 */
function getInitialsMap(): Record<string, string> {
  const now = Date.now();
  if (_employeeInitialsMap && (now - _employeeInitialsCachedAt) < EMPLOYEE_INITIALS_CACHE_TTL_MS) {
    return _employeeInitialsMap;
  }
  // キャッシュが古い or 未初期化 → バックグラウンドで更新（今回は古いデータを返す）
  refreshEmployeeCache().catch(console.error);
  return _employeeInitialsMap || {};
}

// getSeller 用インメモリキャッシュ（30秒TTL）
const _sellerCache = new Map<string, { data: any; expiresAt: number }>();
const SELLER_CACHE_TTL_MS = 30 * 1000; // 30秒

function getSellerCache(sellerId: string): any | null {
  const entry = _sellerCache.get(sellerId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _sellerCache.delete(sellerId);
    return null;
  }
  return entry.data;
}

function setSellerCache(sellerId: string, data: any): void {
  _sellerCache.set(sellerId, { data, expiresAt: Date.now() + SELLER_CACHE_TTL_MS });
}

function invalidateSellerCache(sellerId: string): void {
  _sellerCache.delete(sellerId);
}'''

if old_getinitialsmap_end in text:
    text = text.replace(old_getinitialsmap_end, new_getinitialsmap_end)
    print('✅ getSeller 用インメモリキャッシュ定義を追加しました')
else:
    print('❌ getInitialsMap の末尾が見つかりません')
    idx = text.find('getInitialsMap')
    if idx >= 0:
        print(repr(text[idx:idx+400]))
    import sys
    sys.exit(1)

# getSeller の Redis キャッシュ読み取りをインメモリに変更
old_getseller_read = '''    // キャッシュをチェック（includeDeletedがfalseの場合のみキャッシュを使用）
    if (!includeDeleted) {
      const cacheKey = CacheHelper.generateKey('seller', sellerId);
      const cached = await CacheHelper.get<Seller>(cacheKey);
      if (cached) {
        console.log(`[PERF] getSeller cache hit: ${Date.now() - _t0}ms`);
        return cached;
      }
    }
    console.log(`[PERF] getSeller cache miss: ${Date.now() - _t0}ms`);'''

new_getseller_read = '''    // インメモリキャッシュをチェック（Redis await を排除）
    if (!includeDeleted) {
      const cached = getSellerCache(sellerId);
      if (cached) {
        console.log(`[PERF] getSeller cache hit (in-memory): ${Date.now() - _t0}ms`);
        return cached;
      }
    }
    console.log(`[PERF] getSeller cache miss: ${Date.now() - _t0}ms`);'''

if old_getseller_read in text:
    text = text.replace(old_getseller_read, new_getseller_read)
    print('✅ getSeller キャッシュ読み取りをインメモリに変更しました')
else:
    print('❌ getSeller キャッシュ読み取りが見つかりません')
    import sys
    sys.exit(1)

# getSeller の Redis キャッシュ書き込みをインメモリに変更
old_getseller_write = '''    // キャッシュに保存（30秒TTL）
    if (!includeDeleted) {
      const cacheKey = CacheHelper.generateKey('seller', sellerId);
      await CacheHelper.set(cacheKey, decryptedSeller, 30);
    }'''

new_getseller_write = '''    // インメモリキャッシュに保存（30秒TTL、Redis await を排除）
    if (!includeDeleted) {
      setSellerCache(sellerId, decryptedSeller);
    }'''

if old_getseller_write in text:
    text = text.replace(old_getseller_write, new_getseller_write)
    print('✅ getSeller キャッシュ書き込みをインメモリに変更しました')
else:
    print('❌ getSeller キャッシュ書き込みが見つかりません')
    import sys
    sys.exit(1)

# updateSeller でキャッシュを無効化する処理を追加
# updateSeller の return 直前を探す
old_update_return = '''    // 更新後の売主情報を取得して返す
    const updatedSeller = await this.getSeller(sellerId);
    if (!updatedSeller) {
      throw new Error('Failed to retrieve updated seller');
    }
    return updatedSeller;
  }'''

new_update_return = '''    // キャッシュを無効化（更新後は最新データを取得させる）
    invalidateSellerCache(sellerId);

    // 更新後の売主情報を取得して返す
    const updatedSeller = await this.getSeller(sellerId);
    if (!updatedSeller) {
      throw new Error('Failed to retrieve updated seller');
    }
    return updatedSeller;
  }'''

if old_update_return in text:
    text = text.replace(old_update_return, new_update_return)
    print('✅ updateSeller にキャッシュ無効化を追加しました')
else:
    print('⚠️ updateSeller の return 部分が見つかりません（スキップ）')

# CRLF に戻す
text = text.replace('\n', '\r\n')

with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
