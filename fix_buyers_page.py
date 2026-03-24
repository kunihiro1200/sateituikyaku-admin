#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPage.tsx: PageNavigation直下の「買主番号」検索バーを削除
BuyerStatusSidebar.tsx: fetchStatusCategoriesにキャッシュを追加
"""

import re

# ===== BuyersPage.tsx の修正 =====
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# PageNavigation直下の「買主番号」検索バーブロックを削除
# 対象: <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: -1 }}> ... </Box>
old_block = """        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: -1 }}>
          <TextField
            size="small"
            placeholder="買主番号"
            value={buyerNumberSearch}
            onChange={(e) => setBuyerNumberSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && buyerNumberSearch.trim()) {
                navigate(`/buyers/${buyerNumberSearch.trim()}`);
              }
            }}
            sx={{ width: 160 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              endAdornment: buyerNumberSearch ? (
                <InputAdornment position="end">
                  <ClearIcon
                    fontSize="small"
                    sx={{ cursor: 'pointer', color: 'text.secondary' }}
                    onClick={() => setBuyerNumberSearch('')}
                  />
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>"""

new_block = ""

if old_block in text:
    text = text.replace(old_block, new_block)
    print("✅ BuyersPage.tsx: 買主番号検索バーを削除しました")
else:
    print("❌ BuyersPage.tsx: 対象ブロックが見つかりませんでした")

# buyerNumberSearch の state 宣言も削除
old_state = "\n  const [buyerNumberSearch, setBuyerNumberSearch] = useState('');\n"
new_state = "\n"
if old_state in text:
    text = text.replace(old_state, new_state)
    print("✅ BuyersPage.tsx: buyerNumberSearch state を削除しました")
else:
    print("⚠️  BuyersPage.tsx: buyerNumberSearch state が見つかりませんでした（既に削除済みかも）")

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ BuyersPage.tsx を保存しました")

# ===== BuyerStatusSidebar.tsx の修正 =====
with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# fetchStatusCategories にキャッシュを追加
old_fetch = """  // 1回のリクエストでカテゴリ + 全買主データを取得
  const fetchStatusCategories = async () => {
    try {
      setLoading(true);

      const res = await api.get('/api/buyers/status-categories-with-buyers');
      const { categories: data, buyers, normalStaffInitials: initials } = res.data as {
        categories: StatusCategory[];
        buyers: BuyerWithStatus[];
        normalStaffInitials: string[];
      };

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
  };"""

new_fetch = """  // 1回のリクエストでカテゴリ + 全買主データを取得（5分キャッシュ）
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
  };"""

if old_fetch in text2:
    text2 = text2.replace(old_fetch, new_fetch)
    print("✅ BuyerStatusSidebar.tsx: キャッシュを追加しました")
else:
    print("❌ BuyerStatusSidebar.tsx: 対象ブロックが見つかりませんでした")

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))

print("✅ BuyerStatusSidebar.tsx を保存しました")
print("\n完了！")
