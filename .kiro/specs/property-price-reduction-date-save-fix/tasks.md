# Implementation Plan

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 価格フィールド以外の変更が保存されないバグ
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `handleSavePrice` 関数（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
  - バグ条件: `editedData` に `price` キーが含まれないが、少なくとも1つのキーが含まれる場合（`isBugCondition` が true）
  - テストケース1: `editedData = { price_reduction_scheduled_date: '2026-05-01' }` → 未修正コードでは `no_changes` エラーがスローされる（期待: 保存が実行される）
  - テストケース2: `editedData = { price_reduction_history: '4/17 5000万→4800万' }` → 未修正コードでは `no_changes` エラーがスローされる（期待: 保存が実行される）
  - テストケース3: `editedData = { price_reduction_scheduled_date: '2026-05-01', price_reduction_history: '...' }` → 未修正コードでは `no_changes` エラーがスローされる（期待: 保存が実行される）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `{ price_reduction_scheduled_date: '2026-05-01' }` で `no_changes` エラーがスローされる）
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存の正常動作が維持されること
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false のケース）の動作を観察する
  - 観察1: `editedData = { price: 48000000 }` → 未修正コードで保存が正常に実行され、値下げ履歴が自動追記される
  - 観察2: `editedData = {}` → 未修正コードで `no_changes` エラーがスローされる
  - 観察3: `editedData = { price: 48000000, price_reduction_scheduled_date: '2026-05-01' }` → 未修正コードで正常に保存される
  - 観察した動作パターンを捉えるプロパティベーステストを作成する（Preservation Requirements より）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これにより保持すべきベースライン動作が確認される）
  - テストを作成し、実行し、未修正コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. `handleSavePrice` のバグ修正

  - [x] 3.1 誤った条件チェックを削除する
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `handleSavePrice` 関数を修正する
    - 修正前: `if (Object.keys(editedData).length === 0 || !('price' in editedData)) {`
    - 修正後: `if (Object.keys(editedData).length === 0) {`
    - `!('price' in editedData)` という誤った条件を削除し、`editedData` が空の場合のみ `no_changes` エラーをスローするよう修正する
    - 値下げ履歴の自動追記ロジック（`newSalesPrice !== undefined` チェック）はそのまま維持する
    - _Bug_Condition: `Object.keys(editedData).length > 0 AND NOT ('price' in editedData)` の場合にバグが発動_
    - _Expected_Behavior: `editedData` が空でなければ変更内容をDBに保存し、「価格情報を保存しました」のスナックバーを表示する_
    - _Preservation: 売買価格変更時の保存・値下げ履歴自動追記・変更なし時の保存スキップは維持する_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 価格フィールド以外の変更も保存される
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることが確認される
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存の正常動作が維持されること
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後もすべてのテストが PASS することを確認する（リグレッションなし）

- [x] 4. デプロイ（git commit & push）
  - すべてのテストが PASS していることを確認する
  - 変更をコミットする: `git add frontend/frontend/src/pages/PropertyListingDetailPage.tsx`
  - コミットメッセージ: `fix: handleSavePrice - remove incorrect price key check to allow saving non-price fields`
  - `git push` でリモートにプッシュする
  - Vercel の自動デプロイを確認する
  - 疑問が生じた場合はユーザーに確認する
