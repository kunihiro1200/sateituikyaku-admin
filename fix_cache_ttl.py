#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
キャッシュTTL改善
1. 売主リスト: 1分 → 3分
2. 物件リスト: 3分 → 5分
3. 売主サイドバーカウント: 3分 → 5分
4. 売主担当者イニシャル: 3分 → 10分（ほぼ変わらないデータ）
"""

# ========== 1. SellersPage.tsx のキャッシュTTL改善 ==========
with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 売主リスト本体: 1分 → 3分
content = content.replace(
    "pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 60 * 1000);",
    "pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 3 * 60 * 1000);"
)

# サイドバーカウント: デフォルト3分 → 5分
content = content.replace(
    "pageDataCache.set(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS, response.data);",
    "pageDataCache.set(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS, response.data, 5 * 60 * 1000);"
)

# 担当者イニシャル: デフォルト3分 → 10分
content = content.replace(
    "pageDataCache.set(CACHE_KEYS.SELLERS_ASSIGNEE_INITIALS, initials);",
    "pageDataCache.set(CACHE_KEYS.SELLERS_ASSIGNEE_INITIALS, initials, 10 * 60 * 1000);"
)

with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ SellersPage.tsx キャッシュTTL更新')

# ========== 2. PropertyListingsPage.tsx のキャッシュTTL改善 ==========
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 物件リスト: デフォルト3分 → 5分
content = content.replace(
    "// キャッシュに保存（3分間有効）\n      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData);",
    "// キャッシュに保存（5分間有効）\n      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData, 5 * 60 * 1000);"
)

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ PropertyListingsPage.tsx キャッシュTTL更新')
print()
print('変更内容:')
print('  - 売主リスト本体: 1分 → 3分')
print('  - 売主サイドバーカウント: 3分 → 5分')
print('  - 売主担当者イニシャル: 3分 → 10分')
print('  - 物件リスト: 3分 → 5分')
