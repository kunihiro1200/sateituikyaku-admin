# バグ修正要件ドキュメント

## はじめに

買主リストの内覧前日メール（☆内覧前日通知メール）を送信した後、`notification_sender`（通知送信者）フィールドに送信したアカウントのイニシャルが自動設定されるべきところ、「業者」という誤った値が保存されてしまうバグ。

コンソールログに `"Saving field: notification_sender, value: 業者"` が出力されており、`tomokoのアカウント`でログインして送信しても「業者」がセットされる。

対象コンポーネント: `BuyerViewingResultPage.tsx` の `onEmailSent` コールバック → `/api/employees/initials-by-email` エンドポイント

## バグ分析

### 現在の動作（不具合）

1.1 WHEN ログインユーザー（例: tomokoのアカウント）が内覧前日メールを送信する THEN システムは `notification_sender` フィールドに「業者」という値を保存する

1.2 WHEN `onEmailSent` コールバックが実行される THEN システムは `/api/employees/initials-by-email` から「業者」を取得し、それを `notification_sender` に保存する

1.3 WHEN `initials-by-email` エンドポイントがログインユーザーのメールアドレスで `employees` テーブルまたはスプレッドシートのスタッフシートを検索する THEN システムは正しいイニシャルではなく「業者」を返す

### 期待される動作（正常）

2.1 WHEN ログインユーザーが内覧前日メールを送信する THEN システムは SHALL `notification_sender` フィールドにそのユーザーの正しいイニシャル（例: 「T」「tomoko」など）を保存する

2.2 WHEN `onEmailSent` コールバックが実行される THEN システムは SHALL `/api/employees/initials-by-email` からログインユーザーの正しいイニシャルを取得し、`notification_sender` に保存する

2.3 WHEN `initials-by-email` エンドポイントがログインユーザーのメールアドレスで検索する THEN システムは SHALL そのユーザーの正しいイニシャルを返す

### 変更されない動作（リグレッション防止）

3.1 WHEN `notification_sender` が既に入力済みの買主に対して内覧前日メールを送信する THEN システムは SHALL CONTINUE TO 既存の `notification_sender` の値を上書きする（現在の仕様通り）

3.2 WHEN 内覧前日メール以外の操作（内覧日・内覧結果・フォローアップ担当の更新など）を行う THEN システムは SHALL CONTINUE TO `notification_sender` フィールドを変更しない

3.3 WHEN `broker_inquiry` が「業者問合せ」の買主に対して内覧前日ボタンが非表示になる THEN システムは SHALL CONTINUE TO その条件判定を正しく行う

3.4 WHEN `notification_sender` が入力済みの買主に対して内覧日前日ステータスを計算する THEN システムは SHALL CONTINUE TO その買主を「内覧日前日」カテゴリーから除外する
