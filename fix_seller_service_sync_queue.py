#!/usr/bin/env python3
# SellerServiceにstaticなsyncQueueを追加し、全インスタンスで共有できるようにする

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# staticなsharedSyncQueueとgetActiveSyncQueueを追加
old = 'export class SellerService extends BaseRepository {\r\n  private syncQueue?: SyncQueue;\r\n\r\n  /**\r\n   * \u540c\u671f\u30ad\u30e5\u30fc\u3092\u8a2d\u5b9a\uff08\u30aa\u30d7\u30b7\u30e7\u30f3\uff09\r\n   */\r\n  setSyncQueue(syncQueue: SyncQueue): void {\r\n    this.syncQueue = syncQueue;\r\n  }'

new = 'export class SellerService extends BaseRepository {\r\n  private syncQueue?: SyncQueue;\r\n  // \u5168\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u3067\u5171\u6709\u3059\u308bstatic\u306asyncQueue\r\n  private static sharedSyncQueue?: SyncQueue;\r\n\r\n  /**\r\n   * \u540c\u671f\u30ad\u30e5\u30fc\u3092\u8a2d\u5b9a\uff08\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\uff09\r\n   */\r\n  setSyncQueue(syncQueue: SyncQueue): void {\r\n    this.syncQueue = syncQueue;\r\n  }\r\n\r\n  /**\r\n   * \u540c\u671f\u30ad\u30e5\u30fc\u3092\u30b0\u30ed\u30fc\u30d0\u30eb\u306b\u8a2d\u5b9a\uff08\u5168\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u3067\u5171\u6709\uff09\r\n   */\r\n  static setSharedSyncQueue(syncQueue: SyncQueue): void {\r\n    SellerService.sharedSyncQueue = syncQueue;\r\n    console.log(\'\u2705 SellerService: sharedSyncQueue set\');\r\n  }\r\n\r\n  /**\r\n   * \u6709\u52b9\u306asyncQueue\u3092\u53d6\u5f97\uff08\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u512a\u5148\u3001\u306a\u3051\u308c\u3070shared\uff09\r\n   */\r\n  private getActiveSyncQueue(): SyncQueue | undefined {\r\n    return this.syncQueue ?? SellerService.sharedSyncQueue;\r\n  }'

if old in text:
    text = text.replace(old, new)
    print('OK: class definition updated')
else:
    print('ERROR: target string not found')
    import sys
    sys.exit(1)

# createSeller内のsyncQueue使用箇所を置換
old2 = '    // \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u306b\u540c\u671f\uff08\u975e\u540c\u671f\uff09\r\n    if (this.syncQueue) {\r\n      await this.syncQueue.enqueue({\r\n        type: \'create\',\r\n        sellerId: seller.id,'
new2 = '    // \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u306b\u540c\u671f\uff08\u975e\u540c\u671f\uff09\r\n    const activeSyncQueue = this.getActiveSyncQueue();\r\n    if (activeSyncQueue) {\r\n      await activeSyncQueue.enqueue({\r\n        type: \'create\',\r\n        sellerId: seller.id,'

if old2 in text:
    text = text.replace(old2, new2)
    print('OK: createSeller syncQueue updated')
else:
    print('WARNING: createSeller syncQueue pattern not found (may already be updated)')

# updateSeller内のsyncQueue使用箇所を置換
old3 = '    // \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u306b\u540c\u671f\uff08\u975e\u540c\u671f\uff09\r\n    if (this.syncQueue) {\r\n      await this.syncQueue.enqueue({\r\n        type: \'update\',\r\n        sellerId: sellerId,'
new3 = '    // \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u306b\u540c\u671f\uff08\u975e\u540c\u671f\uff09\r\n    const activeSyncQueue2 = this.getActiveSyncQueue();\r\n    if (activeSyncQueue2) {\r\n      await activeSyncQueue2.enqueue({\r\n        type: \'update\',\r\n        sellerId: sellerId,'

if old3 in text:
    text = text.replace(old3, new3)
    print('OK: updateSeller syncQueue updated')
else:
    print('WARNING: updateSeller syncQueue pattern not found (may already be updated)')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done: SellerService.supabase.ts updated')
