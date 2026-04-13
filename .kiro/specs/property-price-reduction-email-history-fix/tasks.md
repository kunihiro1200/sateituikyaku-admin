# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 値下げ配信メール送信成功時に履歴が保存されない
  - **重要**: このテストは未修正コードで**失敗する**こと — 失敗がバグの存在を証明する
  - **修正やコードを変更しないこと** — テストが失敗しても修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 修正後にパスすることで修正を検証する
  - **目的**: バグの存在を示す反例を生成する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - `GmailDistributionButton` の `handleConfirmationConfirm` をモックして `gmailDistributionService.sendEmailsDirectly` が `{ success: true, successCount: 3 }` を返した後、`saveSellerSendHistory` が呼ばれないことを確認
    - `onSendSuccess` コールバックが存在しないため、`saveSellerSendHistory` は一度も呼ばれない
  - テストアサーション（design.md の Expected Behavior より）:
    - `saveSellerSendHistory` が `chat_type: 'seller_gmail'` で呼ばれること
    - `property_chat_history` に対応するレコードが存在すること
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**失敗**する（バグの存在を証明）
  - 発見した反例を記録する（例: 「`sendEmailsDirectly` 成功後に `saveSellerSendHistory` が呼ばれない」）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存の `seller_email` / `seller_sms` 送信履歴保存処理が継続して動作する
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`seller_email`、`seller_sms` の送信処理）の動作を観察する:
    - 観察: `handleSendEmail` が送信成功後に `saveSellerSendHistory(chat_type: 'seller_email')` を呼び出す
    - 観察: `handleSendSms` が送信成功後に `saveSellerSendHistory(chat_type: 'seller_sms')` を呼び出す
    - 観察: 送信失敗時は `saveSellerSendHistory` が呼ばれない
  - 観察した動作パターンをキャプチャするプロパティベーステストを作成する（design.md の Preservation Requirements より）:
    - 任意の `seller_email` 送信成功に対して `saveSellerSendHistory(chat_type: 'seller_email')` が呼ばれること
    - 任意の `seller_sms` 送信成功に対して `saveSellerSendHistory(chat_type: 'seller_sms')` が呼ばれること
    - 任意の送信失敗ケースに対して `saveSellerSendHistory` が呼ばれないこと
    - `GmailDistributionButton` の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）が変更されていないこと
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**パス**する（保全すべきベースライン動作を確認）
  - テストを作成し、実行し、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 値下げ配信メール送信履歴未保存バグの修正

  - [x] 3.1 `GmailDistributionButton.tsx` に `onSendSuccess` コールバックプロップを追加する
    - `GmailDistributionButtonProps` インターフェースに `onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string }) => void` を追加する
    - `handleConfirmationConfirm` 内の `result.success` または `result.successCount > 0` の成功時処理で `onSendSuccess?.({...})` を呼び出す
    - 既存の `setSnackbar` 処理はそのまま維持する
    - _Bug_Condition: `GmailDistributionButton` 経由でメール送信が成功したにもかかわらず `property_chat_history` への保存処理が実行されない（`input.component = 'GmailDistributionButton' AND input.sendResult.success = true`）_
    - _Expected_Behavior: `onSendSuccess` コールバックが呼ばれ、親コンポーネントが `saveSellerSendHistory(chat_type: 'seller_gmail')` を実行する_
    - _Preservation: `seller_email` / `seller_sms` の送信処理、`GmailDistributionButton` の送信フロー自体は変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 `PropertyListingDetailPage.tsx` に `handleGmailDistributionSendSuccess` ハンドラを追加する
    - `handleGmailDistributionSendSuccess` 関数を定義し、`saveSellerSendHistory` を `chat_type: 'seller_gmail'` で呼び出す
    - 保存パラメータ: `subject: result.subject`、`message: \`${result.successCount}件に送信\``、`sender_name: employee?.name || employee?.initials || '不明'`
    - 履歴保存後に `setSellerSendHistoryRefreshTrigger(prev => prev + 1)` を呼び出して左列の表示を更新する
    - `saveSellerSendHistory` 失敗時はエラーをコンソールに記録し、UIには影響させない
    - `GmailDistributionButton` の使用箇所に `onSendSuccess={handleGmailDistributionSendSuccess}` を追加する
    - _Bug_Condition: `GmailDistributionButton` に `onSendSuccess` コールバックが存在しないため親コンポーネントが送信成功を検知できない_
    - _Expected_Behavior: 送信成功後に `property_chat_history` テーブルに `chat_type: 'seller_gmail'`、`property_number`、`subject`、`sender_name` を含むレコードが1件保存される_
    - _Preservation: `handleSendEmail`（`seller_email`）と `handleSendSms`（`seller_sms`）の既存処理は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが修正後にパスすることを確認する
    - **Property 1: Expected Behavior** - 値下げ配信メール送信成功時に履歴が保存される
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**パス**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 既存の送信履歴保存処理が継続して動作する
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを作成しない
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが**パス**する（リグレッションがないことを確認）
    - すべてのテストが修正後もパスすることを確認する

- [x] 4. チェックポイント — すべてのテストがパスすることを確認する
  - すべてのテストがパスすることを確認する。疑問点があればユーザーに確認する。
