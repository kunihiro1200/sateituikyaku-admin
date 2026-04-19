# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - モーダルオープン時の不当な警告表示
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
    - ケース1: `site_registration_due_date` が締日を超過しているデータで `open=true` にした時、`warningDialog.open` が `false` であることをアサート（修正前は `true` になる = バグ再現）
    - ケース2: `fetchData` 完了後に `warningDialog.open` が `false` であることをアサート（修正前は `true` になる = バグ再現）
  - バグ条件（`isBugCondition`）: `event.type IN ['modal_open', 'fetch_complete']` かつ `site_registration_due_date` または `floor_plan_due_date` が締日を超過している
  - 期待される動作（`expectedBehavior`）: `warningDialog.open = false`（モーダルオープン・データ取得時は警告を表示しない）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見されたカウンターサンプルを記録して根本原因を理解する
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - `handleFieldChange` 経由の日付変更時の警告表示
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`handleFieldChange` 経由の日付変更）を観察する
    - 観察1: `site_registration_due_date` に締日超過の日付を入力 → `warningDialog.open = true` になる
    - 観察2: `floor_plan_due_date` に締日超過の日付を入力 → `warningDialog.open = true` になる
    - 観察3: 締日以内の日付を入力 → `warningDialog.open = false` のまま
    - 観察4: 警告ポップアップの「確認しました」ボタンで `warningDialog.open = false` になる
  - 観察した動作パターンをキャプチャするプロパティベーステストを作成する
    - プロパティ: `handleFieldChange` 経由で締日超過の日付を入力した場合、常に `warningDialog.open = true` になる
    - プロパティ: `handleFieldChange` 経由で締日以内の日付を入力した場合、常に `warningDialog.open = false` のまま
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを作成し、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 締日超過警告ポップアップの不当表示バグを修正する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` を編集する
    - `useEffect` 内の `checkDeadlineOnLoad(taskData)` 呼び出しを削除する
    - `fetchData()` 内の `checkDeadlineOnLoad(response.data)` 呼び出しを削除する
    - `handleFieldChange` のロジックは変更しない（締日チェックは維持する）
    - `checkDeadlineOnLoad` 関数定義はデッドコードとなるが、削除は任意
    - _Bug_Condition: `isBugCondition(event)` — `event.type IN ['modal_open', 'fetch_complete']` かつ締日超過データが存在する場合_
    - _Expected_Behavior: `warningDialog.open = false` — モーダルオープン・データ取得時は警告を表示しない_
    - _Preservation: `handleFieldChange` 経由の日付変更時の締日チェックと警告表示は維持する_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - モーダルオープン時に警告が表示されない
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることが確認される
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - `handleFieldChange` 経由の日付変更時の警告表示
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後もすべてのテストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — すべてのテストが PASS することを確認する
  - すべてのテストが PASS していることを確認する。疑問が生じた場合はユーザーに確認する。
