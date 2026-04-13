# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - onSendSuccess に body が含まれないバグ
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **GOAL**: バグの存在を示すカウンターサンプルを収集する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - バグ条件: `GmailDistributionButton` の `handleConfirmationConfirm` が `onSendSuccess` を呼び出す際、`body` フィールドが含まれない（`isBugCondition` が true を返す状態）
  - テスト対象: `onSendSuccess` コールバックの引数に `body` プロパティが存在しないこと（修正前は FAIL）
  - テスト対象: `handleGmailDistributionSendSuccess` が `saveSellerSendHistory` を `message: '3件に送信'` のような固定文字列で呼び出すこと（修正前は PASS）
  - テスト対象: `editedBody` に本文が設定されている状態で送信しても、`onSendSuccess` コールバックに本文が含まれないこと（修正前は FAIL）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `onSendSuccess({ successCount: 3, subject: '...', senderAddress: '...' })` に `body` が存在しない）
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.2_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存の送信フローと履歴保存動作が変更されない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（通常メール送信、SMS送信、スナックバー表示など）の動作を観察する
  - 観察: 送信成功後のスナックバーメッセージが `メールを送信しました (N件)\n送信元: ${senderAddress}` であること
  - 観察: `saveSellerSendHistory` が `chat_type: 'seller_gmail'` で呼ばれること
  - 観察: `subject` と `sender_name` が正しく保存されること
  - 観察: `handleSendEmail`・`handleSendSms` の動作が変更されていないこと
  - プロパティベーステストを作成: 任意の `successCount`・`subject`・`senderAddress` の組み合わせに対して、スナックバーメッセージが `successCount` を使用していること（`body` の変更に影響されない）
  - プロパティベーステストを作成: 任意の非バグ条件入力に対して、`chat_type: 'seller_gmail'` が保存されること
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースラインの動作を確認する）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. onSendSuccess body フィールド欠落バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/components/GmailDistributionButton.tsx` を修正する
    - `GmailDistributionButtonProps` の `onSendSuccess` 型に `body: string` フィールドを追加する
    - `handleConfirmationConfirm` 内の `onSendSuccess` 呼び出しに `body: editedBody || replacePlaceholders(selectedTemplate.body, buyerName)` を追加する
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` を修正する
    - `handleGmailDistributionSendSuccess` の引数型に `body: string` フィールドを追加する
    - `saveSellerSendHistory` の `message` フィールドを `\`${result.successCount}件に送信\`` から `result.body` に変更する
    - _Bug_Condition: isBugCondition(input) where input.component = 'GmailDistributionButton' AND input.sendResult.success = true AND input.onSendSuccessPayload.body = undefined_
    - _Expected_Behavior: onSendSuccess が { successCount, subject, senderAddress, body } を含む引数で呼ばれ、saveSellerSendHistory の message フィールドに result.body が保存される_
    - _Preservation: スナックバー表示・chat_type保存・件名/送信者名/送信日時の保存・通常メール/SMSフロー・送信フローは変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - onSendSuccess に body が含まれるようになった
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることが確認される
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存の送信フローと履歴保存動作が変更されない
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テスト（バグ条件探索テスト・保全プロパティテスト）が PASS することを確認する
  - 疑問点があればユーザーに確認する
