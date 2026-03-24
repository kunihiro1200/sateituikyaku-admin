#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
売主一覧ページの表示速度改善
1. LIST_SELLERS_CACHE_TTL_MS: 60秒 → 5分
2. CACHE_TTL.SELLER_LIST: 60秒 → 5分
3. activities IN クエリに LIMIT 追加（全件取得を防ぐ）
"""

import re

# ===== 1. SellerService.supabase.ts のキャッシュTTL延長 =====
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# LIST_SELLERS_CACHE_TTL_MS: 60秒 → 5分
old = 'const LIST_SELLERS_CACHE_TTL_MS = 60 * 1000; // 60秒'
new = 'const LIST_SELLERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5分（Vercelコールドスタート対策）'
if old in text:
    text = text.replace(old, new)
    print('✅ LIST_SELLERS_CACHE_TTL_MS: 60秒 → 5分')
else:
    print('⚠️ LIST_SELLERS_CACHE_TTL_MS の変更対象が見つかりません')

# activities IN クエリに LIMIT 追加（listSellers 内）
# 現在: .order('created_at', { ascending: false });
# 変更後: .order('created_at', { ascending: false }).limit(sellerIds.length * 3);
# ただし、_attachLastCalledAt と listSellers の両方に同じパターンがあるので両方修正
old_query = """          const { data: latestCalls } = await this.table('activities')
          .select('seller_id, created_at')
          .in('seller_id', sellerIds)
          .eq('type', 'phone_call')
          .order('created_at', { ascending: false });"""

new_query = """          const { data: latestCalls } = await this.table('activities')
          .select('seller_id, created_at')
          .in('seller_id', sellerIds)
          .eq('type', 'phone_call')
          .order('created_at', { ascending: false })
          .limit(sellerIds.length * 5); // 各売主最大5件分で十分（最新1件のみ使用）"""

count = text.count(old_query)
if count > 0:
    text = text.replace(old_query, new_query)
    print(f'✅ activities IN クエリに LIMIT 追加（{count}箇所）')
else:
    print('⚠️ activities クエリの変更対象が見つかりません')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ SellerService.supabase.ts 更新完了')

# ===== 2. cache.ts の CACHE_TTL.SELLER_LIST 延長 =====
with open('backend/src/utils/cache.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '  SELLER_LIST: 60, // 1分'
new = '  SELLER_LIST: 300, // 5分（Vercelコールドスタート対策）'
if old in text:
    text = text.replace(old, new)
    print('✅ CACHE_TTL.SELLER_LIST: 60秒 → 5分')
else:
    print('⚠️ CACHE_TTL.SELLER_LIST の変更対象が見つかりません')

with open('backend/src/utils/cache.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ cache.ts 更新完了')
print('\n全ての変更が完了しました。')
