# Implementation Plan

- [x] 1. バグ条件探索テストの作成
  - **Property 1: Bug Condition** - workTasksData空配列バグ & publish_scheduled_date欠落バグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグの存在を示すカウンターサンプルを表面化する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト1（フロントエンド）: `workTasksRes.data` が `{ data: [{property_number: 'AA0001', publish_scheduled_date: '2025-01-01'}], total: 1 }` のとき、`Array.isArray(workTasksRes.data)` が `false` になり `workTasksData` が `[]` になることを検証（Bug Condition: `NOT Array.isArray(workTasksResData) AND workTasksResData HAS PROPERTY 'data'`）
  - テスト2（バックエンド）: `WorkTaskService.list()` の戻り値に `publish_scheduled_date` フィールドが含まれないことを検証（Bug Condition: `NOT selectClause CONTAINS 'publish_scheduled_date'`）
  - テスト3（統合）: `atbb_status` が「一般・公開前」で `publish_scheduled_date` が今日以前の物件が `calculatePropertyStatus()` で「本日公開予定」を返さないことを検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `workTasksData = []`、`publish_scheduled_date = undefined`）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストの作成（修正実装前）
  - **Property 2: Preservation** - 非バグ条件の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ入力の動作を観察する:
    - `publish_scheduled_date` が null の物件 → 「本日公開予定」に表示されないことを観察
    - `publish_scheduled_date` が将来の日付の物件 → 「本日公開予定」に表示されないことを観察
    - `atbb_status` が「公開前」以外の物件 → 既存のステータス判定が適用されることを観察
    - 他のサイドバーカテゴリー（未報告、未完了、公開中など）の物件数が正しく表示されることを観察
  - 観察した動作をキャプチャするプロパティベーステストを作成する（Preservation Requirements より）:
    - テスト1: `publish_scheduled_date` が null または将来の日付の物件のステータスが変わらないことを検証
    - テスト2: 他のサイドバーカテゴリーの物件数が修正前後で変わらないことを検証
    - テスト3: `/api/work-tasks` のレスポンス形式（`{ data, total, limit, offset }`）が変わらないことを検証
    - テスト4: `WorkTaskService.list()` の他のカラム（`id`, `property_number` など）が引き続き返されることを検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作を確認する）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 本日公開予定サイドバーバグの修正

  - [x] 3.1 バックエンド修正: WorkTaskService.list() の SELECT 句に publish_scheduled_date を追加
    - `backend/src/services/WorkTaskService.ts`（約79行目）の `list()` メソッドを修正する
    - 修正前: `...on_hold,created_at,updated_at`
    - 修正後: `...on_hold,created_at,updated_at,publish_scheduled_date`
    - _Bug_Condition: `NOT selectClause CONTAINS 'publish_scheduled_date'`（design.md Bug Condition より）_
    - _Expected_Behavior: `WorkTaskService.list()` の戻り値に `publish_scheduled_date` フィールドが含まれる（design.md Expected Behavior 2.2 より）_
    - _Preservation: 他のSELECTカラム（`id`, `property_number` など）は変更しない（design.md Preservation Requirements より）_
    - _Requirements: 1.2, 2.2, 3.4_

  - [x] 3.2 フロントエンド修正: fetchAllData() のレスポンス処理を修正
    - `frontend/frontend/src/pages/PropertyListingsPage.tsx`（約222行目）の `fetchAllData()` を修正する
    - 修正前: `const workTasksData = Array.isArray(workTasksRes.data) ? workTasksRes.data : [];`
    - 修正後: `const workTasksData = Array.isArray(workTasksRes.data?.data) ? workTasksRes.data.data : [];`
    - _Bug_Condition: `NOT Array.isArray(workTasksResData) AND workTasksResData HAS PROPERTY 'data' AND Array.isArray(workTasksResData.data)`（design.md Bug Condition より）_
    - _Expected_Behavior: `workTasksRes.data.data` が配列であることを確認し、業務依頼データを正しく取得する（design.md Expected Behavior 2.1 より）_
    - _Preservation: `/api/work-tasks` のレスポンス形式（`{ data, total, limit, offset }`）は変更しない（design.md Preservation Requirements より）_
    - _Requirements: 1.1, 2.1, 3.4_

  - [x] 3.3 バグ条件探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - 本日公開予定ステータスの正常表示
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保持テストが引き続き PASS することを確認
    - **Property 2: Preservation** - 非バグ条件の動作保持
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. チェックポイント — 全テストの PASS を確認
  - 全テストが PASS していることを確認する。疑問が生じた場合はユーザーに確認する。
