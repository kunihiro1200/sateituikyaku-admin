#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ページデータキャッシュをPropertyListingsPage、WorkTasksPage、SharedItemsPageに適用する
"""

import re

# ===== PropertyListingsPage.tsx =====
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# importにキャッシュを追加
old_import = "import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';"
new_import = """import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"""

content = content.replace(old_import, new_import)

# fetchAllData関数をキャッシュ対応に変更
old_fetch = """  const fetchAllData = async () => {
    try {
      setLoading(true);

      const allListingsData: PropertyListing[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      console.log('物件データを取得中...');

      while (hasMore) {
        const listingsRes = await api.get('/api/property-listings', {
          params: { limit, offset, orderBy: 'distribution_date', orderDirection: 'desc' },
        });

        const fetchedData = listingsRes.data.data || [];
        allListingsData.push(...fetchedData);

        console.log(`取得: ${offset + 1}～${offset + fetchedData.length}件 / 合計${listingsRes.data.total}件`);

        if (fetchedData.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      setAllListings(allListingsData);

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };"""

new_fetch = """  const fetchAllData = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<PropertyListing[]>(CACHE_KEYS.PROPERTY_LISTINGS);
      if (cached) {
        setAllListings(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      const allListingsData: PropertyListing[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      console.log('物件データを取得中...');

      while (hasMore) {
        const listingsRes = await api.get('/api/property-listings', {
          params: { limit, offset, orderBy: 'distribution_date', orderDirection: 'desc' },
        });

        const fetchedData = listingsRes.data.data || [];
        allListingsData.push(...fetchedData);

        console.log(`取得: ${offset + 1}～${offset + fetchedData.length}件 / 合計${listingsRes.data.total}件`);

        if (fetchedData.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      // キャッシュに保存（3分間有効）
      pageDataCache.set(CACHE_KEYS.PROPERTY_LISTINGS, allListingsData);
      setAllListings(allListingsData);

      console.log('✅ データ取得成功:', { 物件数: allListingsData.length });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };"""

content = content.replace(old_fetch, new_fetch)

# onUpdateのfetchAllDataをforceRefresh=trueに変更
content = content.replace(
    'onUpdate={fetchAllData}',
    'onUpdate={() => fetchAllData(true)}'
)

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ PropertyListingsPage.tsx updated')


# ===== WorkTasksPage.tsx =====
with open('frontend/frontend/src/pages/WorkTasksPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# importにキャッシュを追加
old_import = "import PageNavigation from '../components/PageNavigation';"
new_import = """import PageNavigation from '../components/PageNavigation';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"""

content = content.replace(old_import, new_import, 1)

# fetchAllWorkTasks関数をキャッシュ対応に変更
old_fetch = """  const fetchAllWorkTasks = async () => {
    try {
      setLoading(true);
      // 全件取得してフロントエンドでフィルタリング
      const response = await api.get('/api/work-tasks', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      setAllWorkTasks(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch work tasks:', error);
    } finally {
      setLoading(false);
    }
  };"""

new_fetch = """  const fetchAllWorkTasks = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<WorkTask[]>(CACHE_KEYS.WORK_TASKS);
      if (cached) {
        setAllWorkTasks(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      // 全件取得してフロントエンドでフィルタリング
      const response = await api.get('/api/work-tasks', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      const data = response.data.data || [];
      // キャッシュに保存（3分間有効）
      pageDataCache.set(CACHE_KEYS.WORK_TASKS, data);
      setAllWorkTasks(data);
    } catch (error) {
      console.error('Failed to fetch work tasks:', error);
    } finally {
      setLoading(false);
    }
  };"""

content = content.replace(old_fetch, new_fetch)

# onUpdateのfetchAllWorkTasksをforceRefresh=trueに変更
content = content.replace(
    'onUpdate={fetchAllWorkTasks}',
    'onUpdate={() => fetchAllWorkTasks(true)}'
)

with open('frontend/frontend/src/pages/WorkTasksPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ WorkTasksPage.tsx updated')


# ===== SharedItemsPage.tsx =====
with open('frontend/frontend/src/pages/SharedItemsPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# importにキャッシュを追加
old_import = "import PageNavigation from '../components/PageNavigation';"
new_import = """import PageNavigation from '../components/PageNavigation';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"""

content = content.replace(old_import, new_import, 1)

# fetchAllSharedItems関数をキャッシュ対応に変更
old_fetch = """  const fetchAllSharedItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/shared-items', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      setAllSharedItems(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch shared items:', error);
    } finally {
      setLoading(false);
    }
  };"""

new_fetch = """  const fetchAllSharedItems = async (forceRefresh = false) => {
    // キャッシュが有効な場合はAPIを叩かない
    if (!forceRefresh) {
      const cached = pageDataCache.get<SharedItem[]>(CACHE_KEYS.SHARED_ITEMS);
      if (cached) {
        setAllSharedItems(cached);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await api.get('/api/shared-items', {
        params: {
          limit: 1000,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc',
        },
      });
      const data = response.data.data || [];
      // キャッシュに保存（3分間有効）
      pageDataCache.set(CACHE_KEYS.SHARED_ITEMS, data);
      setAllSharedItems(data);
    } catch (error) {
      console.error('Failed to fetch shared items:', error);
    } finally {
      setLoading(false);
    }
  };"""

content = content.replace(old_fetch, new_fetch)

with open('frontend/frontend/src/pages/SharedItemsPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ SharedItemsPage.tsx updated')
print('\n全ファイルの更新が完了しました')
