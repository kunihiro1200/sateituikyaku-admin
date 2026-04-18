# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 送信テキストが4096文字を超えるとき切り捨てが不正確
  - **CRITICAL**: このテストは未修正コードで必ずFAILする — FAILはバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエグザンプルを見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `handleSendPriceReductionChat` 内の切り捨てロジック（`fullText.length > 4000` の条件）
  - バグ条件: `fullText`（`chatMessageBody` + `imageUrlLine`）が4096文字を超える場合
  - 具体的なテストケース:
    - `chatMessageBody` が4094文字 + `imageUrlLine` が5文字 → `fullText` = 4099文字
    - 現在のコード: `fullText.substring(0, 4000) + '...'` = 4003文字（4096文字以内だが閾値が不正確）
    - `chatMessageBody` が4001文字（画像URLなし）→ 現在のコードは `> 4000` で切り捨て → 4003文字（意図が不明確）
  - テストアサーション（期待される正しい動作）:
    - `truncatedText.length <= 4096` が常に成立すること
    - `fullText.length > 4096` の場合、`truncatedText.endsWith('...')` が成立すること
    - `fullText.length > 4096` の場合、`truncatedText.length === 4096` が成立すること（4093文字 + `'...'`）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストFAIL（これが正しい — バグの存在を証明する）
  - 見つかったカウンターエグザンプルを記録して根本原因を理解する
  - テストを書き、実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを書く（修正実装前に）
  - **Property 2: Preservation** - 4096文字以内のメッセージは切り捨てなしにそのまま送信される
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ入力（`fullText.length <= 4096`）の動作を観察する:
    - 観察: `chatMessageBody` が100文字（画像URLなし）→ `fullText` = 100文字 → そのまま送信
    - 観察: `chatMessageBody` が4096文字（画像URLなし）→ `fullText` = 4096文字 → そのまま送信
    - 観察: `chatMessageBody` が4000文字 + `imageUrlLine` が90文字 → `fullText` = 4090文字 → そのまま送信
    - 観察: `chatMessageBody` が空文字（画像URLなし）→ `fullText` = 空文字 → そのまま送信
  - プロパティベーステストを書く: `fullText.length <= 4096` のすべての入力に対して `truncatedText === fullText` が成立すること
  - テストケース:
    - ランダムな長さ（0〜4096文字）の `chatMessageBody` と `selectedImageUrl` を生成し、`fullText.length <= 4096` の場合に `truncatedText === fullText` を検証
    - 4096文字ちょうどのメッセージが切り捨てなしに送信されることを確認
    - 画像URLなしのメッセージが正しく処理されることを確認
    - 画像URLありで合計4096文字以内のメッセージが切り捨てなしに送信されることを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストPASS（これがベースラインの動作を確認する）
  - テストを書き、実行し、PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 切り捨てロジックの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/components/PriceSection.tsx` の `handleSendPriceReductionChat` 関数を修正する
    - マジックナンバーを定数化する:
      - `const GOOGLE_CHAT_LIMIT = 4096;`
      - `const TRUNCATE_SUFFIX = '...';`
      - `const SAFE_LIMIT = GOOGLE_CHAT_LIMIT - TRUNCATE_SUFFIX.length; // 4093`
    - 切り捨て条件を `fullText.length > 4000` から `fullText.length > GOOGLE_CHAT_LIMIT` に変更する
    - 切り捨てロジックを `fullText.substring(0, SAFE_LIMIT) + TRUNCATE_SUFFIX` に変更する
    - 修正後: `fullText.substring(0, 4093) + '...'` = 必ず4096文字以内
    - _Bug_Condition: `fullText`（`chatMessageBody` + `imageUrlLine`）が4096文字を超える場合_
    - _Expected_Behavior: `truncatedText.length <= 4096` かつ `fullText.length > 4096` の場合は `truncatedText.endsWith('...')` かつ `truncatedText.length === 4096`_
    - _Preservation: `fullText.length <= 4096` の場合は `truncatedText === fullText`（切り捨てなし）_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが今度はPASSすることを確認する
    - **Property 1: Expected Behavior** - 送信テキストが確実に4096文字以内に収まる
    - **IMPORTANT**: タスク1で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストPASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保持テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - 4096文字以内のメッセージは切り捨てなしにそのまま送信される
    - **IMPORTANT**: タスク2で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストPASS（リグレッションがないことを確認する）
    - 修正後もすべてのテストがPASSすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — すべてのテストがPASSすることを確認する
  - すべてのテストがPASSすることを確認する。疑問が生じた場合はユーザーに確認する。
