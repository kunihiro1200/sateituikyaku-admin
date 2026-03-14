# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - スプレッドシートの買主番号がDBに追加されない
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される（バグの存在を確認）
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にPASSすることでバグ修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケース（買主番号7137）にスコープを絞る
  - テスト内容:
    - スプレッドシートに存在するがDBに存在しない買主番号（例: 7137）に対して `BuyerSyncService.syncAll()` を実行する
    - 実行後、DBに当該買主番号のレコードが存在することをアサートする（`result.created > 0` かつ `buyers` テーブルに存在する）
    - 未修正コードでテストを実行し、**FAILすることを確認**する
    - カウンターサンプルを記録する（例: 「syncAll()実行後も買主番号7137がDBに存在しない」）
  - 根本原因の調査も並行して実施:
    - `backend/src/services/BuyerSyncService.ts` の `processBatch()` のupsertエラーログを確認
    - `backend/migrations/094_add_buyer_number_unique_constraint.sql` がSupabaseに適用済みか確認
    - `BuyerColumnMapper` の `買主番号` → `buyer_number` マッピングが正しいか確認
    - スプレッドシート取得範囲 `A2:GZ` が全行をカバーしているか確認
  - テストが書かれ、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Preservationプロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存の同期動作が変わらない
  - **IMPORTANT**: observation-firstメソドロジーに従う
  - 未修正コードで以下の動作を観察・記録する:
    - `buyer_number` が空の行がスキップされることを確認（`result.skipped` がインクリメントされる）
    - `isSyncInProgress() === true` の場合に同期がスキップされることを確認
    - 既存の買主番号がupsertでupdateされることを確認（`result.updated` がインクリメントされる）
    - 同期完了後に `buyer_sync_logs` テーブルに結果が記録されることを確認
    - 個別行のエラーが `result.failed` にカウントされ、残りの処理が継続されることを確認
  - 観察した動作に基づいてプロパティベーステストを作成する:
    - 空行を含む入力に対して、スキップ数が空行数と一致することを検証
    - 既存レコードを含む入力に対して、updated数が正しいことを検証
    - 重複実行防止ロジックが機能することを検証
  - 未修正コードでテストを実行し、**PASSすることを確認**する（ベースライン動作の確認）
  - テストが書かれ、実行され、未修正コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 買主リスト自動同期バグの修正

  - [x] 3.1 根本原因を特定して修正を実装する
    - タスク1で特定した根本原因に基づいて修正を実施する
    - **原因1（最優先）**: `buyer_number` UNIQUE制約の未適用
      - `backend/migrations/094_add_buyer_number_unique_constraint.sql` をSupabaseに適用する
      - Supabaseダッシュボードまたはマイグレーションツールで適用状況を確認する
    - **原因2**: `processBatch()` のエラーログ強化
      - upsertエラー時に `error.code` と `error.details` を含む詳細ログを出力する
      - `console.error(\`Error syncing row ${rowNumber} (${data.buyer_number}):\`, error.message, error.code, error.details)`
    - **原因3（必要に応じて）**: スプレッドシート取得範囲の修正
      - `A2:GZ` が全行をカバーしていない場合、`A2:GZ10000` のように明示的な行数上限を設定する
    - **原因4（必要に応じて）**: upsertが機能しない場合は `insert` + `update` の2段階処理に変更する
    - _Bug_Condition: isBugCondition(buyerNumber) where spreadsheetHasBuyer=true AND dbHasBuyer=false AND buyerNumber IS NOT NULL_
    - _Expected_Behavior: syncAll()実行後、スプレッドシートの全買主番号がDBに存在する（result.created > 0）_
    - _Preservation: 空行スキップ・重複防止・エラーハンドリング・ログ記録・既存レコード更新が変わらない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストがPASSすることを確認する
    - **Property 1: Expected Behavior** - スプレッドシートの買主番号がDBに追加される
    - **IMPORTANT**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のバグ条件テストを実行する
    - **EXPECTED OUTCOME**: テストがPASSする（バグが修正されたことを確認）
    - 買主番号7137がDBに存在することを確認する
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Preservationテストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - 既存の同期動作が変わらない
    - **IMPORTANT**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク2のPreservationプロパティテストを実行する
    - **EXPECTED OUTCOME**: テストがPASSする（リグレッションがないことを確認）
    - 空行スキップ・重複防止・エラーハンドリング・ログ記録・既存レコード更新が変わらないことを確認する

- [x] 4. チェックポイント - 全テストがPASSすることを確認する
  - タスク1のバグ条件テストがPASSすることを確認する
  - タスク2のPreservationテストがPASSすることを確認する
  - 疑問点があればユーザーに確認する
