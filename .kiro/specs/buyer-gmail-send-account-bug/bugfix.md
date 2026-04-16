# Bugfix Requirements Document

## Introduction

買主詳細画面のヘッダーにあるGmail送信機能において、特定のアカウント（yurine~）からメール送信を実行すると「送信できませんでした」というエラーが発生するバグ。別のアカウント（tomoko~）からは正常に送信できるため、アカウント固有のOAuth認証・権限・設定に起因する問題と考えられる。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN yurine~アカウントでログインした状態で買主詳細画面のGmail送信ボタンを押下する THEN システムは「送信できませんでした」というエラーを表示しメール送信に失敗する

1.2 WHEN yurine~アカウントのOAuth認証情報またはGmail API権限が不足・無効な状態でGmail送信を試みる THEN システムはエラーを返しメール送信処理が完了しない

### Expected Behavior (Correct)

2.1 WHEN yurine~アカウントでログインした状態で買主詳細画面のGmail送信ボタンを押下する THEN システムはGmail APIを通じてメールを正常に送信する

2.2 WHEN yurine~アカウントのOAuth認証情報またはGmail API権限が有効な状態でGmail送信を試みる THEN システムはエラーなくメール送信処理を完了する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN tomoko~アカウントでログインした状態で買主詳細画面のGmail送信ボタンを押下する THEN システムはSHALL CONTINUE TO 正常にメールを送信する

3.2 WHEN いずれかの有効なアカウントでGmail送信を実行する THEN システムはSHALL CONTINUE TO 送信履歴を正しく記録する

3.3 WHEN Gmail送信機能以外の買主詳細画面の操作（情報閲覧・編集など）を行う THEN システムはSHALL CONTINUE TO 正常に動作する
