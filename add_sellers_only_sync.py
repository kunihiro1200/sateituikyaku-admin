#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EnhancedAutoSyncService に runSellersOnlySync メソッドを追加し、
sync.ts の /trigger エンドポイントに sellersOnly パラメータを追加する
"""

import os

# ===== 1. EnhancedAutoSyncService.ts に runSellersOnlySync を追加 =====
service_path = os.path.join('backend', 'src', 'services', 'EnhancedAutoSyncService.ts')

with open(service_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# クラスの閉じ括弧の直前（シングルトンインスタンスの前）に挿入
old_str = "\n}\n\n// シングルトンインスタンス\nlet enhancedAutoSyncServiceInstance"

new_method = """
  /**
   * 売主のみの同期を実行（Phase 1-3のみ）
   * GASからのトリガー用。物件・買主同期をスキップしてタイムアウトを回避する。
   */
  async runSellersOnlySync(): Promise<{
    success: boolean;
    added: number;
    updated: number;
    deleted: number;
    errors: any[];
    durationMs: number;
  }> {
    const startTime = new Date();
    console.log('🔄 Starting sellers-only sync (Phase 1-3)...');

    // キャッシュをクリアして最新データを取得
    this.clearSpreadsheetCache();

    let added = 0;
    let updated = 0;
    let deleted = 0;
    const errors: any[] = [];

    try {
      // Phase 1: 追加同期
      console.log('📥 Phase 1: Seller Addition Sync');
      const missingSellers = await this.detectMissingSellers();
      if (missingSellers.length > 0) {
        const syncResult = await this.syncMissingSellers(missingSellers);
        added = syncResult.newSellersCount;
        errors.push(...syncResult.errors);
      } else {
        console.log('✅ No missing sellers to sync');
      }

      // Phase 2: 更新同期
      console.log('\\n🔄 Phase 2: Seller Update Sync');
      const updatedSellers = await this.detectUpdatedSellers();
      if (updatedSellers.length > 0) {
        const updateResult = await this.syncUpdatedSellers(updatedSellers);
        updated = updateResult.updatedSellersCount;
        errors.push(...updateResult.errors);
      } else {
        console.log('✅ No sellers to update');
      }

      // Phase 3: 削除同期
      if (this.isDeletionSyncEnabled()) {
        console.log('\\n🗑️  Phase 3: Seller Deletion Sync');
        const deletedSellers = await this.detectDeletedSellers();
        if (deletedSellers.length > 0) {
          const deletionResult = await this.syncDeletedSellers(deletedSellers);
          deleted = deletionResult.successfullyDeleted;
          errors.push(...deletionResult.errors);
        } else {
          console.log('✅ No deleted sellers to sync');
        }
      } else {
        console.log('\\n⏭️  Phase 3: Seller Deletion Sync (Disabled)');
      }

      const durationMs = new Date().getTime() - startTime.getTime();
      console.log(`🎉 Sellers-only sync completed: ${added} added, ${updated} updated, ${deleted} deleted (${durationMs}ms)`);

      return {
        success: errors.length === 0,
        added,
        updated,
        deleted,
        errors,
        durationMs,
      };
    } catch (error: any) {
      console.error('❌ Sellers-only sync failed:', error.message);
      const durationMs = new Date().getTime() - startTime.getTime();
      return {
        success: false,
        added,
        updated,
        deleted,
        errors: [...errors, { message: error.message }],
        durationMs,
      };
    }
  }

}

