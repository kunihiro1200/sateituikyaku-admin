# Bugfix Requirements Document

## Introduction

買主詳細画面（BuyerDetailPage）のGmail送信機能において、メールテンプレート選択ダイアログを開くと「利用可能なテンプレートがありません」と表示され、テンプレートが一切選択できない。

`TemplateSelectionModal` は `/api/email-templates` エンドポイントを呼び出してテンプレートを取得するが、バックエンドの `EmailTemplateService.getTemplates()` はGoogleスプレッドシートからテンプレートを動的に取得する実装になっている。スプレッドシートへのアクセス失敗・環境変数未設定・シートの構造不一致などが原因で空配列が返り、ダイアログに「利用可能なテンプレートがありません」と表示される。

以前は正常に動作していたため、何らかの変更によってテンプレート取得が失敗するようになったバグである。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面でGmail送信ボタンをクリックし、テンプレート選択ダイアログを開く THEN システムは「利用可能なテンプレートがありません」と表示し、テンプレートが一件も表示されない

1.2 WHEN `/api/email-templates` エンドポイントが呼び出される THEN システムは空配列 `[]` を返す（エラーではなく空配列）

1.3 WHEN `EmailTemplateService.getTemplates()` がGoogleスプレッドシートへのアクセスに失敗する THEN システムはエラーをキャッチして空配列を返し、呼び出し元にエラーが伝播しない

### Expected Behavior (Correct)

2.1 WHEN 買主詳細画面でGmail送信ボタンをクリックし、テンプレート選択ダイアログを開く THEN システムはGoogleスプレッドシートの「テンプレート」シートから区分が「買主」の行を取得し、テンプレート一覧を表示する

2.2 WHEN `/api/email-templates` エンドポイントが呼び出される THEN システムは1件以上のテンプレートを含む配列を返す

2.3 WHEN `EmailTemplateService.getTemplates()` がGoogleスプレッドシートから「買主」区分のテンプレートを正常に取得する THEN システムは `id`・`name`・`description`・`subject`・`body` を持つ `EmailTemplate` オブジェクトの配列を返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN テンプレート選択ダイアログでテンプレートを選択する THEN システムは引き続き選択されたテンプレートを `BuyerEmailCompositionModal` に渡してメール作成画面を表示する

3.2 WHEN Gmail送信ボタンをクリックする際に物件が選択されていない THEN システムは引き続き「物件を選択してください」エラーメッセージを表示する

3.3 WHEN テンプレートのマージ処理（`/api/email-templates/:id/merge-multiple`）が呼び出される THEN システムは引き続き買主情報と物件情報をテンプレートに埋め込んだメール内容を返す

3.4 WHEN Googleスプレッドシートへのアクセスが失敗する THEN システムは引き続きエラーをログに記録する
