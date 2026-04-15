# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 内覧形態更新時の認証ブロッキング遅延
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL することでバグの存在が確認される
  - **修正前にテストが失敗しても、テストやコードを修正しないこと**
  - **注意**: このテストは期待される動作をエンコードしている — 実装後にパスすることで修正を検証する
  - **目的**: バグの存在を示すカウンターエグザンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - `backend/src/services/BuyerService.ts` の `updateWithSync()` を対象にテストを作成する
  - `sheetsClient.authenticate()` を5秒遅延するモックに差し替える
  - `this.writeService = null`（コールドスタート状態）で `updateWithSync()` を呼び出す
  - `viewing_mobile` フィールドの更新リクエストで応答時間が5秒以上かかることを確認する
  - `viewing_type_general` フィールドの更新リクエストでも同様に確認する
  - テストを修正前のコードで実行する
  - **期待される結果**: テストが FAIL する（バグの存在を証明）
  - カウンターエグザンプルを記録する（例: `updateWithSync({fieldName: 'viewing_mobile', ...})` が5秒以上かかる）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保存性プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - スプレッドシート同期・他フィールド動作の維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（`viewing_mobile` / `viewing_type_general` 以外のフィールド）の動作を観察する
  - 観察: `viewing_date` 更新時に `writeService.updateFields()` が呼ばれることを確認
  - 観察: 同期失敗時に `retryHandler.queueFailedChange()` が呼ばれることを確認
  - 観察: `conflictResolver.checkConflict()` が実行されることを確認
  - プロパティベーステストを作成: 全ての非バグ条件入力に対して上記の動作が維持されることを検証
  - プロパティベーステストを推奨する理由: 多様なフィールド名・値の組み合わせを自動生成でき、保存性を強く保証できる
  - テストを修正前のコードで実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認）
  - テストを作成し、実行し、修正前コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 内覧形態クリック遅延バグの修正

  - [x] 3.1 修正を実装する
    - `backend/src/services/BuyerService.ts` の `updateWithSync()` を修正する
    - `updateWithSync()` 冒頭の `await this.initSyncServices()` を削除する
    - DB 更新処理（`supabase.from('buyers').update(...)`）はそのまま維持する
    - 競合チェック（`conflictResolver.checkConflict`）はそのまま維持する
    - 監査ログ記録を DB 更新直後（同期処理の前）に移動する
    - スプレッドシート同期処理全体を `setImmediate()` でラップし fire-and-forget で実行する
    - `setImmediate` 内で `await this.initSyncServices()` を呼び出す（同期処理の直前）
    - `syncResult` の初期値として `{ success: true, syncStatus: 'pending' }` を設定する
    - 同期失敗時のリトライキュー追加処理（`retryHandler.queueFailedChange()`）は `setImmediate` 内で維持する
    - DB 更新完了後に即座にレスポンスを返す
    - _Bug_Condition: isBugCondition(input) — input.fieldName IN ['viewing_mobile', 'viewing_type_general'] AND this.writeService IS NULL_
    - _Expected_Behavior: DB 更新が認証待機なしに即座に完了し、1秒以内にレスポンスが返る。スプレッドシート同期はバックグラウンドで非同期実行される_
    - _Preservation: スプレッドシート同期の継続実行、リトライキュー追加、競合チェック、他フィールドの動作維持_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストがパスすることを確認する
    - **Property 1: Expected Behavior** - 内覧形態更新時の即時レスポンス
    - **重要**: タスク1で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすることで、期待される動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保存性テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - スプレッドシート同期・他フィールド動作の維持
    - **重要**: タスク2で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク2の保存性プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認する

- [x] 4. チェックポイント — 全テストのパスを確認する
  - 全テストがパスすることを確認する
  - 疑問点があればユーザーに確認する