// シングルトンインスタンス
let enhancedAutoSyncServiceInstance"""

if old_str in text:
    text = text.replace(old_str, new_method, 1)
    print('✅ EnhancedAutoSyncService.ts: runSellersOnlySync メソッドを追加しました')
else:
    print('❌ EnhancedAutoSyncService.ts: 挿入箇所が見つかりませんでした')
    print('--- 検索文字列 ---')
    print(repr(old_str[:100]))
    # デバッグ: 実際のファイル内容を確認
    idx = text.find('// シングルトンインスタンス')
    if idx >= 0:
        print('--- 実際のファイル内容（前後50文字） ---')
        print(repr(text[idx-50:idx+80]))
    exit(1)

with open(service_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {service_path} を保存しました')

# ===== 2. sync.ts の /trigger エンドポイントに sellersOnly 分岐を追加 =====
sync_path = os.path.join('backend', 'src', 'routes', 'sync.ts')

with open(sync_path, 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

old_trigger = """  // 同期的に実行（Vercelサーバーレス関数はレスポンス後にsetImmediateが動かないため）
  // GASのタイムアウトは6分あるので、同期処理が完了するまで待つ
  try {
    const { getEnhancedAutoSyncService } = await import('../services/EnhancedAutoSyncService');
    const { getSyncHealthChecker } = await import('../services/SyncHealthChecker');
    
    const syncService = getEnhancedAutoSyncService();
    await syncService.initialize();
    
    const result = await syncService.runFullSync('manual');
    
    // ヘルスチェックを更新
    const healthChecker = getSyncHealthChecker();
    await healthChecker.checkAndUpdateHealth();

    const isSuccess = result.status === 'success' || result.status === 'partial_success';

    res.json({
      success: isSuccess,
      message: isSuccess 
        ? `Full sync completed: ${result.additionResult.successfullyAdded} added, ${result.deletionResult.successfullyDeleted} deleted`
        : 'Full sync failed',
      data: {
        status: result.status,
        additionResult: {
          totalProcessed: result.additionResult.totalProcessed,
          successfullyAdded: result.additionResult.successfullyAdded,
          successfullyUpdated: result.additionResult.successfullyUpdated,
          failed: result.additionResult.failed,
        },
        deletionResult: {
          totalDetected: result.deletionResult.totalDetected,
          successfullyDeleted: result.deletionResult.successfullyDeleted,
          failedToDelete: result.deletionResult.failedToDelete,
          requiresManualReview: result.deletionResult.requiresManualReview,
        },
        duration: result.totalDurationMs,
        syncedAt: result.syncedAt,
      },
    });
  } catch (error: any) {
    console.error('Trigger sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }"""

new_trigger = """  // sellersOnly=true の場合は売主同期のみ（Phase 1-3）を実行してタイムアウトを回避
  // GASのタイムアウトは6分あるので、同期処理が完了するまで待つ
  const sellersOnly = req.query.sellersOnly === 'true';

  try {
    const { getEnhancedAutoSyncService } = await import('../services/EnhancedAutoSyncService');
    const { getSyncHealthChecker } = await import('../services/SyncHealthChecker');
    
    const syncService = getEnhancedAutoSyncService();
    await syncService.initialize();

    if (sellersOnly) {
      // 売主のみ同期（Phase 1-3）
      const result = await syncService.runSellersOnlySync();

      // ヘルスチェックを更新
      const healthChecker = getSyncHealthChecker();
      await healthChecker.checkAndUpdateHealth();

      res.json({
        success: result.success,
        message: result.success
          ? `Sellers-only sync completed: ${result.added} added, ${result.updated} updated, ${result.deleted} deleted`
          : 'Sellers-only sync failed',
        data: {
          added: result.added,
          updated: result.updated,
          deleted: result.deleted,
          errors: result.errors.length,
          durationMs: result.durationMs,
        },
      });
    } else {
      // フル同期（全フェーズ）
      const result = await syncService.runFullSync('manual');
      
      // ヘルスチェックを更新
      const healthChecker = getSyncHealthChecker();
      await healthChecker.checkAndUpdateHealth();

      const isSuccess = result.status === 'success' || result.status === 'partial_success';

      res.json({
        success: isSuccess,
        message: isSuccess 
          ? `Full sync completed: ${result.additionResult.successfullyAdded} added, ${result.deletionResult.successfullyDeleted} deleted`
          : 'Full sync failed',
        data: {
          status: result.status,
          additionResult: {
            totalProcessed: result.additionResult.totalProcessed,
            successfullyAdded: result.additionResult.successfullyAdded,
            successfullyUpdated: result.additionResult.successfullyUpdated,
            failed: result.additionResult.failed,
          },
          deletionResult: {
            totalDetected: result.deletionResult.totalDetected,
            successfullyDeleted: result.deletionResult.successfullyDeleted,
            failedToDelete: result.deletionResult.failedToDelete,
            requiresManualReview: result.deletionResult.requiresManualReview,
          },
          duration: result.totalDurationMs,
          syncedAt: result.syncedAt,
        },
      });
    }
  } catch (error: any) {
    console.error('Trigger sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }"""

if old_trigger in text2:
    text2 = text2.replace(old_trigger, new_trigger, 1)
    print('✅ sync.ts: /trigger エンドポイントに sellersOnly 分岐を追加しました')
else:
    print('❌ sync.ts: 挿入箇所が見つかりませんでした')
    # デバッグ
    idx = text2.find('同期的に実行')
    if idx >= 0:
        print('--- 実際のファイル内容 ---')
        print(repr(text2[idx:idx+200]))
    exit(1)

with open(sync_path, 'wb') as f:
    f.write(text2.encode('utf-8'))

print(f'✅ {sync_path} を保存しました')
print()
print('=== 完了 ===')
print('次のステップ:')
print('1. git add / commit / push でデプロイ')
print('2. GAS側のURLを /api/sync/trigger?sellersOnly=true に変更')
