/**
 * ページデータキャッシュ
 * ナビゲーション間でデータを保持し、再マウント時のAPIコールを削減する
 * TTL（有効期限）を過ぎたデータは自動的に無効化される
 */

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3分

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PageDataCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key === prefix || key.startsWith(prefix + ':')) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  isValid(key: string): boolean {
    return this.get(key) !== null;
  }
}

// シングルトンインスタンス（モジュールレベルで保持）
export const pageDataCache = new PageDataCache();

// キャッシュキー定数
export const CACHE_KEYS = {
  PROPERTY_LISTINGS: 'property_listings',
  WORK_TASKS: 'work_tasks',
  SHARED_ITEMS: 'shared_items',
  BUYERS: 'buyers',
  BUYERS_STATS: 'buyers_stats',
  SELLERS_SIDEBAR_COUNTS: 'sellers_sidebar_counts',
  SELLERS_ASSIGNEE_INITIALS: 'sellers_assignee_initials',
  SELLERS_LIST: 'sellers_list',
  SELLER_DETAIL: 'seller_detail', // 売主詳細（一覧→通話モードのプリフェッチ用）
} as const;

/**
 * 売主詳細キャッシュキーを生成する
 */
export function sellerDetailCacheKey(sellerId: string): string {
  return `${CACHE_KEYS.SELLER_DETAIL}:${sellerId}`;
}
