# バグ修正要件ドキュメント

## はじめに

物件リスト詳細画面（`PropertyListingDetailPage`）の「公開前、値下げメール」ボタン（`GmailDistributionButton`コンポーネント）からメールを送信した際、送信履歴が `property_chat_history` テーブルに保存されない。

その結果、物件詳細画面の左列に表示される「売主への送信履歴」（`SellerSendHistory`コンポーネント）に値下げ配信メールの送信記録が残らない。

売主へのメール送信（`seller_email`）やSMS送信（`seller_sms`）では送信後に `saveSellerSendHistory` が呼ばれて履歴が保存されているが、値下げ配信メール送信（`GmailDistributionButton`）ではこの処理が実装されていない。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 物件リスト詳細画面で「公開前、値下げメール」ボタンを押して配信メールを送信する THEN システムは `property_chat_history` テーブルへの保存処理を実行しない

1.2 WHEN 値下げ配信メールの送信が成功する THEN システムは物件詳細画面の左列「売主への送信履歴」に送信記録を表示しない

### 期待される動作（正しい動作）

2.1 WHEN 物件リスト詳細画面で「公開前、値下げメール」ボタンを押して配信メールの送信が成功する THEN システムは SHALL `property_chat_history` テーブルに送信履歴を保存する（`chat_type: 'seller_email'` または専用の `chat_type`）

2.2 WHEN 値下げ配信メールの送信履歴が保存される THEN システムは SHALL 物件詳細画面の左列「売主への送信履歴」に当該送信記録を表示する

2.3 WHEN 値下げ配信メールを複数の買主に送信する THEN システムは SHALL 送信件数・送信者名・件名を含む履歴を保存する

### 変更しない動作（リグレッション防止）

3.1 WHEN 物件詳細画面で売主へのメール（`seller_email`）を送信する THEN システムは SHALL CONTINUE TO 送信履歴を `property_chat_history` テーブルに保存し左列に表示する

3.2 WHEN 物件詳細画面で売主へのSMS（`seller_sms`）を送信する THEN システムは SHALL CONTINUE TO 送信履歴を `property_chat_history` テーブルに保存し左列に表示する

3.3 WHEN 値下げ配信メールの送信が失敗する THEN システムは SHALL CONTINUE TO エラーメッセージを表示し、失敗した送信の履歴は保存しない

3.4 WHEN 物件リスト詳細画面の左列「売主への送信履歴」を表示する THEN システムは SHALL CONTINUE TO `seller_email`・`seller_sms`・`seller_gmail` の chat_type のみをフィルタリングして表示する
