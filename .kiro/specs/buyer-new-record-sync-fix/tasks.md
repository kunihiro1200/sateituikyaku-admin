# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - Cron エンドポイント不在による定期同期の欠如
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される — FAIL がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - `process.env.VERCEL = '1'` 環境で `/api/cron/buyer-sync` へのリクエストが 404 を返すことを確認（Bug Condition: `isBugCondition(env)` が true の場合）
  - `/api/cron/work-task-sync` へのリクエストも 404 を返すことを確認
  - テストアサーション: 修正後は 200 を返し、`BuyerSyncService.syncAll()` が呼ばれること（Expected Behavior）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 反例を記録して根本原因を理解する（例: `/api/cron/buyer-sync` が存在しない → 404）
  - テストを書き、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保存確認プロパティテストを書く（修正実装の前に）
  - **Property 2: Preservation** - 手動同期・重複防止・ローカル環境動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false の場合）の動作を観察する
  - 観察: `POST /api/buyers/sync` は未修正コードで正常に動作する
  - 観察: `isSyncInProgress() === true` の場合、同期がスキップされる
  - 観察: `CRON_SECRET` が一致しない場合、既存エンドポイントは 401 を返す
  - 観察: `VERCEL !== '1'` の場合、`setInterval` が設定される
  - プロパティベーステスト: 任意の無効な `CRON_SECRET` で既存エンドポイントが 401 を返すことを確認（Preservation Requirements から）
  - プロパティベーステスト: 同期中フラグが true の場合、重複同期がスキップされることを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースライン動作を確認する）
  - テストを書き、実行し、未修正コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 買主リスト新規レコード同期バグの修正

  - [x] 3.1 `backend/src/index.ts` に Cron Job エンドポイントを追加する
    - 既存の `/api/cron/sync-inquiries` エンドポイントの直後に3つのエンドポイントを追加
    - `GET /api/cron/buyer-sync`: `CRON_SECRET` 認証 → `BuyerSyncService.isSyncInProgress()` チェック → `BuyerSyncService.syncAll()` 実行 → 結果（created/updated/failed）をレスポンスで返す
    - `GET /api/cron/work-task-sync`: `CRON_SECRET` 認証 → `WorkTaskSyncService.isSyncInProgress()` チェック → `WorkTaskSyncService.syncAll()` 実行 → 結果をレスポンスで返す
    - `GET /api/cron/seller-sync`: `CRON_SECRET` 認証 → `EnhancedAutoSyncService` の `runFullSync()` 実行 → 結果をレスポンスで返す
    - 既存の `/api/cron/sync-inquiries` と同じ認証パターンを使用する
    - _Bug_Condition: `isBugCondition(env)` where `env.VERCEL === '1'` AND Cron エンドポイントが存在しない_
    - _Expected_Behavior: Cron エンドポイントが呼ばれたとき `syncAll()` が実行され、新規レコードが DB に挿入される_
    - _Preservation: 手動同期エンドポイント・重複防止ロジック・ローカル環境の `setInterval` は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 `backend/vercel.json` に `crons` セクションを追加する
    - 既存の `builds` と `routes` セクションを維持したまま `crons` セクションを追加
    - `buyer-sync`: `*/10 * * * *`（10分ごと — ローカルの `setInterval` と一致）
    - `work-task-sync`: `*/10 * * * *`（10分ごと）
    - `seller-sync`: `*/5 * * * *`（5分ごと — `AUTO_SYNC_INTERVAL_MINUTES` のデフォルト値と一致）
    - **注意**: ルートの `vercel.json`（公開物件サイト用）は絶対に触らない
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - Cron エンドポイントが買主同期を実行する
    - **IMPORTANT**: タスク1の同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、バグが修正されたことを確認できる
    - `/api/cron/buyer-sync` が 200 を返し、`BuyerSyncService.syncAll()` が呼ばれることを確認
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2)_

  - [x] 3.4 保存確認テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 手動同期・重複防止・ローカル動作が変わらない
    - **IMPORTANT**: タスク2の同じテストを再実行する — 新しいテストを書かない
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全ての保存テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
