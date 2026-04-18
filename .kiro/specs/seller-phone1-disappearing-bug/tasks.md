# seller-phone1-disappearing-bug Tasks

## Tasks

- [-] 1. EnhancedAutoSyncService のキー名修正（主因）
  - [x] 1.1 `detectUpdatedSellers` メソッドで `sheetRow['一番TEL']` を `sheetRow['1番電話']` に修正
  - [x] 1.2 `syncSingleSeller` メソッドで `row['一番TEL']` を `row['1番電話']` に修正
  - [x] 1.3 `updateSingleSeller` メソッドで `row['一番TEL']` を `row['1番電話']` に修正
  - **File**: `backend/src/services/EnhancedAutoSyncService.ts`

- [x] 2. SellerService.createSeller の誤マッピング修正（副因）
  - [x] 2.1 スプレッドシート追加時の `'1番電話'` 列の値を `(data as any).assignedTo` から `(data as any).firstCallPerson` に変更
  - **File**: `backend/src/services/SellerService.supabase.ts`

- [x] 3. PUT /api/sellers/:id での即時スプレッドシート同期追加
  - [x] 3.1 `sellers.ts` の PUT ルートで `firstCallPerson` が更新された場合に `SpreadsheetSyncService.syncToSpreadsheet(sellerId)` を呼び出す処理を追加
  - **File**: `backend/src/routes/sellers.ts`
