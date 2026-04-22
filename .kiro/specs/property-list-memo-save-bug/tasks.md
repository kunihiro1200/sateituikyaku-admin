# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 備忘録保存時の画面白くなる・重複リクエストバグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — 失敗がバグの存在を証明する
  - **修正やコードを直そうとしないこと（テストが失敗しても）**
  - **注意**: このテストは期待される動作をエンコードしている — 修正後にパスすることでバグ解消を確認する
  - **目的**: バグが存在することを示す反例（counterexample）を見つける
  - **スコープ付きPBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - バグ1テスト: `handleSaveNotes` 呼び出し後、`fetchPropertyData` が `silent=false`（引数なし）で呼ばれることを確認
    - バグ2テスト: `handleSaveNotes` を素早く2回呼び出したとき、APIが2回呼ばれることを確認
  - テストのアサーション（design.md の Expected Behavior より）:
    - `fetchPropertyData` は `silent=true` で呼ばれるべき
    - 保存中に2回目のクリックがあってもAPIは1回しか呼ばれないべき
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する（例: `fetchPropertyData` が引数なしで呼ばれた、APIが2回呼ばれた）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 備忘録以外の動作が変更されない
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ入力の動作を観察する:
    - 観察: `special_notes` も `memo` も変更されていない場合、APIが呼ばれないことを確認
    - 観察: 保存成功時に「特記・備忘録を保存しました」スナックバーが表示されることを確認
    - 観察: 保存成功後に `editedData` が空になることを確認
    - 観察: API失敗時に「保存に失敗しました」スナックバーが表示されることを確認
  - 観察した動作パターンを捉えるプロパティベーステストを作成する（design.md の Preservation Requirements より）:
    - 早期リターン保持: `special_notes` も `memo` も変更されていない場合、修正前後ともAPIが呼ばれない
    - スナックバー保持: 保存成功時に正しいメッセージが表示される
    - editedDataクリア保持: 保存成功後に `editedData` が空になる
    - エラー処理保持: API失敗時に正しいエラーメッセージが表示される
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認）
  - テストを作成し、実行し、修正前コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 備忘録保存バグの修正

  - [x] 3.1 修正を実装する
    - `const [notesSaving, setNotesSaving] = useState(false);` を state 定義部分に追加する（`chatSending` などの近く）
    - `handleSaveNotes` の先頭に `if (notesSaving) return;` を追加して重複クリックを防止する
    - API呼び出し前に `setNotesSaving(true)` を追加する
    - `fetchPropertyData()` を `fetchPropertyData(true)` に変更する（`silent=true`）
    - `finally` ブロックで `setNotesSaving(false)` を呼び出す
    - 保存ボタンに `disabled={notesSaving}` を追加する
    - _Bug_Condition: `input.action = 'saveNotes'` かつ `fetchPropertyData` が `silent=false` で呼ばれる、または `saving` フラグが存在しない（design.md より）_
    - _Expected_Behavior: `fetchPropertyData(true)` で呼び出し、`notesSaving` フラグで重複クリックを防止し、保存完了後にフラグをリセットする（design.md より）_
    - _Preservation: 締切日フィールド・モーダルの保存処理・備忘録以外のセクションの保存ハンドラー・早期リターン動作・スナックバー表示・editedDataクリアは変更しない（design.md より）_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 備忘録保存時の画面白くなる・重複リクエストバグ
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 備忘録以外の動作が変更されない
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストがパスすることを確認する
  - 全テストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。
