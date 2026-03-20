with open('backend/src/routes/sync.ts', 'rb') as f:
    content = f.read()

# CRLF/LFどちらでも対応できるよう、バイト列で置換
old = (
    b"/**\r\n"
    b" * POST /api/sync/trigger\r\n"
    b" * \u624b\u52d5\u3067\u5f37\u5316\u7248\u30d5\u30eb\u540c\u671f\u3092\u30c8\u30ea\u30ac\u30fc\uff08\u5168\u4ef6\u6bd4\u8f03\u65b9\u5f0f\uff09\r\n"
    b" * GitHub Actions\u7b49\u306e\u5916\u90e8\u304b\u3089\u306e\u547c\u3073\u51fa\u3057\u7528\uff08CRON_SECRET\u8a8d\u8a3c\uff09\r\n"
    b" * \r\n"
    b" * \u30af\u30a8\u30ea\u30d1\u30e9\u30e1\u30fc\u30bf:\r\n"
    b" *   ?async=true  \u2192 \u5373\u5ea7\u306b202\u3092\u8fd4\u3057\u3001\u30d0\u30c3\u30af\u30b0\u30e9\u30a6\u30f3\u30c9\u3067\u540c\u671f\u5b9f\u884c\uff08GAS\u7528\uff09\r\n"
    b" */\r\n"
)

# まずLF版も試す
old_lf = old.replace(b'\r\n', b'\n')

if old in content:
    print('Found CRLF version')
    eol = b'\r\n'
elif old_lf in content:
    print('Found LF version')
    old = old_lf
    eol = b'\n'
else:
    # 実際の内容を確認
    idx = content.find(b'POST /api/sync/trigger')
    if idx >= 0:
        print('Found trigger at:', idx)
        print('Context:', repr(content[idx-5:idx+200]))
    else:
        print('ERROR: trigger not found at all')
    exit(1)

new = (
    b"/**\r\n"
    b" * POST /api/sync/trigger\r\n"
    b" * \u624b\u52d5\u3067\u5f37\u5316\u7248\u30d5\u30eb\u540c\u671f\u3092\u30c8\u30ea\u30ac\u30fc\uff08\u5168\u4ef6\u6bd4\u8f03\u65b9\u5f0f\uff09\r\n"
    b" * GitHub Actions\u7b49\u306e\u5916\u90e8\u304b\u3089\u306e\u547c\u3073\u51fa\u3057\u7528\uff08CRON_SECRET\u8a8d\u8a3c\uff09\r\n"
    b" * \r\n"
    b" * \u30af\u30a8\u30ea\u30d1\u30e9\u30e1\u30fc\u30bf:\r\n"
    b" *   ?sellersOnly=true  \u2192 \u58f2\u4e3b\u540c\u671f\u306e\u307f\u5b9f\u884c\uff08Phase 1-3\uff09\u3001\u7269\u4ef6\u30fb\u8cb7\u4e3b\u540c\u671f\u3092\u30b9\u30ad\u30c3\u30d7\uff08GAS\u7528\u30fb\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8\u5bfe\u7b56\uff09\r\n"
    b" */\r\n"
).replace(b'\r\n', eol)

new_body = (
    b"router.post('/trigger', async (req: Request, res: Response) => {\r\n"
    b"  // CRON_SECRET\u8a8d\u8a3c\u30c1\u30a7\u30c3\u30af\r\n"
    b"  const authHeader = req.headers.authorization;\r\n"
    b"  const cronSecret = process.env.CRON_SECRET;\r\n"
    b"  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {\r\n"
    b"    console.error('[Sync Trigger] Unauthorized access attempt');\r\n"
    b"    return res.status(401).json({ success: false, error: 'Unauthorized' });\r\n"
    b"  }\r\n"
    b"\r\n"
    b"  // sellersOnly=true \u306e\u5834\u5408\u3001\u58f2\u4e3b\u540c\u671f\u306e\u307f\u5b9f\u884c\uff08\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8\u5bfe\u7b56\uff09\r\n"
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
    b"      // \u58f2\u4e3b\u540c\u671f\u306e\u307f\u5b9f\u884c\uff08Phase 1-3\uff09\r\n"
    b"      console.log('[Sync Trigger] Running sellers-only sync (Phase 1-3)');\r\n"
    b"      const result = await syncService.runSellersOnlySync();\r\n"
    b"\r\n"
    b"      res.json({\r\n"
    b"        success: result.success,\r\n"
    b"        message: result.success\r\n"
    b"          ? `Sellers sync completed: ${result.added} added, ${result.updated} updated`\r\n"
    b"          : 'Sellers sync failed',\r\n"
    b"        data: result,\r\n"
    b"      });\r\n"
    b"    } else {\r\n"
    b"      // \u30d5\u30eb\u540c\u671f\u3092\u5b9f\u884c\r\n"
    b"      const result = await syncService.runFullSync('manual');\r\n"
    b"    \r\n"
    b"      // \u30d8\u30eb\u30b9\u30c1\u30a7\u30c3\u30af\u3092\u66f4\u65b0\r\n"
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
    b"  }\r\n"
    b"});\r\n"
).replace(b'\r\n', eol)

print('Script loaded. Use strReplace approach instead.')
print('EOL type:', 'CRLF' if eol == b'\r\n' else 'LF')
