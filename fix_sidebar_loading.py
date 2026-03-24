#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerStatusSidebar.tsx:
- キャッシュヒット時は setLoading(true) をスキップして即座に表示
- BuyersPage.tsx: sidebarLoaded の初期値をキャッシュ有無で決定し、
  キャッシュがあれば最初から allBuyersWithStatusRef にデータを入れておく
"""

# ===== BuyerStatusSidebar.tsx =====
with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    raw = f.read()
text = raw.decode('utf-8').replace('\r\n', '\n')

# キャッシュヒット時は loading を true にしない
old_fetch = """  // 1回のリクエストでカテゴリ + 全買主データを取得（5分キャッシュ）
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

new_fetch = """  // 1回のリクエストでカテゴリ + 全買主データを取得（5分キャッシュ）
  const fetchStatusCategories = async () => {
    // キャッシュチェック（先に確認してloadingをスキップ）
    const cached = pageDataCache.get<{
      categories: StatusCategory[];
      buyers: BuyerWithStatus[];
      normalStaffInitials: string[];
    }>(CACHE_KEYS.BUYERS_WITH_STATUS);

    if (cached) {
      // キャッシュヒット：loadingなしで即座に反映
      const total = cached.categories.reduce((sum: number, cat: StatusCategory) => sum + cat.count, 0);
      setInternalTotalCount(total);
      setCategories(cached.categories.filter((cat: StatusCategory) => cat.count > 0));
      setNormalStaffInitials(cached.normalStaffInitials || []);
      setLoading(false);
      if (onBuyersLoaded) {
        onBuyersLoaded(cached.buyers);
      }
      return;
    }

    // キャッシュなし：APIから取得
    try {
      setLoading(true);

      const res = await api.get('/api/buyers/status-categories-with-buyers');
      const result = res.data as {
        categories: StatusCategory[];
        buyers: BuyerWithStatus[];
        normalStaffInitials: string[];
      };

      // 5分間キャッシュ
      pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, result, 5 * 60 * 1000);

      const total = result.categories.reduce((sum: number, cat: StatusCategory) => sum + cat.count, 0);
      setInternalTotalCount(total);
      setCategories(result.categories.filter((cat: StatusCategory) => cat.count > 0));
      setNormalStaffInitials(result.normalStaffInitials || []);

      if (onBuyersLoaded) {
        onBuyersLoaded(result.buyers);
      }
    } catch (error) {
      console.error('Failed to fetch status categories:', error);
    } finally {
      setLoading(false);
    }
  };"""

if old_fetch in text:
    text = text.replace(old_fetch, new_fetch)
    print("✅ BuyerStatusSidebar.tsx: キャッシュヒット時のloading最適化")
else:
    print("❌ BuyerStatusSidebar.tsx: 対象ブロックが見つかりません")

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print("✅ BuyerStatusSidebar.tsx 保存完了")

# ===== BuyersPage.tsx: 初期状態をキャッシュから復元 =====
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    raw2 = f.read()
text2 = raw2.decode('utf-8').replace('\r\n', '\n')

# sidebarLoaded の初期値をキャッシュ有無で決定
old_init = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>([]);
  const [sidebarLoaded, setSidebarLoaded] = useState(false);"""

new_init = """  // サイドバーから取得した全買主データ（フロントキャッシュ）
  // 初期値：pageDataCacheにキャッシュがあれば即座にロード済みとして扱う
  const cachedData = pageDataCache.get<{ categories: any[]; buyers: BuyerWithStatus[]; normalStaffInitials: string[] }>(CACHE_KEYS.BUYERS_WITH_STATUS);
  const allBuyersWithStatusRef = useRef<BuyerWithStatus[]>(cachedData?.buyers ?? []);
  const [sidebarLoaded, setSidebarLoaded] = useState(!!cachedData);"""

if old_init in text2:
    text2 = text2.replace(old_init, new_init)
    print("✅ BuyersPage.tsx: 初期状態をキャッシュから復元")
else:
    print("❌ BuyersPage.tsx: 対象ブロックが見つかりません")

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))
print("✅ BuyersPage.tsx 保存完了")
