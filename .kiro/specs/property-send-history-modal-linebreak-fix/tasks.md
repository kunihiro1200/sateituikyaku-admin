# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - `<br>` タグがプレーンテキストとして表示されるバグ
  - **CRITICAL**: このテストは未修正コードで FAIL する — FAIL することでバグの存在が証明される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正が正しいことを確認する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `item.message = "村尾和彦様<br>お世話になっております。"` を渡してレンダリング
    - DOMに `<br>` 要素（HTMLタグ）が存在することを確認（現在はテキストノードとして `<br>` 文字列が存在する）
    - `item.message = "行1<br><br>行3"` でも同様に確認
  - Bug Condition（`isBugCondition`）: `message.includes('<br>')` かつ `{item.message}` テキストノードとして描画されている
  - Expected Behavior: `<br>` がHTMLの改行要素としてレンダリングされ、テキストとして `<br>` 文字列が表示されない
  - `SellerSendHistoryDetailModal` に `<br>` を含む `item.message` を渡してレンダリングし、DOMを検査する
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テスト FAILS（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `<br>` がテキストノードとして表示される）
  - テストを書き、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - `<br>` を含まないメッセージおよびモーダル他要素の動作保全
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false の入力）の動作を観察する
    - Observe: `item.message = "改行なしのメッセージ"` → 正常にテキストとして表示される
    - Observe: `item.message = ""` → 空表示（エラーなし）
    - Observe: `item.subject`, `item.sender_name`, `item.sent_at` → 変更なく表示される
  - プロパティベーステストを作成: `<br>` を含まない任意の文字列で、修正前後の表示が同一であることを検証
  - `<br>` を含まないランダムな文字列を生成し、レンダリング結果が変わらないことを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASSES（これがベースライン動作を確認する）
  - テストを書き、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for `<br>` タグがHTMLとして解釈されないバグ

  - [x] 3.1 Implement the fix
    - `dompurify` パッケージをインストール: `npm install dompurify @types/dompurify`（`frontend/frontend/` ディレクトリで実行）
    - `SellerSendHistoryDetailModal.tsx` の先頭に `import DOMPurify from 'dompurify'` を追加
    - `sanitizeMessage` 関数を追加: `DOMPurify.sanitize(message, { ALLOWED_TAGS: ['br'], ALLOWED_ATTR: [] })`
    - 本文表示部分を `{item.message}` テキストノードから `dangerouslySetInnerHTML={{ __html: sanitizeMessage(item.message) }}` に変更
    - `whiteSpace: 'pre-wrap'` を削除（`dangerouslySetInnerHTML` と組み合わせると `<br>` と `\n` が二重改行になるため）
    - `dangerouslySetInnerHTML` 使用時は子要素を持てないため `{item.message}` テキストノードを削除する
    - _Bug_Condition: `isBugCondition(message)` = `message.includes('<br>')` かつテキストノードとして描画_
    - _Expected_Behavior: `<br>` がHTMLの改行要素としてレンダリングされ、テキストが複数行に分かれて表示される_
    - _Preservation: `<br>` を含まないメッセージ・件名・送信者・送信日時の表示は変更しない。`<script>` 等の危険なタグはサニタイズする_
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - `<br>` タグがHTML改行としてレンダリングされる
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることが確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認）
    - _Requirements: 2.1_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - `<br>` を含まないメッセージおよびモーダル他要素の動作保全
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
