# 要件定義ドキュメント

## はじめに

買主リストの内覧ページ（`BuyerViewingResultPage`）に「内覧前日Eメール」ボタンを追加する機能の要件定義。
ボタンは `buyer.calculated_status === '内覧日前日'` の場合のみ表示され、クリックすると「★内覧前日通知メール」テンプレートのみを使ったGmail送信フローを起動する。
既存の `BuyerGmailSendButton` の仕組みを流用し、新規コンポーネント `PreDayEmailButton` として実装する。

## 用語集

- **BuyerViewingResultPage**: 買主の内覧結果を管理するページ（`/buyers/:buyer_number/viewing`）
- **PreDayEmailButton**: 内覧前日Eメール送信専用の新規コンポーネント
- **BuyerGmailSendButton**: 既存のGmail送信ボタンコンポーネント（参考実装）
- **BuyerEmailCompositionModal**: メール本文を確認・編集して送信するモーダルコンポーネント
- **calculated_status**: バックエンドの `BuyerStatusCalculator` が計算する買主のステータス文字列
- **内覧日前日**: `calculated_status` の値の一つ。内覧日の前日に該当する買主に付与される
- **★内覧前日通知メール**: メールテンプレートの名称。このテンプレートのみを使用する
- **mergeMultiple**: 複数物件のデータをテンプレートにマージするAPIエンドポイント

## 要件

### 要件1: 内覧前日Eメールボタンの表示制御

**ユーザーストーリー:** 担当者として、内覧前日の買主に対してのみ内覧前日Eメールボタンを表示したい。そうすることで、誤った買主にメールを送信するリスクを防げる。

#### 受け入れ基準

1. WHEN `buyer.calculated_status === '内覧日前日'` である場合、THE BuyerViewingResultPage SHALL `PreDayEmailButton` を表示する
2. WHEN `buyer.calculated_status !== '内覧日前日'` である場合、THE BuyerViewingResultPage SHALL `PreDayEmailButton` を表示しない
3. THE BuyerViewingResultPage SHALL `buyer.calculated_status` の値をAPIレスポンスから直接取得して判定する（フロントエンドで独自に日付計算しない）

### 要件2: 内覧前日Eメールボタンのクリック動作

**ユーザーストーリー:** 担当者として、内覧前日Eメールボタンをクリックしたとき、「★内覧前日通知メール」テンプレートのみを使ったGmail送信フローを起動したい。そうすることで、正しいテンプレートで素早くメールを送信できる。

#### 受け入れ基準

1. WHEN ユーザーが `PreDayEmailButton` をクリックした場合、THE PreDayEmailButton SHALL `GET /api/email-templates` を呼び出してテンプレート一覧を取得する
2. WHEN テンプレート一覧を取得した場合、THE PreDayEmailButton SHALL `name === '★内覧前日通知メール'` のテンプレートのみを使用する
3. WHEN `★内覧前日通知メール` テンプレートが見つかった場合、THE PreDayEmailButton SHALL `POST /api/email-templates/:id/mergeMultiple` を呼び出してマージ済みコンテンツを取得する
4. WHEN マージ済みコンテンツが取得できた場合、THE PreDayEmailButton SHALL `BuyerEmailCompositionModal` を開く
5. WHEN `selectedPropertyIds.size === 0` である場合、THE PreDayEmailButton SHALL ボタンを disabled 状態にする

### 要件3: テンプレートが見つからない場合のエラー処理

**ユーザーストーリー:** 担当者として、「★内覧前日通知メール」テンプレートが存在しない場合に分かりやすいエラーメッセージを受け取りたい。そうすることで、問題の原因を把握して適切な対処ができる。

#### 受け入れ基準

1. IF `GET /api/email-templates` のレスポンスに `★内覧前日通知メール` が含まれない場合、THEN THE PreDayEmailButton SHALL Snackbar で「★内覧前日通知メールテンプレートが見つかりません」を表示する
2. IF `POST /api/email-templates/:id/mergeMultiple` が失敗した場合、THEN THE PreDayEmailButton SHALL Snackbar でエラーメッセージを表示する

### 要件4: Gmail送信フロー

**ユーザーストーリー:** 担当者として、`BuyerEmailCompositionModal` でメール内容を確認・編集してから送信したい。そうすることで、送信前に内容を確認できる。

#### 受け入れ基準

1. WHEN ユーザーが `BuyerEmailCompositionModal` で送信を実行した場合、THE PreDayEmailButton SHALL `POST /api/gmail/send` を呼び出してメールを送信する
2. WHEN メール送信が成功した場合、THE PreDayEmailButton SHALL Snackbar で「メールを送信しました」を表示する
3. IF メール送信が失敗した場合、THEN THE PreDayEmailButton SHALL Snackbar でエラーメッセージを表示する
4. WHEN メール送信が完了した場合、THE PreDayEmailButton SHALL `onEmailSent` コールバックを呼び出す（コールバックが指定されている場合）
