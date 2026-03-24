#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerStatusSidebar.tsx: fetchStatusCategoriesにキャッシュを追加
"""

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    raw = f.read()

# 改行コードを統一して処理
text = raw.decode('utf-8').replace('\r\n', '\n')

# キャッシュなしの古いfetch関数を検索
marker_start = "  // 1回のリクエストでカテゴリ + 全買主データを取得\n  const fetchStatusCategories = async () => {"
marker_end = "  };\n\n  const handleStatusClick"

if marker_start not in text:
    print("❌ 開始マーカーが見つかりません")
    exit(1)

if marker_end not in text:
    print("❌ 終了マーカーが見つかりません")
    exit(1)

# 古いブロックを新しいブロックに置換
idx_start = text.index(marker_start)
idx_end = text.index(marker_end) + len("  };\n")

old_block = text[idx_start:idx_end]
print(f"置換対象ブロック（{len(old_block)}文字）を検出しました")

new_block = """  // 1回のリクエストでカテゴリ + 全買主データを取得（5分キャッシュ）
  const fetchStatusCategories = async () => {
    try {
      setLoading(true);

      // キャッシュチェック
      const cached = pageDataCache.get<{
        categories: StatusCategory[];
        buyers: BuyerWithStatus[];
        normalStaffInitials: string[];
      }>(CACHE_KEYS.BUYERS_WITH_STATUS);

      let data: StatusCategory[];
      let buyers: BuyerWithStatus[];
      let initials: string[];

      if (cached) {
        data = cached.categories;
        buyers = cached.buyers;
        initials = cached.normalStaffInitials;
      } else {
        const res = await api.get('/api/buyers/status-categories-with-buyers');
        const result = res.data as {
          categories: StatusCategory[];
          buyers: BuyerWithStatus[];
          normalStaffInitials: string[];
        };
        data = result.categories;
        buyers = result.buyers;
        initials = result.normalStaffInitials;

        // 5分間キャッシュ
        pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, result, 5 * 60 * 1000);
      }

      const total = data.reduce((sum: number, cat: StatusCategory) => sum + cat.count, 0);
      setInternalTotalCount(total);
      setCategories(data.filter((cat: StatusCategory) => cat.count > 0));
      setNormalStaffInitials(initials || []);

      if (onBuyersLoaded) {
        onBuyersLoaded(buyers);
      }
    } catch (error) {
      console.error('Failed to fetch status categories:', error);
    } finally {
      setLoading(false);
    }
  };
"""

text = text[:idx_start] + new_block + text[idx_end:]

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ BuyerStatusSidebar.tsx: キャッシュを追加しました")
