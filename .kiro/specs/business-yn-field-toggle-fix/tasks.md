# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 同値再クリックでトグル解除されないバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - ケース1: `getValue(field)` が `'Y'` を返す状態で「Y」ボタンをクリック → `handleFieldChange` が `null` で呼ばれることを期待するが、未修正コードでは `'Y'` で呼ばれる
    - ケース2: `getValue(field)` が `'N'` を返す状態で「N」ボタンをクリック → `handleFieldChange` が `null` で呼ばれることを期待するが、未修正コードでは `'N'` で呼ばれる
  - `EditableYesNo` コンポーネントをレンダリングし、選択済み状態から同じボタンをクリックした際に `handleFieldChange` が `null` で呼ばれることをアサートする
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `handleFieldChange('Y')` が呼ばれ `handleFieldChange(null)` が呼ばれない）
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 異なる値クリック・未選択からの選択の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false を返すケース）の動作を観察する：
    - 観察1: `null` 状態で「Y」クリック → `handleFieldChange(field, 'Y')` が呼ばれる
    - 観察2: `null` 状態で「N」クリック → `handleFieldChange(field, 'N')` が呼ばれる
    - 観察3: `'Y'` 状態で「N」クリック → `handleFieldChange(field, 'N')` が呼ばれる
    - 観察4: `'N'` 状態で「Y」クリック → `handleFieldChange(field, 'Y')` が呼ばれる
  - プロパティベーステストを作成: 現在値と異なるボタンをクリックした場合、または未選択状態からクリックした場合、クリックした値がそのまま `handleFieldChange` に渡されることを検証する
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 3. Y/N選択フィールド トグル解除バグの修正

  - [x] 3.1 トグルロジックを実装する
    - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の `EditableYesNo` コンポーネント（行487付近）を修正する
    - 「Y」ボタンの `onClick` を変更:
      - 変更前: `onClick={() => handleFieldChange(field, 'Y')}`
      - 変更後: `onClick={() => handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y')}`
    - 「N」ボタンの `onClick` を変更:
      - 変更前: `onClick={() => handleFieldChange(field, 'N')}`
      - 変更後: `onClick={() => handleFieldChange(field, getValue(field) === 'N' ? null : 'N')}`
    - 変更箇所は2行のみ、他のロジックへの影響なし
    - _Bug_Condition: isBugCondition(input) — currentValue === clickedValue AND currentValue IS NOT NULL_
    - _Expected_Behavior: handleFieldChange(field, null) が呼ばれ、ボタンが outlined スタイルで表示される_
    - _Preservation: 未選択からの選択・異なる値への切り替え・保存処理は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 同値再クリックによるトグル解除
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS することで、期待動作が満たされていることが確認される
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 異なる値クリック・未選択からの選択の動作保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストの PASS を確認する
  - 全テスト（バグ条件テスト・保全テスト）が PASS していることを確認する
  - 疑問点があればユーザーに確認する
