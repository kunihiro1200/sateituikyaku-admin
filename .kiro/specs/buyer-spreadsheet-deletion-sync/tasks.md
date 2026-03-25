# buyer-spreadsheet-deletion-sync Implementation Tasks

## Task List

- [x] 1. バグ条件探索テストの作成（未修正コードで FAIL することを確認）
  - [x] 1.1 `executeBuyerSoftDelete`がソフトデリート（`update`）を実行することを確認するテストを作成
  - [x] 1.2 テストを実行し、バグの存在（`delete`ではなく`update`が呼ばれること）を確認する
  - **対象ファイル**: `backend/src/services/__tests__/EnhancedAutoSyncService.buyer-deletion.test.ts`（新規作成）
  - **期待結果**: テストが FAIL し、`update`が呼ばれていることが確認できる

- [x] 2. ハードデリートへの修正
  - [x] 2.1 `executeBuyerSoftDelete`メソッドのソフトデリート処理をハードデリートに変更する
  - [x] 2.2 メソッド名を`executeBuyerHardDelete`に変更する
  - [x] 2.3 呼び出し元`syncDeletedBuyers`のメソッド名参照を更新する
  - [x] 2.4 ログメッセージを`Hard deleted successfully`に更新する
  - **対象ファイル**: `backend/src/services/EnhancedAutoSyncService.ts`
  - **変更箇所**: Line 3258付近の`executeBuyerSoftDelete`メソッド、Line 3338付近の`syncDeletedBuyers`メソッド

- [x] 3. Fix Checkingテストの作成と実行
  - [x] 3.1 修正後の`executeBuyerHardDelete`が`delete`クエリを実行することを確認するテストを作成
  - [x] 3.2 実行後にレコードが存在しないことを確認するテストを作成
  - [x] 3.3 監査ログ（`buyer_deletion_audit`）が作成されることを確認するテストを作成
  - [x] 3.4 テストを実行し、全て PASS することを確認する
  - **対象ファイル**: `backend/src/services/__tests__/EnhancedAutoSyncService.buyer-deletion.test.ts`

- [x] 4. Preservation Checkingテストの作成と実行
  - [x] 4.1 安全ガード1（スプレッドシート0件）が維持されることを確認するテストを作成
  - [x] 4.2 安全ガード2（50%比率）が維持されることを確認するテストを作成
  - [x] 4.3 安全ガード3（10%閾値）が維持されることを確認するテストを作成
  - [x] 4.4 スプレッドシートに存在する買主が削除されないことを確認するテストを作成
  - [x] 4.5 テストを実行し、全て PASS することを確認する
  - **対象ファイル**: `backend/src/services/__tests__/EnhancedAutoSyncService.buyer-deletion.test.ts`
