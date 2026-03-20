#!/usr/bin/env python3
# index.tsでsyncQueue作成後にSellerService.setSharedSyncQueue()を呼ぶ

with open('backend/src/index.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "const syncQueue = new SyncQueue(spreadsheetSyncService);\r\n\r\n    console.log('\u2705 SyncQueue initialized and ready');"

new = "const syncQueue = new SyncQueue(spreadsheetSyncService);\r\n\r\n    // \u5168\u3066\u306eSellerService\u30a4\u30f3\u30b9\u30bf\u30f3\u30b9\u3067\u5171\u6709\u3059\u308bsyncQueue\u3092\u8a2d\u5b9a\r\n    const { SellerService: SellerServiceClass } = await import('./services/SellerService.supabase');\r\n    SellerServiceClass.setSharedSyncQueue(syncQueue);\r\n\r\n    console.log('\u2705 SyncQueue initialized and ready');"

if old in text:
    text = text.replace(old, new)
    print('OK: index.ts updated')
else:
    print('ERROR: target string not found')
    import sys
    sys.exit(1)

with open('backend/src/index.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done: index.ts updated')
