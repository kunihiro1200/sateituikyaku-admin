# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - workTaskMap空時のunreported誤カウントバグ
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示す反例を表面化させる
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `report_date = 今日`、`atbb_status = '一般・公開前'`、`publish_scheduled_date = 今日` の物件
  - `calculatePropertyStatus(listing, undefined)` → `unreported` を返す（workTaskMap未取得時）
  - `calculatePropertyStatus(listing, workTaskMap)` → `today_publish` を返す（workTaskMap取得後）
  - `PropertySidebarStatus` の `statusCounts['未報告林']` と `filteredListings.length`（`sidebarStatus === '未報告林'` 時）が一致しないことを確認
  - テストを未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見した反例を記録して根本原因を理解する（例: `workTaskMap = undefined` の場合、`today_publish` になるべき物件が `unreported` としてカウントされる）
  - タスク完了条件: テストが作成され、実行され、FAILが記録されたとき
  - _Requirements: 1.1_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 未報告以外のカテゴリーの動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false を返すケース）の動作を観察する
  - 観察: `confirmation === '未'` の物件は `未完了` としてカウントされる
  - 観察: `price_reduction_scheduled_date <= 今日` の物件は `要値下げ` としてカウントされる
  - 観察: `sidebar_status === '専任・公開中'` の物件は担当者別専任公開中としてカウントされる
  - 観察: `workTaskMap` が正常に取得されている状態での `today_publish` 判定が正しく動作する
  - プロパティベーステスト: 未報告以外のカテゴリーについて、修正前後でカウントとフィルタリングが変わらないことを検証
  - テストを未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが正しい — 保全すべきベースライン動作を確認する）
  - タスク完了条件: テストが作成され、実行され、未修正コードでPASSが確認されたとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. workTaskMapタイミング差異とサイドバーカウントロジックの修正

  - [x] 3.1 `PropertyListingsPage.tsx` の `fetchAllData` で `workTasks` の取得を早期化する
    - `while (hasMore)` ループの後に `workTasks` を取得している現在の実装を変更する
    - 最初のバッチ取得後、残りの物件データと並行して `workTasks` を取得する
    - `Promise.all` を使用して残りの物件データと `workTasksRes` を並行取得する
    - これにより、サイドバーが最初にレンダリングされる時点で `workTaskMap` が利用可能になる
    - _Bug_Condition: isBugCondition(listing, workTaskMap_empty, workTaskMap_full) — workTaskMapが空の状態でstatusCountsが計算される_
    - _Expected_Behavior: workTaskMapが揃った状態でstatusCountsが計算され、today_publish判定が正しく行われる_
    - _Preservation: 未報告以外のカテゴリー（未完了・要値下げ・専任公開中など）のカウントとフィルタリングは変わらない_
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.2 `PropertySidebarStatus.tsx` の「未報告」カウントロジックを `calculatePropertyStatus` の結果のみに統一する
    - `statusCounts` の useMemo 内で、`calculatePropertyStatus(listing, workTaskMap)` の結果のみを使用する
    - `sidebar_status` の値（古い形式 `'未報告 林田'` など）に依存しないようにする
    - `PropertyListingsPage.tsx` のフィルタリングロジックと完全に同一の条件でカウントする
    - スペース除去の正規化処理（`.replace(/\s+/g, '')`）を両方で統一する
    - _Bug_Condition: sidebar_statusの古い形式による二重カウントの可能性_
    - _Expected_Behavior: calculatePropertyStatusの結果のみでunreportedを判定し、sidebar_statusに依存しない_
    - _Preservation: sidebar_statusが正しい形式で保存されている物件は引き続き正しくカウントされる_
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - workTaskMap空時のunreported誤カウントバグ
    - **IMPORTANT**: タスク1の**同じテスト**を再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすると、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.3, 2.4 — Expected Behavior Properties from design_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 未報告以外のカテゴリーの動作保持
    - **IMPORTANT**: タスク2の**同じテスト**を再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストがPASSすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テスト（バグ条件テスト・保全テスト）がPASSすることを確認する
  - 疑問が生じた場合はユーザーに確認する
