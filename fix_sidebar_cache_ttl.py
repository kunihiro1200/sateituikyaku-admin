#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
getSidebarCounts のキャッシュTTLを60秒から600秒（10分）に延長する
"""

# 1. cache.ts に SIDEBAR_COUNTS 定数を追加
with open('backend/src/utils/cache.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "  SELLER_LIST: 60, // 1\u5206\r\n  SELLER_DETAIL: 300, // 5\u5206\r\n  VALUATION: 600, // 10\u5206\r\n  STATISTICS: 300, // 5\u5206\r\n  SESSION: 86400, // 24\u6642\u9593\r\n};"
new = "  SELLER_LIST: 60, // 1\u5206\r\n  SELLER_DETAIL: 300, // 5\u5206\r\n  VALUATION: 600, // 10\u5206\r\n  STATISTICS: 300, // 5\u5206\r\n  SESSION: 86400, // 24\u6642\u9593\r\n  SIDEBAR_COUNTS: 600, // 10\u5206\uff08\u30b5\u30a4\u30c9\u30d0\u30fc\u30ab\u30a6\u30f3\u30c8\u7528\uff09\r\n};"

if old in text:
    text = text.replace(old, new)
    with open('backend/src/utils/cache.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('cache.ts: SIDEBAR_COUNTS 定数を追加しました')
else:
    print('cache.ts: 対象文字列が見つかりませんでした')
    # デバッグ
    idx = text.find('SESSION: 86400')
    if idx >= 0:
        print('  周辺:', repr(text[idx:idx+60]))

# 2. SellerService.supabase.ts の getSidebarCounts キャッシュTTLを変更
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# 対象文字列を検索
idx = text2.find('CACHE_TTL.SELLER_LIST')
# getSidebarCounts内の最後のCACHE_TTL.SELLER_LISTを探す（キャッシュ保存部分）
# 複数ある場合は最後のものを置換
positions = []
start = 0
while True:
    pos = text2.find('CACHE_TTL.SELLER_LIST', start)
    if pos == -1:
        break
    positions.append(pos)
    start = pos + 1

print(f'CACHE_TTL.SELLER_LIST の出現箇所: {len(positions)}個')
for p in positions:
    print(f'  位置 {p}: {repr(text2[max(0,p-50):p+50])}')

# getSidebarCounts内のキャッシュ保存部分を置換
old2 = "await CacheHelper.set(sidebarCacheKey, sidebarResult, CACHE_TTL.SELLER_LIST);"
new2 = "await CacheHelper.set(sidebarCacheKey, sidebarResult, CACHE_TTL.SIDEBAR_COUNTS);"

if old2 in text2:
    text2 = text2.replace(old2, new2)
    with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
        f.write(text2.encode('utf-8'))
    print('SellerService.supabase.ts: キャッシュTTLを10分に延長しました')
else:
    print('SellerService.supabase.ts: 対象文字列が見つかりませんでした')
