#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPageにキャッシュを適用する（statsのみキャッシュ、一覧はページネーションなのでキャッシュ不要）
"""

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# importにキャッシュを追加
old_import = "import { SECTION_COLORS } from '../theme/sectionColors';"
new_import = """import { SECTION_COLORS } from '../theme/sectionColors';
import { pageDataCache, CACHE_KEYS } from '../store/pageDataCache';"""

content = content.replace(old_import, new_import, 1)

# fetchStats関数をキャッシュ対応に変更
old_fetch = """  const fetchStats = async () => {
    try {
      const res = await api.get('/api/buyers/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };"""

new_fetch = """  const fetchStats = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = pageDataCache.get<typeof stats>(CACHE_KEYS.BUYERS_STATS);
      if (cached) {
        setStats(cached);
        return;
      }
    }
    try {
      const res = await api.get('/api/buyers/stats');
      pageDataCache.set(CACHE_KEYS.BUYERS_STATS, res.data);
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };"""

content = content.replace(old_fetch, new_fetch)

# handleSync後にキャッシュを無効化
old_sync = """  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      await fetchBuyers();
      await fetchStats();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };"""

new_sync = """  const handleSync = async () => {
    try {
      setSyncing(true);
      await api.post('/api/buyers/sync');
      await fetchBuyers();
      await fetchStats(true); // 同期後はキャッシュを無効化して再取得
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncing(false);
    }
  };"""

content = content.replace(old_sync, new_sync)

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ BuyersPage.tsx updated')
