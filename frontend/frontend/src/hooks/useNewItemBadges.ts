import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

/**
 * 各リストの新規案件数を取得するカスタムフック
 * 
 * 「新規」の定義: ユーザーが最後にそのページを閲覧した時刻以降に作成されたレコード
 * localStorageに最終閲覧時刻を保存し、それ以降のcreated_atを持つレコードをカウント
 */

const STORAGE_KEY_PREFIX = 'lastViewed_';

// 各ページの最終閲覧時刻をlocalStorageから取得
function getLastViewed(pageKey: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${pageKey}`);
  } catch {
    return null;
  }
}

// 各ページの最終閲覧時刻をlocalStorageに保存
function setLastViewed(pageKey: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${pageKey}`, new Date().toISOString());
  } catch {
    // localStorage使用不可の場合は無視
  }
}

export interface NewItemCounts {
  sellers: number;
  buyers: number;
  propertyListings: number;
  workTasks: number;
}

export function useNewItemBadges(currentPath: string) {
  const [counts, setCounts] = useState<NewItemCounts>({
    sellers: 0,
    buyers: 0,
    propertyListings: 0,
    workTasks: 0,
  });

  // 新規件数を取得
  const fetchCounts = useCallback(async () => {
    try {
      const [sellersCount, buyersCount, propertyListingsCount, workTasksCount] = await Promise.all([
        getNewCount('sellers', 'sellers'),
        getNewCount('buyers', 'buyers'),
        getNewCount('property_listings', 'propertyListings'),
        getNewCount('work_tasks', 'workTasks'),
      ]);

      setCounts({
        sellers: sellersCount,
        buyers: buyersCount,
        propertyListings: propertyListingsCount,
        workTasks: workTasksCount,
      });
    } catch (error) {
      console.error('[useNewItemBadges] カウント取得エラー:', error);
    }
  }, []);

  // 現在のページに対応するバッジをクリア
  useEffect(() => {
    const pageKey = getPageKeyFromPath(currentPath);
    if (pageKey) {
      setLastViewed(pageKey);
      // 現在のページのカウントを即座に0にする
      setCounts(prev => ({ ...prev, [pageKey]: 0 }));
    }
  }, [currentPath]);

  // 初回ロード時とインターバルで取得
  useEffect(() => {
    fetchCounts();

    // 60秒ごとに更新
    const interval = setInterval(fetchCounts, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // マーク済み（ページ閲覧済み）にする関数
  const markAsViewed = useCallback((pageKey: keyof NewItemCounts) => {
    setLastViewed(pageKey);
    setCounts(prev => ({ ...prev, [pageKey]: 0 }));
  }, []);

  return { counts, markAsViewed, refetch: fetchCounts };
}

// deleted_at カラムを持つテーブル（sellers, buyers のみ）
const TABLES_WITH_DELETED_AT = new Set(['sellers', 'buyers']);

// テーブルから新規件数を取得
async function getNewCount(tableName: string, pageKey: string): Promise<number> {
  const lastViewed = getLastViewed(pageKey);

  // 初回（まだ一度も閲覧していない場合）は過去24時間の新規をカウント
  const since = lastViewed || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .gt('created_at', since);

  // deleted_at カラムが存在するテーブルのみフィルターを追加
  if (TABLES_WITH_DELETED_AT.has(tableName)) {
    query = query.is('deleted_at', null);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`[useNewItemBadges] ${tableName} カウントエラー:`, error.message);
    return 0;
  }

  return count || 0;
}

// パスからページキーを取得
function getPageKeyFromPath(path: string): keyof NewItemCounts | null {
  if (path === '/' || path.startsWith('/sellers')) return 'sellers';
  if (path.startsWith('/buyers')) return 'buyers';
  if (path.startsWith('/property-listings')) return 'propertyListings';
  if (path.startsWith('/work-tasks')) return 'workTasks';
  return null;
}
