# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - buyer_sidebar_counts テーブル全削除バグ
  - **CRITICAL**: このテストは未修正コードで FAIL する必要がある - 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードする - 実装後にパスすることで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容: `invalidateBuyerStatusCache()` を呼び出した後、`buyer_sidebar_counts` テーブルが空になることを確認
  - テスト内容: テーブルが空の状態で `getSidebarCounts()` を呼び出し、応答時間が5秒を超えることを確認（フォールバック計算が実行される）
  - バグ条件: `buyer_sidebar_counts` テーブルの行数 = 0（isBugCondition が true）
  - 期待される動作: `getSidebarCounts()` が5秒未満で応答すること（修正後）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト FAILS（これが正しい - バグの存在を証明する）
  - 反例を記録して根本原因を理解する（例: `invalidateBuyerStatusCache()` 呼び出し後にテーブルが空になり、次回アクセスで20秒かかる）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 差分更新と件数正確性の保全
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`buyer_sidebar_counts` テーブルにデータがある状態）の動作を観察する
  - 観察: `buyer_sidebar_counts` テーブルにデータがある状態で `getSidebarCounts()` を呼び出すと300ms以内で応答する
  - 観察: 買主データ更新後に `SidebarCountsUpdateService.updateBuyerSidebarCounts()` が呼ばれ、テーブルが正しく更新される
  - 観察: テーブルから取得したカウントとフォールバック計算のカウントが一致する
  - プロパティベーステスト: 任意の買主データ更新後に `buyer_sidebar_counts` テーブルが空にならないことを確認（保全要件より）
  - プロパティベーステスト: テーブルにデータがある状態での `getSidebarCounts()` の応答時間が5秒未満であることを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASSES（ベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 買主サイドバーパフォーマンス問題の修正

  - [x] 3.1 `invalidateBuyerStatusCache()` から `buyer_sidebar_counts` テーブル全削除処理を除去する
    - `backend/src/services/BuyerService.ts` の `invalidateBuyerStatusCache()` 関数（Line 47付近）を修正する
    - `buyer_sidebar_counts` テーブルを全削除するブロック（Line 55-76付近）を削除する
    - インメモリキャッシュ（`_moduleLevelStatusCache`）のクリアは維持する
    - 買付率統計キャッシュ（`purchaseRateStatisticsCache.flushAll()`）のクリアは維持する
    - コメントを追加: `buyer_sidebar_counts` テーブルは削除しない理由を明記する
    - _Bug_Condition: isBugCondition(request) where buyer_sidebar_counts テーブルの行数 = 0_
    - _Expected_Behavior: getSidebarCounts() が5秒未満で応答する（テーブルにデータが存在する状態を維持）_
    - _Preservation: SidebarCountsUpdateService による差分更新を維持し、buyer_sidebar_counts テーブルのデータを削除しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 `backend/vercel.json` に買主サイドバーカウントのCronジョブを追加する
    - `backend/vercel.json` の `crons` 配列に買主サイドバーカウント更新エントリを追加する
    - パス: `/api/buyers/update-sidebar-counts`
    - スケジュール: `*/10 * * * *`（売主と同様に10分ごと）
    - 既存の売主サイドバーカウントCronジョブ（`/api/sellers/sidebar-counts/update`）は変更しない
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 バグ条件の探索テストが現在パスすることを確認する
    - **Property 1: Expected Behavior** - buyer_sidebar_counts テーブル全削除バグ
    - **IMPORTANT**: タスク1の同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすると、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 差分更新と件数正確性の保全
    - **IMPORTANT**: タスク2の同じテストを再実行する - 新しいテストを作成しない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションがないことを確認する）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストがパスすることを確認する
  - 全テストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。
