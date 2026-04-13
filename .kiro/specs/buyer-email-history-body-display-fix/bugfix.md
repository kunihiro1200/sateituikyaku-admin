# Bugfix Requirements Document

## Introduction

買主リスト詳細画面（BuyerDetailPage）の「メール・SMS送信履歴」セクションで、各メール履歴アイテムをクリックしてもメール本文が表示されないバグ。

フロントエンドはクリック時に `activity_logs` テーブルの `metadata.body` を参照してモーダルを開く実装になっているが、バックエンドの `backend/src/routes/gmail.ts` の `/send` エンドポイントが `activityLogService.logEmail()` を呼び出す際に `body` パラメータを渡していない。そのため `metadata.body` が常に `undefined` となり、クリックしても「メール本文が保存されていません（古いメールのため）」という警告が表示されるだけでモーダルが開かない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが買主詳細画面のメール・SMS送信履歴でメールアイテムをクリックする THEN システムはモーダルを開かず「メール本文が保存されていません（古いメールのため）」という警告スナックバーを表示する

1.2 WHEN `backend/src/routes/gmail.ts` の `/send` エンドポイントがメール送信後に `activityLogService.logEmail()` を呼び出す THEN システムは `body` パラメータを渡さずに記録するため `activity_logs.metadata.body` が `undefined` になる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが買主詳細画面のメール・SMS送信履歴でメールアイテムをクリックする THEN システムは `metadata.body` に保存されたメール本文をモーダルで表示する

2.2 WHEN `backend/src/routes/gmail.ts` の `/send` エンドポイントがメール送信後に `activityLogService.logEmail()` を呼び出す THEN システムは `body: bodyText` パラメータを含めて記録し `activity_logs.metadata.body` にメール本文が保存される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーがSMS履歴アイテムをクリックする THEN システムは SMS に対してはモーダルを開かず既存の動作を維持する

3.2 WHEN メール送信が成功する THEN システムは既存通り `email_history` テーブルへの保存・送信成功レスポンスを返す動作を維持する

3.3 WHEN `metadata.body` が存在しない古い履歴アイテムをクリックする THEN システムは「メール本文が保存されていません（古いメールのため）」という警告を表示する既存の動作を維持する

3.4 WHEN メール送信時に添付ファイルがある場合 THEN システムは添付ファイル付き送信の既存の動作を維持する
