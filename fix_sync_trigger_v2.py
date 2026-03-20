#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync.ts の /trigger エンドポイントに sellersOnly パラメータを追加する（CRLF対応版）
"""

import os

sync_path = os.path.join('backend', 'src', 'routes', 'sync.ts')

with open(sync_path, 'rb') as f:
    content = f.read()

# バイト列のまま置換（CRLF対応）
old_bytes = (
    b"  // \xe5\x90\x8c\xe6\x9c\x9f\xe7\x9a\x84\xe3\x81\xab\xe5\xae\x9f\xe8\xa1\x8c\xef\xbc\x88Vercel\xe3\x82\xb5\xe3\x83\xbc\xe3\x83\x90\xe3\x83\xbc\xe3\x83\xac\xe3\x82\xb9\xe9\x96\xa2\xe6\x95\xb0\xe3\x81\xaf\xe3\x83\xac\xe3\x82\xb9\xe3\x83\x9d\xe3\x83\xb3\xe3\x82\xb9\xe5\xbe\x8c\xe3\x81\xabsetImmediate\xe3\x81\x8c\xe5\x8b\x95\xe3\x81\x8b\xe3\x81\xaa\xe3\x81\x84\xe3\x81\x9f\xe3\x82\x81\xef\xbc\x89\r\n"
    b"  // GAS\xe3\x81\xae\xe3\x82\xbf\xe3\x82\xa4\xe3\x83\xa0\xe3\x82\xa2\xe3\x82\xa6\xe3\x83\x88\xe3\x81\xaf6\xe5\x88\x86\xe3\x81\x82\xe3\x82\x8b\xe3\x81\xae\xe3\x81\xa7\xe3\x80\x81\xe5\x90\x8c\xe6\x9c\x9f\xe5\x87\xa6\xe7\x90\x86\xe3\x81\x8c\xe5\xae\x8c\xe4\xba\x86\xe3\x81\x99\xe3\x82\x8b\xe3\x81\xbe\xe3\x81\xa7\xe5\xbe\x85\xe3\x81\xa4\r\n"
    b"  try {\r\n"
    b"    const { getEnhancedAutoSyncService } = await import('../services/EnhancedAutoSyncService');\r\n"
    b"    const { getSyncHealthChecker } = await import('../services/SyncHealthChecker');\r\n"
    b"    \r\n"
    b"    const syncService = getEnhancedAutoSyncService();\r\n"
    b"    await syncService.initialize();\r\n"
    b"    \r\n"
    b"    const result = await syncService.runFullSync('manual');\r\n"
    b"    \r\n"
    b"    // \xe3\x83\x98\xe3\x83\xab\xe3\x82\xb9\xe3\x83\x81\xe3\x82\xa7\xe3\x83\x83\xe3\x82\xaf\xe3\x82\x92\xe6\x9b\xb4\xe6\x96\xb0\r\n"
    b"    const healthChecker = getSyncHealthChecker();\r\n"
    b"    await healthChecker.checkAndUpdateHealth();\r\n"
    b"\r\n"
    b"    const isSuccess = result.status === 'success' || result.status === 'partial_success';\r\n"
    b"\r\n"
    b"    res.json({\r\n"
    b"      success: isSuccess,\r\n"
    b"      message: isSuccess \r\n"
    b"        ? `Full sync completed: ${result.additionResult.successfullyAdded} added, ${result.deletionResult.successfullyDeleted} deleted`\r\n"
    b"        : 'Full sync failed',\r\n"
    b"      data: {\r\n"
    b"        status: result.status,\r\n"
    b"        additionResult: {\r\n"
    b"          totalProcessed: result.additionResult.totalProcessed,\r\n"
    b"          successfullyAdded: result.additionResult.successfullyAdded,\r\n"
    b"          successfullyUpdated: result.additionResult.successfullyUpdated,\r\n"
    b"          failed: result.additionResult.failed,\r\n"
    b"        },\r\n"
    b"        deletionResult: {\r\n"
    b"          totalDetected: result.deletionResult.totalDetected,\r\n"
    b"          successfullyDeleted: result.deletionResult.successfullyDeleted,\r\n"
    b"          failedToDelete: result.deletionResult.failedToDelete,\r\n"
    b"          requiresManualReview: result.deletionResult.requiresManualReview,\r\n"
    b"        },\r\n"
    b"        duration: result.totalDurationMs,\r\n"
    b"        syncedAt: result.syncedAt,\r\n"
    b"      },\r\n"
    b"    });\r\n"
    b"  } catch (error: any) {\r\n"
    b"    console.error('Trigger sync error:', error);\r\n"
    b"    res.status(500).json({\r\n"
    b"      success: false,\r\n"
    b"      error: error.message,\r\n"
    b"    });\r\n"
    b"  }"
)

new_bytes = (
    b"  // sellersOnly=true \xe3\x81\xae\xe5\xa0\xb4\xe5\x90\x88\xe3\x81\xaf\xe5\xa3\xb2\xe4\xb8\xbb\xe5\x90\x8c\xe6\x9c\x9f\xe3\x81\xae\xe3\x81\xbf\xef\xbc\x88Phase 1-3\xef\xbc\x89\xe3\x82\x92\xe5\xae\x9f\xe8\xa1\x8c\xe3\x81\x97\xe3\x81\xa6\xe3\x82\xbf\xe3\x82\xa4\xe3\x83\xa0\xe3\x82\xa2\xe3\x82\xa6\xe3\x83\x88\xe3\x82\x92\xe5\x9b\x9e\xe9\x81\xbf\r\n"
    b"  // GAS\xe3\x81\xae\xe3\x82\xbf\xe3\x82\xa4\xe3\x83\xa0\xe3\x82\xa2\xe3\x82\xa6\xe3\x83\x88\xe3\x81\xaf6\xe5\x88\x86\xe3\x81\x82\xe3\x82\x8b\xe3\x81\xae\xe3\x81\xa7\xe3\x80\x81\xe5\x90\x8c\xe6\x9c\x9f\xe5\x87\xa6\xe7\x90\x86\xe3\x81\x8c\xe5\xae\x8c\xe4\xba\x86\xe3\x81\x99\xe3\x82\x8b\xe3\x81\xbe\xe3\x81\xa7\xe5\xbe\x85\xe3\x81\xa4\r\n"
    b"  const sellersOnly = req.query.sellersOnly === 'true';\r\n"
    b"\r\n"
    b"  try {\r\n"
    b"    const { getEnhancedAutoSyncService } = await import('../services/EnhancedAutoSyncService');\r\n"
    b"    const { getSyncHealthChecker } = await import('../services/SyncHealthChecker');\r\n"
    b"    \r\n"
    b"    const syncService = getEnhancedAutoSyncService();\r\n"
    b"    await syncService.initialize();\r\n"
    b"\r\n"
    b"    if (sellersOnly) {\r\n"
    b"      // \xe5\xa3\xb2\xe4\xb8\xbb\xe3\x81\xae\xe3\x81\xbf\xe5\x90\x8c\xe6\x9c\x9f\xef\xbc\x88Phase 1-3\xef\xbc\x89\r\n"
    b"      const result = await syncService.runSellersOnlySync();\r\n"
    b"\r\n"
    b"      // \xe3\x83\x98\xe3\x83\xab\xe3\x82\xb9\xe3\x83\x81\xe3\x82\xa7\xe3\x83\x83\xe3\x82\xaf\xe3\x82\x92\xe6\x9b\xb4\xe6\x96\xb0\r\n"
    b"      const healthChecker = getSyncHealthChecker();\r\n"
    b"      await healthChecker.checkAndUpdateHealth();\r\n"
    b"\r\n"
    b"      res.json({\r\n"
    b"        success: result.success,\r\n"
    b"        message: result.success\r\n"
    b"          ? `Sellers-only sync completed: ${result.added} added, ${result.updated} updated, ${result.deleted} deleted`\r\n"
    b"          : 'Sellers-only sync failed',\r\n"
    b"        data: {\r\n"
    b"          added: result.added,\r\n"
    b"          updated: result.updated,\r\n"
    b"          deleted: result.deleted,\r\n"
    b"          errors: result.errors.length,\r\n"
    b"          durationMs: result.durationMs,\r\n"
    b"        },\r\n"
    b"      });\r\n"
    b"    } else {\r\n"
    b"      // \xe3\x83\x95\xe3\x83\xab\xe5\x90\x8c\xe6\x9c\x9f\xef\xbc\x88\xe5\x85\xa8\xe3\x83\x95\xe3\x82\xa7\xe3\x83\xbc\xe3\x82\xba\xef\xbc\x89\r\n"
    b"      const result = await syncService.runFullSync('manual');\r\n"
    b"      \r\n"
    b"      // \xe3\x83\x98\xe3\x83\xab\xe3\x82\xb9\xe3\x83\x81\xe3\x82\xa7\xe3\x83\x83\xe3\x82\xaf\xe3\x82\x92\xe6\x9b\xb4\xe6\x96\xb0\r\n"
    b"      const healthChecker = getSyncHealthChecker();\r\n"
    b"      await healthChecker.checkAndUpdateHealth();\r\n"
    b"\r\n"
    b"      const isSuccess = result.status === 'success' || result.status === 'partial_success';\r\n"
    b"\r\n"
    b"      res.json({\r\n"
    b"        success: isSuccess,\r\n"
    b"        message: isSuccess \r\n"
    b"          ? `Full sync completed: ${result.additionResult.successfullyAdded} added, ${result.deletionResult.successfullyDeleted} deleted`\r\n"
    b"          : 'Full sync failed',\r\n"
    b"        data: {\r\n"
    b"          status: result.status,\r\n"
    b"          additionResult: {\r\n"
    b"            totalProcessed: result.additionResult.totalProcessed,\r\n"
    b"            successfullyAdded: result.additionResult.successfullyAdded,\r\n"
    b"            successfullyUpdated: result.additionResult.successfullyUpdated,\r\n"
    b"            failed: result.additionResult.failed,\r\n"
    b"          },\r\n"
    b"          deletionResult: {\r\n"
    b"            totalDetected: result.deletionResult.totalDetected,\r\n"
    b"            successfullyDeleted: result.deletionResult.successfullyDeleted,\r\n"
    b"            failedToDelete: result.deletionResult.failedToDelete,\r\n"
    b"            requiresManualReview: result.deletionResult.requiresManualReview,\r\n"
    b"          },\r\n"
    b"          duration: result.totalDurationMs,\r\n"
    b"          syncedAt: result.syncedAt,\r\n"
    b"        },\r\n"
    b"      });\r\n"
    b"    }\r\n"
    b"  } catch (error: any) {\r\n"
    b"    console.error('Trigger sync error:', error);\r\n"
    b"    res.status(500).json({\r\n"
    b"      success: false,\r\n"
    b"      error: error.message,\r\n"
    b"    });\r\n"
    b"  }"
)

if old_bytes in content:
    content = content.replace(old_bytes, new_bytes, 1)
    with open(sync_path, 'wb') as f:
        f.write(content)
    print('✅ sync.ts: /trigger エンドポイントに sellersOnly 分岐を追加しました')
else:
    print('❌ sync.ts: バイト列が見つかりませんでした。別の方法で検索します...')
    # 英語部分だけで検索してみる
    search_key = b"const result = await syncService.runFullSync('manual');"
    idx = content.find(search_key)
    if idx >= 0:
        print(f'  runFullSync の位置: {idx}')
        print(f'  前後の内容: {repr(content[idx-200:idx+100])}')
    else:
        print('  runFullSync も見つかりませんでした')
