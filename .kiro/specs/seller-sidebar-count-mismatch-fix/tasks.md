# 実装計画

- [ ] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 林田担当者の未報告ラベル不一致バグ
  - **重要**: このテストは未修正コードで **FAIL** すること — 失敗がバグの存在を証明する
  - **修正前にコードを直そうとしないこと**
  - **注意**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示す反例を発見する
  - **スコープ限定PBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テストファイル: `frontend/frontend/src/__tests__/seller-sidebar-count-mismatch-bug-exploration.test.ts`
  - テストフレームワーク: Jest + fast-check（`frontend/frontend/jest.config.js` 参照）
  - バグ条件（design.md の `isBugCondition` より）:
    - `report_assignee = '林田'` かつ `report_date` が今日以前（null でない）
  - テスト内容:
    - `getAssigneeInitial('林田')` が `'林田'` を返すことを確認（未修正コードでのバグ動作）
    - `report_assignee='林田'`、`report_date=昨日` の物件で `calculatePropertyStatus` が `label.replace(/\s+/g, '') === '未報告林田'` を返すことを確認
    - fast-check で `report_date` を過去日付として生成し、`getAssigneeInitial('林田')` が `'林'` を返さないことを確認
  - テストを未修正コードで実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見した反例を記録する（例: `getAssigneeInitial('林田')` が `'林'` ではなく `'林田'` を返す）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存担当者イニシャル変換の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - テストファイル: `frontend/frontend/src/__tests__/seller-sidebar-count-mismatch-preservation.test.ts`
  - テストフレームワーク: Jest + fast-check（`frontend/frontend/jest.config.js` 参照）
  - 未修正コードで非バグ条件の入力（`report_assignee !== '林田'`）の動作を観察する:
    - `getAssigneeInitial('山本')` → `'Y'`
    - `getAssigneeInitial('生野')` → `'生'`
    - `getAssigneeInitial('久')` → `'久'`
    - `getAssigneeInitial('裏')` → `'U'`
    - `getAssigneeInitial('林')` → `'林'`
    - `getAssigneeInitial('国広')` → `'K'`
    - `getAssigneeInitial('木村')` → `'R'`
    - `getAssigneeInitial('角井')` → `'I'`
    - `getAssigneeInitial(null)` → `''`
    - `getAssigneeInitial('')` → `''`
    - `getAssigneeInitial('未知の担当者')` → `'未知の担当者'`（フォールバック）
  - 観察した動作をプロパティベーステストとして記述する（design.md の Preservation Requirements より）
  - fast-check で既存8担当者名をランダムに選択し、各イニシャル変換が正しいことを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認する）
  - テストを作成・実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. 「林田」担当者の未報告ラベル不一致バグを修正する

  - [ ] 3.1 修正を実装する
    - ファイル: `frontend/frontend/src/utils/propertyListingStatusUtils.ts`
    - 関数: `getAssigneeInitial`
    - `initialMap` に `'林田': '林'` を追加する（`'林': '林'` の直後）
    - 変更前:
      ```typescript
      '林': '林',
      '国広': 'K',
      ```
    - 変更後:
      ```typescript
      '林': '林',
      '林田': '林',
      '国広': 'K',
      ```
    - _Bug_Condition: `isBugCondition(X)` — `X.report_assignee = '林田'` かつ `X.report_date IS NOT NULL` かつ `X.report_date <= today`_
    - _Expected_Behavior: `getAssigneeInitial('林田')` が `'林'` を返し、`calculatePropertyStatus` のラベルが `'未報告 林'` となる_
    - _Preservation: `'林田'` 以外の全担当者のイニシャル変換・null/空文字フォールバック・未知担当者フォールバックは変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 林田担当者の未報告ラベル正規化
    - **重要**: タスク1で作成した **同じテスト** を再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされたことを確認できる
    - `seller-sidebar-count-mismatch-bug-exploration.test.ts` を実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存担当者イニシャル変換の動作保持
    - **重要**: タスク2で作成した **同じテスト** を再実行する — 新しいテストを書かないこと
    - `seller-sidebar-count-mismatch-preservation.test.ts` を実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [ ] 4. チェックポイント — 全テストが PASS することを確認する
  - `seller-sidebar-count-mismatch-bug-exploration.test.ts` と `seller-sidebar-count-mismatch-preservation.test.ts` の両方が PASS することを確認する
  - 実行コマンド: `npx jest seller-sidebar-count-mismatch --no-coverage` （`frontend/frontend` ディレクトリで実行）
  - 疑問点があればユーザーに確認する
