# Bugfix Requirements Document

## Introduction

物件リスト詳細ページの「売主への送信履歴」セクションで、値下げ配信メール（GMAIL）の送信履歴をクリックして「送信履歴詳細」モーダルを開くと、本文欄に実際のメール本文ではなく「N件に送信」という文字列が表示されるバグを修正する。

根本原因は `GmailDistributionButton` コンポーネントの `onSendSuccess` コールバックに実際のメール本文（`body`）が含まれていないため、親コンポーネント（`PropertyListingDetailPage`）の `handleGmailDistributionSendSuccess` が本文を取得できず、代わりに `${result.successCount}件に送信` という文字列を `message` フィールドとして保存していることにある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 値下げ配信メール（GMAIL）を送信した後に送信履歴一覧から該当レコードをクリックして「送信履歴詳細」モーダルを開く THEN the system は本文欄に「N件に送信」（例：「1件に送信」）という文字列を表示する

1.2 WHEN `GmailDistributionButton` の `handleConfirmationConfirm` が送信成功後に `onSendSuccess` コールバックを呼び出す THEN the system は `{ successCount, subject, senderAddress }` のみを渡し、実際のメール本文（`body`）を含めない

1.3 WHEN `PropertyListingDetailPage` の `handleGmailDistributionSendSuccess` が `saveSellerSendHistory` を呼び出す THEN the system は `message` フィールドに `${result.successCount}件に送信` という固定文字列を保存する

### Expected Behavior (Correct)

2.1 WHEN 値下げ配信メール（GMAIL）を送信した後に送信履歴一覧から該当レコードをクリックして「送信履歴詳細」モーダルを開く THEN the system SHALL 本文欄に実際に送信されたメールの本文テキストを表示する

2.2 WHEN `GmailDistributionButton` の `handleConfirmationConfirm` が送信成功後に `onSendSuccess` コールバックを呼び出す THEN the system SHALL `{ successCount, subject, senderAddress, body }` を渡し、実際のメール本文を含める

2.3 WHEN `PropertyListingDetailPage` の `handleGmailDistributionSendSuccess` が `saveSellerSendHistory` を呼び出す THEN the system SHALL `message` フィールドに `result.body`（実際のメール本文）を保存する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 値下げ配信メール（GMAIL）を送信する THEN the system SHALL CONTINUE TO 送信成功後にスナックバーで「メールを送信しました (N件)」を表示する

3.2 WHEN 値下げ配信メール（GMAIL）を送信する THEN the system SHALL CONTINUE TO `property_chat_history` テーブルに `chat_type: 'seller_gmail'` でレコードを保存する

3.3 WHEN 値下げ配信メール（GMAIL）を送信する THEN the system SHALL CONTINUE TO 送信履歴の件名（`subject`）・送信者名（`sender_name`）・送信日時（`sent_at`）を正しく保存・表示する

3.4 WHEN 通常メール（EMAIL）またはSMSを送信する THEN the system SHALL CONTINUE TO 本文を正しく保存・表示する（既存の `seller_email` / `seller_sms` の動作は変更しない）

3.5 WHEN `GmailDistributionButton` の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）を実行する THEN the system SHALL CONTINUE TO 既存の送信フローが正常に動作する
