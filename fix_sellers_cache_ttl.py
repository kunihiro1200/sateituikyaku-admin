#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellersPage.tsx のキャッシュTTLを延長（コールドスタート対策）
- SELLERS_LIST: 3分 → 15分
- SELLERS_SIDEBAR_COUNTS: 5分 → 15分
- sidebar_expanded: 5分 → 15分
- loading 初期値: キャッシュの有無で決定
"""

with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

changes = [
    # SELLERS_SIDEBAR_COUNTS: 5分 → 15分
    (
        "pageDataCache.set(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS, response.data, 5 * 60 * 1000);",
        "pageDataCache.set(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS, response.data, 15 * 60 * 1000);"
    ),
    # sidebar_expanded: 5分 → 15分
    (
        "pageDataCache.set(cacheKey, data, 5 * 60 * 1000);",
        "pageDataCache.set(cacheKey, data, 15 * 60 * 1000);"
    ),
    # SELLERS_LIST バックグラウンド更新: 3分 → 15分
    (
        "pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 3 * 60 * 1000);\n        }).catch((err) => console.error('Background sellers refresh failed:', err));",
        "pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 15 * 60 * 1000);\n        }).catch((err) => console.error('Background sellers refresh failed:', err));"
    ),
    # SELLERS_LIST 初回取得: 3分 → 15分（コメント付き）
    (
        "      // 1分間キャッシュ\n      pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 3 * 60 * 1000);",
        "      // 15分間キャッシュ（コールドスタート対策）\n      pageDataCache.set(cacheKey, { data: response.data.data, total: response.data.total }, 15 * 60 * 1000);"
    ),
]

for old, new in changes:
    if old in text:
        text = text.replace(old, new)
        print(f"✅ 修正: {old[:60]}...")
    else:
        print(f"❌ 見つからない: {old[:60]}...")

# loading の初期値をキャッシュの有無で決定
# 現在: const [loading, setLoading] = useState(true);
# 変更後: キャッシュがあれば false
old_loading = "  const [loading, setLoading] = useState(true);"
# キャッシュキーは params に依存するので、デフォルトパラメータ（page=1, pageSize=50, all）でチェック
new_loading = """  // キャッシュがあれば初期ローディングをスキップ（コールドスタート対策）
  const _defaultCacheKey = `${CACHE_KEYS.SELLERS_LIST}:${JSON.stringify({ page: 1, pageSize: 50, sortBy: 'inquiry_date', sortOrder: 'desc' })}`;
  const [loading, setLoading] = useState(!pageDataCache.get(_defaultCacheKey));"""

if old_loading in text:
    text = text.replace(old_loading, new_loading)
    print("✅ loading 初期値をキャッシュ有無で決定するよう修正")
else:
    print("❌ loading 初期値の行が見つかりません")

# sidebarLoading の初期値もキャッシュの有無で決定
old_sidebar_loading = "  const [sidebarLoading, setSidebarLoading] = useState(true);"
new_sidebar_loading = "  const [sidebarLoading, setSidebarLoading] = useState(!pageDataCache.get(CACHE_KEYS.SELLERS_SIDEBAR_COUNTS));"

if old_sidebar_loading in text:
    text = text.replace(old_sidebar_loading, new_sidebar_loading)
    print("✅ sidebarLoading 初期値をキャッシュ有無で決定するよう修正")
else:
    print("❌ sidebarLoading 初期値の行が見つかりません")

with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ SellersPage.tsx を保存しました")

# 確認
with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

checks = [
    ("15 * 60 * 1000", "15分キャッシュ"),
    ("_defaultCacheKey", "loading 初期値のキャッシュチェック"),
    ("SELLERS_SIDEBAR_COUNTS", "sidebarLoading キャッシュチェック"),
]
for key, label in checks:
    count = verify.count(key)
    print(f"{'✅' if count > 0 else '❌'} {label}: {count}箇所")
