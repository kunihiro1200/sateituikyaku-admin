#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一覧ページの表示速度改善
1. pageDataCache に BUYERS_WITH_STATUS キーを追加
2. BuyerStatusSidebar にフロントエンドキャッシュを追加（3分TTL）
"""

import re

# ========== 1. pageDataCache.ts に BUYERS_WITH_STATUS を追加 ==========
with open('frontend/frontend/src/store/pageDataCache.ts', 'rb') as f:
    content = f.read().decode('utf-8')

old = """  SELLERS_LIST: 'sellers_list',
  SELLER_DETAIL: 'seller_detail', // 売主詳細（一覧→通話モードのプリフェッチ用）
} as const;"""

new = """  SELLERS_LIST: 'sellers_list',
  SELLER_DETAIL: 'seller_detail', // 売主詳細（一覧→通話モードのプリフェッチ用）
  BUYERS_WITH_STATUS: 'buyers_with_status', // 買主ステータス付き全件（BuyerStatusSidebar用）
} as const;"""

content = content.replace(old, new)

with open('frontend/frontend/src/store/pageDataCache.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ pageDataCache.ts updated')

# ========== 2. BuyerStatusSidebar.tsx にキャッシュを追加 ==========
with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# import に pageDataCache を追加
old_import = "import api from '../services/api';"
new_import = """import api from '../services/api';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"""

content = content.replace(old_import, new_import)

# fetchStatusCategories にキャッシュロジックを追加
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

new_fetch = """  // 1回のリクエストでカテゴリ + 全買主データを取得（フロントエンドキャッシュ付き）
  const fetchStatusCategories = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<{
        categories: StatusCategory[];
        buyers: BuyerWithStatus[];
        normalStaffInitials: string[];
      }>(CACHE_KEYS.BUYERS_WITH_STATUS);
      if (cached) {
        const total = cached.categories.reduce((sum, cat) => sum + cat.count, 0);
        setInternalTotalCount(total);
        setCategories(cached.categories.filter((cat) => cat.count > 0));
        setNormalStaffInitials(cached.normalStaffInitials || []);
        if (onBuyersLoaded) {
          onBuyersLoaded(cached.buyers);
        }
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      const res = await api.get('/api/buyers/status-categories-with-buyers');
      const { categories: data, buyers, normalStaffInitials: initials } = res.data as {
        categories: StatusCategory[];
        buyers: BuyerWithStatus[];
        normalStaffInitials: string[];
      };

      // 3分間キャッシュ
      pageDataCache.set(CACHE_KEYS.BUYERS_WITH_STATUS, {
        categories: data,
        buyers,
        normalStaffInitials: initials || [],
      }, 3 * 60 * 1000);

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

content = content.replace(old_fetch, new_fetch)

with open('frontend/frontend/src/components/BuyerStatusSidebar.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ BuyerStatusSidebar.tsx updated')

# ========== 3. BuyersPage.tsx の同期ボタンでキャッシュを無効化 ==========
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

old_sync = """  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      setSidebarLoaded(false);
      setRefetchTrigger(prev => prev + 1);"""

new_sync = """  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_STATS);
      pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS); // 買主ステータスキャッシュも無効化
      // サイドバーキャッシュをリセット
      allBuyersWithStatusRef.current = [];
      setSidebarLoaded(false);
      setRefetchTrigger(prev => prev + 1);"""

content = content.replace(old_sync, new_sync)

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ BuyersPage.tsx updated')
print()
print('完了！変更内容:')
print('  - pageDataCache に BUYERS_WITH_STATUS キーを追加')
print('  - BuyerStatusSidebar に3分TTLのキャッシュを追加')
print('  - BuyersPage の同期ボタンでキャッシュを無効化')
