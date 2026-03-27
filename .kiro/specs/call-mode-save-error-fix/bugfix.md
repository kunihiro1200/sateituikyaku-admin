# Bugfix Requirements Document

## Introduction

通話モードページ（`/sellers/:id/call`）で「不通」または「1番電話」フィールドを入力して保存ボタンを押すと「保存に失敗しました」エラーが表示されるバグを修正する。

このバグにより、ユーザーは不通ステータスや1番電話担当者の情報を保存できず、業務に支障をきたしている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが通話モードページで「不通」フィールドに値を入力して保存ボタンを押す THEN システムは「保存に失敗しました」エラーメッセージを表示する

1.2 WHEN ユーザーが通話モードページで「1番電話」フィールドに値を入力して保存ボタンを押す THEN システムは「保存に失敗しました」エラーメッセージを表示する

1.3 WHEN `handleSaveAndExit` 関数が実行される THEN システムは未定義変数 `type` を参照して ReferenceError を発生させる（`if (type === 'email')` の `type` が `handleSaveAndExit` のスコープ内に存在しない）

### Expected Behavior (Correct)

2.1 WHEN ユーザーが通話モードページで「不通」フィールドに値を入力して保存ボタンを押す THEN システムは `unreachable_status` カラムに値を保存し「保存しました」メッセージを表示する

2.2 WHEN ユーザーが通話モードページで「1番電話」フィールドに値を入力して保存ボタンを押す THEN システムは `first_call_person` カラムに値を保存し「保存しました」メッセージを表示する

2.3 WHEN `handleSaveAndExit` 関数が実行される THEN システムは `type` 変数を参照せずに正常に保存処理を完了する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが通話モードページで「電話担当（任意）」「連絡取りやすい時間」「連絡方法」フィールドを入力して保存ボタンを押す THEN システムは SHALL CONTINUE TO これらのフィールドを正常に保存する

3.2 WHEN ユーザーが通話モードページで保存ボタンを押す THEN システムは SHALL CONTINUE TO `unreachableStatus`・`phoneContactPerson`・`preferredContactTime`・`contactMethod`・`firstCallPerson` の5フィールドをまとめて `/api/sellers/:id` に PUT リクエストで送信する

3.3 WHEN 反響日付が2026年1月1日以降の売主で不通ステータスが未入力の場合に保存ボタンを押す THEN システムは SHALL CONTINUE TO 「不通ステータスを選択してください」バリデーションエラーを表示する

3.4 WHEN 反響日付が2026年3月1日以降の売主で不通入力済み・1番電話未入力の状態でページを離れようとする THEN システムは SHALL CONTINUE TO 遷移警告ダイアログを表示する
