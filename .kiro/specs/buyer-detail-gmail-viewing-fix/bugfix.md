# Bugfix Requirements Document

## Introduction

買主詳細画面（`BuyerDetailPage`）に関する2つのバグを修正します。

**問題1: Gmail送信の待機時間が長い**
ヘッダーの「Gmail送信」ボタンを押すと、テンプレート選択後に `mergeMultiple` APIを呼び出し、その後バックエンドでOAuth2トークン取得（`getAccessToken`）とGmail API呼び出しが直列で実行されるため、ユーザーが長時間のローディング状態を体験する。

**問題2: 詳細画面に「内覧結果」セクションが重複表示されている**
`BUYER_FIELD_SECTIONS` に `isViewingResultGroup: true` の「内覧結果」セクションが定義されており、詳細画面内に表示されている。一方、ヘッダーの「内覧」ボタンを押すと `/buyers/:buyer_number/viewing-result` という専用ページに遷移する。詳細画面の「内覧結果」セクションは専用ページと内容が重複するため不要。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが買主詳細画面のヘッダーにある「Gmail送信」ボタンを押してテンプレートを選択する THEN システムはバックエンドで `mergeMultiple` API呼び出し・OAuth2トークン取得・Gmail API呼び出しを直列で実行し、ユーザーに長時間（数十秒以上）のローディング状態を表示する

1.2 WHEN Gmail送信処理中にOAuth2トークンの取得またはGmail APIの呼び出しが遅延する THEN システムはフロントエンドにタイムアウトエラーまたは無応答状態を返す

1.3 WHEN ユーザーが買主詳細画面を開く THEN システムは詳細画面内に「内覧結果」セクション（最新状況・内覧日（最新）・内覧結果・後続対応）を表示する

1.4 WHEN ユーザーが買主詳細画面のヘッダーにある「内覧」ボタンを押す THEN システムは `/buyers/:buyer_number/viewing-result` の専用ページに遷移し、詳細画面の「内覧結果」セクションと同じ内容が別ページにも存在する

### Expected Behavior (Correct)

2.1 WHEN ユーザーが買主詳細画面のヘッダーにある「Gmail送信」ボタンを押してテンプレートを選択する THEN システムは `mergeMultiple` API呼び出しを速やかに完了し、ユーザーにメール作成モーダルを表示する（待機時間が許容範囲内に収まる）

2.2 WHEN Gmail送信処理中にOAuth2トークンの取得またはGmail APIの呼び出しが遅延する THEN システムはユーザーに明確なエラーメッセージを表示し、無応答状態にならない

2.3 WHEN ユーザーが買主詳細画面を開く THEN システムは詳細画面内に「内覧結果」セクションを表示しない

2.4 WHEN ユーザーが買主詳細画面のヘッダーにある「内覧」ボタンを押す THEN システムは `/buyers/:buyer_number/viewing-result` の専用ページに遷移し、内覧情報を確認・編集できる

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが買主詳細画面で物件を選択してGmail送信ボタンを押す THEN システムは引き続きテンプレート選択モーダルを表示する

3.2 WHEN ユーザーがメール作成モーダルで送信ボタンを押す THEN システムは引き続き買主のメールアドレスにGmailを送信し、送信履歴（`email_history`）とアクティビティログ（`activity_logs`）を記録する

3.3 WHEN ユーザーが買主詳細画面の「問合せ内容」「基本情報」「その他」セクションのフィールドを編集する THEN システムは引き続きインライン編集・保存・スプレッドシート同期を正常に動作させる

3.4 WHEN ユーザーが買主詳細画面のヘッダーにある「内覧」ボタンを押す THEN システムは引き続き `/buyers/:buyer_number/viewing-result` の専用ページに遷移する

3.5 WHEN ユーザーが買主詳細画面を開く THEN システムは引き続き「問合せ内容」「基本情報」「その他」の3セクションを正常に表示する
