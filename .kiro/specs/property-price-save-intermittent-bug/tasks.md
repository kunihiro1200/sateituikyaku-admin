# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 価格保存スキップ時に編集モードが誤終了するバグ
  - **重要**: このテストは未修正コードで必ず FAIL する — FAIL することがバグの存在を証明する
  - **修正を試みないこと** — テストが失敗しても、コードを修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目標**: バグが存在することを示すカウンターサンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `handleSavePrice` が `editedData` 空または `price` キーなしの場合に例外をスローしないこと（Bug Condition: `Object.keys(editedData).length === 0 OR NOT priceFieldPresent`）
  - テスト内容:
    - `editedData = {}` の状態で `handleSavePrice` を呼び出す → 例外がスローされないことを確認（未修正コードで PASS = バグの証明）
    - `EditableSection.handleSave` が例外なしで `onSave` が完了した場合に `onEditToggle()` を呼び出すことを確認
    - `editedData = { atbb_status: '公開中' }` の状態（price キーなし）で `handleSavePrice` を呼び出す → 例外がスローされないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `editedData={}` で `handleSavePrice` が例外なしに早期リターンし、`onEditToggle()` が呼ばれて編集モードが終了する）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 正常な価格保存フローの維持
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`editedData` に `price` キーが含まれるケース）の動作を観察する
  - 観察内容:
    - `editedData = { price: 5000 }` で `handleSavePrice` を呼び出す → API が呼ばれ成功メッセージが表示されることを確認
    - `editedData = { price: 3000, price_reduction_history: [...] }` で保存 → 値下げ履歴が自動追記されることを確認
    - キャンセルボタン押下 → `editedData` がリセットされ編集モードが終了することを確認
  - プロパティベーステストを作成: `price` キーを含む任意の `editedData` に対して、`handleSavePrice` が API を呼び出し成功メッセージを表示することを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 価格保存間欠的失敗バグの修正

  - [x] 3.1 `handleSavePrice` の早期リターンを例外スローに変更する
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `handleSavePrice` 関数を修正する
    - `editedData` が空の場合、または `price` キーが含まれない場合に `return` ではなく `throw new Error('no_changes')` を使用する
    - 修正前: `if (!propertyNumber || Object.keys(editedData).length === 0) return;`
    - 修正後: `if (!propertyNumber) return;` + `if (Object.keys(editedData).length === 0 || !('price' in editedData)) { throw new Error('no_changes'); }`
    - _Bug_Condition: `Object.keys(editedData).length === 0 OR NOT ('price' in editedData)` — 保存ボタン押下時に editedData が空または price キーを含まない状態_
    - _Expected_Behavior: 例外をスローして EditableSection に保存が行われなかったことを伝え、編集モードを維持する_
    - _Preservation: `editedData` に `price` キーが含まれる正常ケースは完全に影響を受けない_
    - _Requirements: 2.2, 2.4_

  - [x] 3.2 `EditableSection` の catch ブロックで `no_changes` エラーを適切に処理する
    - `frontend/frontend/src/components/EditableSection.tsx` の `handleSave` 関数を修正する
    - `error.message === 'no_changes'` の場合はエラーログを出力せず、編集モードを維持する（`onEditToggle()` を呼ばない）
    - その他のエラーは従来通り `console.error` でログ出力し、編集モードを維持する
    - _Bug_Condition: `onSave` が例外なしで完了した場合に `onEditToggle()` が呼ばれて編集モードが誤終了する_
    - _Expected_Behavior: `no_changes` エラーを受け取った場合、静かに編集モードを維持する_
    - _Preservation: 正常な保存成功時（例外なし）は従来通り `onEditToggle()` を呼び出して編集モードを終了する_
    - _Requirements: 2.4, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 価格保存スキップ時の編集モード維持
    - **重要**: タスク 1 と同じテストを再実行する — 新しいテストを作成しない
    - タスク 1 のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク 1 のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.2, 2.4_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 正常な価格保存フローの維持
    - **重要**: タスク 2 と同じテストを再実行する — 新しいテストを作成しない
    - タスク 2 の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全ての保全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク 1 のバグ条件探索テストが PASS することを確認する
  - タスク 2 の保全プロパティテストが PASS することを確認する
  - 疑問点があればユーザーに確認する
