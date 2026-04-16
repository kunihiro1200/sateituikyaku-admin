# 買主物件番号スプレッドシート同期バグ - タスクリスト

## Tasks

- [x] 1. バグ修正：フロントエンドの `sync=false` パラメータを削除
  - [x] 1.1 `frontend/frontend/src/pages/BuyerDetailPage.tsx` の `handleSavePropertyNumber` 関数で `api.put` の呼び出しから `?sync=false` を削除する
  - [x] 1.2 修正後、`getDiagnostics` でTypeScriptエラーがないことを確認する

- [x] 2. バグ修正：`databaseToSpreadsheet` マッピングに `property_number` を追加
  - [x] 2.1 `backend/src/config/buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `"property_number": "物件番号"` を追加する

- [x] 3. 単体テスト：`BuyerColumnMapper` の `property_number` マッピングを検証
  - [x] 3.1 `backend/src/services/__tests__/BuyerColumnMapper.bugfix.test.ts` に `mapDatabaseToSpreadsheet({ property_number: 'AA1234' })` が `{ '物件番号': 'AA1234' }` を返すことを検証するテストを追加する
  - [x] 3.2 テストを実行して通過することを確認する

- [x] 4. 単体テスト：`handleSavePropertyNumber` が `sync=false` なしでAPIを呼び出すことを検証
  - [x] 4.1 `frontend/frontend/src/__tests__/BuyerDetailPage.fields.test.ts` に物件番号保存時のAPI呼び出しが `sync=false` を含まないことを検証するテストを追加する
  - [x] 4.2 テストを実行して通過することを確認する

- [ ] 5. 動作確認
  - [ ] 5.1 買主番号7360の詳細画面で物件番号を入力して保存し、スプレッドシートに即時反映されることを確認する
  - [ ] 5.2 GAS同期を実行後、物件番号が保持されることを確認する
  - [ ] 5.3 物件番号以外のフィールド（氏名、電話番号など）の更新が引き続き正常に動作することを確認する
