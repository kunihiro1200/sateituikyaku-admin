# Bugfix Requirements Document

## Introduction

物件リスト詳細画面（PropertyListingDetailPage）のEmail送信ダイアログで、返信先（Reply-To）のデフォルト値が物件担当者のメールアドレスに設定されないバグを修正する。

例：AA10527の物件担当が「YM」（山本）の場合、メール送信ダイアログを開いた時点で返信先に山本さんのメールアドレスが自動選択されるべきだが、空欄のままになっている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーがEmail送信ダイアログを開く（handleOpenEmailDialog または handleSelectPropertyEmailTemplate を呼び出す）THEN the system は返信先（Reply-To）を空欄のまま表示する

1.2 WHEN jimuStaff の非同期取得が完了する前にダイアログを開く THEN the system は `jimuStaff.find()` が空配列に対して実行されるため、常に `undefined` を返し、返信先が空欄になる

### Expected Behavior (Correct)

2.1 WHEN ユーザーがEmail送信ダイアログを開く THEN the system SHALL 物件の `sales_assignee`（イニシャル）に対応する `jimuStaff` のメールアドレスを返信先（Reply-To）のデフォルト値として設定する

2.2 WHEN `emailDialog.open` が `true` になった後に `jimuStaff` を参照する THEN the system SHALL その時点で取得済みの `jimuStaff` から正しくマッチングして返信先を設定する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが返信先（Reply-To）のドロップダウンで別のスタッフを選択する THEN the system SHALL CONTINUE TO 選択したスタッフのメールアドレスを返信先として使用する

3.2 WHEN 対応するスタッフが `jimuStaff` に存在しない場合 THEN the system SHALL CONTINUE TO 返信先を空欄（未選択）のままにする

3.3 WHEN メール送信が完了またはキャンセルされる THEN the system SHALL CONTINUE TO 返信先の選択状態をリセットする

3.4 WHEN `handleSelectPropertyEmailTemplate` でテンプレートを選択してダイアログを開く THEN the system SHALL CONTINUE TO テンプレートの内容（件名・本文）を正しく設定する
