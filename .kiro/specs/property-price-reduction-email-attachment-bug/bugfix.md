# Bugfix Requirements Document

## Introduction

物件リスト詳細ページの「公開前、値下げメール」配信機能において、確認モーダルで画像を添付して送信しても、受信者のメールに画像が添付されないバグ。

UIでは画像選択・表示が正常に動作しているが、送信処理（`sendEmailsDirectly`）に画像データが渡されておらず、バックエンドのエンドポイントも添付ファイルを受け取る実装になっていないため、画像が無視されて送信される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが確認モーダルで画像を選択して送信ボタンを押す THEN システムは選択された画像を無視してテキストのみのメールを送信する

1.2 WHEN `GmailDistributionButton` の `handleConfirmationConfirm` が実行される THEN システムは `selectedImages` を `gmailDistributionService.sendEmailsDirectly` に渡さない

1.3 WHEN フロントエンドが `/api/property-listings/:propertyNumber/send-distribution-emails` にリクエストを送信する THEN システムは `multipart/form-data` ではなく JSON のみを送信するため、バイナリの画像データを含められない

1.4 WHEN バックエンドの `send-distribution-emails` エンドポイントがリクエストを受け取る THEN システムは `multer` ミドルウェアを使用していないため、添付ファイルを処理できない

### Expected Behavior (Correct)

2.1 WHEN ユーザーが確認モーダルで画像を選択して送信ボタンを押す THEN システムは選択された画像をメールに添付して送信する

2.2 WHEN `GmailDistributionButton` の `handleConfirmationConfirm` が実行される THEN システムは `selectedImages` を含む形で送信処理を呼び出す

2.3 WHEN フロントエンドが送信APIを呼び出す THEN システムは画像データを含む `multipart/form-data` リクエストを送信する

2.4 WHEN バックエンドの `send-distribution-emails` エンドポイントがリクエストを受け取る THEN システムは `multer` ミドルウェアで添付ファイルを処理し、`EmailService.sendDistributionEmail` に渡す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 画像を添付せずに送信する THEN システムは従来通りテキストのみのメールを正常に送信する

3.2 WHEN 複数の受信者に配信する THEN システムは各受信者に個別にメールを送信し、`{buyerName}` プレースホルダーを正しく置換する

3.3 WHEN メール送信が成功する THEN システムは `activity_logs` テーブルへの記録と `onSendSuccess` コールバックの呼び出しを行う

3.4 WHEN 送信に失敗する THEN システムは Gmail Web UI へのフォールバック処理を行う

3.5 WHEN 送信元アドレスを変更する THEN システムは変更されたアドレスから送信する
