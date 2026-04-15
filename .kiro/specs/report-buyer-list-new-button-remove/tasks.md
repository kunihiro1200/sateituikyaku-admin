# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 報告ページで「新規作成」ボタンが常に表示されるバグ
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグの存在を示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - バグ条件: `CompactBuyerListForProperty` に `showCreateButton={false}` を渡しても、プロパティが存在しないためボタンが非表示にならない（design.md の Bug Condition 参照）
  - テスト: `showCreateButton={false}` を渡してコンポーネントをレンダリングし、「新規作成」ボタンが DOM に存在しないことをアサートする
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明する）
  - 見つかった反例を記録する（例: `showCreateButton={false}` を渡しても「新規作成」ボタンが表示される）
  - タスク完了条件: テストを書き、実行し、FAIL を確認・記録したとき
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - showCreateButton 未指定時のデフォルト動作が維持される
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードでバグ条件に該当しない入力（`showCreateButton` 未指定 または `true`）の動作を観察する
  - 観察: `showCreateButton` なしでレンダリング → 「新規作成」ボタンが表示される（未修正コードで確認）
  - 観察: `showCreateButton={true}` でレンダリング → 「新規作成」ボタンが表示される（未修正コードで確認）
  - プロパティベーステスト: `showCreateButton` が `undefined` または `true` の場合、常に「新規作成」ボタンが DOM に存在することをアサートする（design.md の Preservation Requirements 参照）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（保全すべきベースライン動作を確認する）
  - タスク完了条件: テストを書き、実行し、未修正コードで PASS を確認したとき
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 報告ページの「新規作成」ボタン非表示バグを修正する

  - [x] 3.1 修正を実装する
    - `CompactBuyerListForPropertyProps` インターフェースに `showCreateButton?: boolean` を追加する
    - コンポーネントのデストラクチャリングに `showCreateButton = true` を追加する（後方互換性維持）
    - 「新規作成」ボタンを `{showCreateButton && <Button ...>新規作成</Button>}` で条件付きレンダリングにする
    - 報告ページ（`PropertyReportPage`）の `CompactBuyerListForProperty` 呼び出しに `showCreateButton={false}` を追加する
    - _Bug_Condition: isBugCondition(context) where context.page == 'PropertyReportPage' AND context.showCreateButton != false AND createButtonIsRendered(context)_
    - _Expected_Behavior: showCreateButton={false} を渡したとき、「新規作成」ボタンが DOM にレンダリングされない_
    - _Preservation: showCreateButton を渡さない既存の利用箇所ではボタンが引き続き表示される（デフォルト true）_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 報告ページで「新規作成」ボタンが非表示になる
    - **IMPORTANT**: タスク 1 と同じテストを再実行する — 新しいテストを書かない
    - タスク 1 のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク 1 のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - showCreateButton 未指定時のデフォルト動作が維持される
    - **IMPORTANT**: タスク 2 と同じテストを再実行する — 新しいテストを書かない
    - タスク 2 の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
