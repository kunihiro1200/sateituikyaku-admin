#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク3.3: getSidebarCounts にキャッシュを追加
タスク3.4: updateSeller と createSeller でのキャッシュ無効化に sellers:sidebar-counts を追加
"""

FILE_PATH = 'backend/src/services/SellerService.supabase.ts'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

# CRLF -> LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

# ============================================================
# タスク3.3: getSidebarCounts にキャッシュを追加
# ============================================================

# getSidebarCounts の開始部分（JST取得の直前）にキャッシュチェックを挿入
old_sidebar_start = '''  }> {
    // JST今日の日付を取得
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    
    // 未査定の基準日
    const cutoffDate = '2025-12-08';

    // ヘルパー関数: 営担が有効かどうかを判定（「外す」は担当なしと同じ扱い）'''

new_sidebar_start = '''  }> {
    // キャッシュキー（固定）
    const sidebarCacheKey = 'sellers:sidebar-counts';

    // キャッシュをチェック（60秒TTL）
    const cachedCounts = await CacheHelper.get<{
      todayCall: number;
      todayCallWithInfo: number;
      todayCallAssigned: number;
      visitScheduled: number;
      visitCompleted: number;
      unvaluated: number;
      mailingPending: number;
      todayCallNotStarted: number;
      pinrichEmpty: number;
      visitAssignedCounts: Record<string, number>;
      todayCallAssignedCounts: Record<string, number>;
      todayCallWithInfoLabels: string[];
      todayCallWithInfoLabelCounts: Record<string, number>;
    }>(sidebarCacheKey);
    if (cachedCounts) {
      console.log('✅ Cache hit for sidebar counts');
      return cachedCounts;
    }

    // JST今日の日付を取得
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
    
    // 未査定の基準日
    const cutoffDate = '2025-12-08';

    // ヘルパー関数: 営担が有効かどうかを判定（「外す」は担当なしと同じ扱い）'''

if old_sidebar_start in text:
    text = text.replace(old_sidebar_start, new_sidebar_start, 1)
    print('✅ タスク3.3: getSidebarCounts にキャッシュチェックを追加しました')
else:
    print('❌ タスク3.3: getSidebarCounts の開始部分が見つかりませんでした')
    # デバッグ: 実際の内容を確認
    idx = text.find('  }> {\n    // JST')
    if idx >= 0:
        print(f'  デバッグ: 類似パターンが {idx} に見つかりました')
        print(repr(text[idx:idx+200]))

# getSidebarCounts の戻り値の直前にキャッシュ保存を挿入
old_sidebar_return = '''    return {
      todayCall: todayCallNoInfoCount || 0,
      todayCallWithInfo: todayCallWithInfoCount || 0,
      todayCallAssigned: todayCallAssignedCount || 0,
      visitScheduled: visitScheduledCount || 0,
      visitCompleted: visitCompletedCount || 0,
      unvaluated: unvaluatedCount || 0,
      mailingPending: mailingPendingCount || 0,
      todayCallNotStarted: todayCallNotStartedCount || 0,
      pinrichEmpty: pinrichEmptyCount || 0,
      visitAssignedCounts,
      todayCallAssignedCounts,
      todayCallWithInfoLabels,
      todayCallWithInfoLabelCounts: labelCountMap,
    };
  }
}'''

new_sidebar_return = '''    const sidebarResult = {
      todayCall: todayCallNoInfoCount || 0,
      todayCallWithInfo: todayCallWithInfoCount || 0,
      todayCallAssigned: todayCallAssignedCount || 0,
      visitScheduled: visitScheduledCount || 0,
      visitCompleted: visitCompletedCount || 0,
      unvaluated: unvaluatedCount || 0,
      mailingPending: mailingPendingCount || 0,
      todayCallNotStarted: todayCallNotStartedCount || 0,
      pinrichEmpty: pinrichEmptyCount || 0,
      visitAssignedCounts,
      todayCallAssignedCounts,
      todayCallWithInfoLabels,
      todayCallWithInfoLabelCounts: labelCountMap,
    };

    // キャッシュに保存（60秒TTL）
    await CacheHelper.set(sidebarCacheKey, sidebarResult, CACHE_TTL.SELLER_LIST);

    return sidebarResult;
  }
}'''

if old_sidebar_return in text:
    text = text.replace(old_sidebar_return, new_sidebar_return, 1)
    print('✅ タスク3.3: getSidebarCounts にキャッシュ保存を追加しました')
else:
    print('❌ タスク3.3: getSidebarCounts の戻り値部分が見つかりませんでした')

# ============================================================
# タスク3.4: updateSeller でのキャッシュ無効化に sellers:sidebar-counts を追加
# ============================================================

old_update_cache = '''    // キャッシュを無効化
    await CacheHelper.del(CacheHelper.generateKey('seller', sellerId));
    await CacheHelper.delPattern('sellers:list:*');

    // スプレッドシートに同期（非同期）
    if (this.syncQueue) {
      await this.syncQueue.enqueue({
        type: 'update',
        sellerId: sellerId,
      });
    }

    return decryptedSeller;
  }

  /**
   * 売主情報を更新し、予約情報があればカレンダーイベントを作成/更新
   */'''

new_update_cache = '''    // キャッシュを無効化
    await CacheHelper.del(CacheHelper.generateKey('seller', sellerId));
    await CacheHelper.delPattern('sellers:list:*');
    // サイドバーカウントキャッシュも無効化（売主データ変更により集計が変わる可能性があるため）
    await CacheHelper.del('sellers:sidebar-counts');

    // スプレッドシートに同期（非同期）
    if (this.syncQueue) {
      await this.syncQueue.enqueue({
        type: 'update',
        sellerId: sellerId,
      });
    }

    return decryptedSeller;
  }

  /**
   * 売主情報を更新し、予約情報があればカレンダーイベントを作成/更新
   */'''

if old_update_cache in text:
    text = text.replace(old_update_cache, new_update_cache, 1)
    print('✅ タスク3.4: updateSeller のキャッシュ無効化に sellers:sidebar-counts を追加しました')
else:
    print('❌ タスク3.4: updateSeller のキャッシュ無効化部分が見つかりませんでした')
    # デバッグ
    idx = text.find('    // キャッシュを無効化\n    await CacheHelper.del(CacheHelper.generateKey')
    if idx >= 0:
        print(f'  デバッグ: 類似パターンが {idx} に見つかりました')
        print(repr(text[idx:idx+300]))

# ============================================================
# タスク3.4: createSeller でのキャッシュ無効化に sellers:sidebar-counts を追加
# ============================================================

old_create_cache = '''    // キャッシュを無効化（新しいセラーが追加されたのでリストキャッシュをクリア）
    await CacheHelper.delPattern('sellers:list:*');
    
    // スプレッドシートに同期（非同期）
    if (this.syncQueue) {
      await this.syncQueue.enqueue({
        type: 'create',
        sellerId: seller.id,
      });
    }'''

new_create_cache = '''    // キャッシュを無効化（新しいセラーが追加されたのでリストキャッシュをクリア）
    await CacheHelper.delPattern('sellers:list:*');
    // サイドバーカウントキャッシュも無効化（新規売主追加により集計が変わる可能性があるため）
    await CacheHelper.del('sellers:sidebar-counts');
    
    // スプレッドシートに同期（非同期）
    if (this.syncQueue) {
      await this.syncQueue.enqueue({
        type: 'create',
        sellerId: seller.id,
      });
    }'''

if old_create_cache in text:
    text = text.replace(old_create_cache, new_create_cache, 1)
    print('✅ タスク3.4: createSeller のキャッシュ無効化に sellers:sidebar-counts を追加しました')
else:
    print('❌ タスク3.4: createSeller のキャッシュ無効化部分が見つかりませんでした')
    # デバッグ
    idx = text.find('キャッシュを無効化（新しいセラーが追加')
    if idx >= 0:
        print(f'  デバッグ: 類似パターンが {idx} に見つかりました')
        print(repr(text[idx:idx+300]))

# CRLF に戻してから UTF-8 で書き込む
text_crlf = text.replace('\n', '\r\n')
with open(FILE_PATH, 'wb') as f:
    f.write(text_crlf.encode('utf-8'))

print('\n✅ ファイルを保存しました（CRLF形式）')
print(f'ファイル: {FILE_PATH}')
