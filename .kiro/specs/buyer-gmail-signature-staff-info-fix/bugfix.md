# Bugfix Requirements Document

## Introduction

買主詳細画面のGmail送信機能において、「内覧後お礼メール」等のテンプレートを選択した際、署名部分の `TEL：`、`MAIL:`、`固定休：` が空欄になるバグを修正する。

根本原因は2つある。
1. 買主向けの `mergeAngleBracketPlaceholders` 関数に `<<担当名（営業）電話番号>>`、`<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` の置換処理が実装されていない。
2. 担当者情報の取得に必要な `follow_up_assignee`（後続担当）がフロントエンドからバックエンドへのリクエストに含まれていない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面のGmail送信ボタンから `<<担当名（営業）電話番号>>` を含むテンプレートを選択する THEN the system は署名の `TEL：` を空欄のまま表示する

1.2 WHEN 買主詳細画面のGmail送信ボタンから `<<担当名（営業）メールアドレス>>` を含むテンプレートを選択する THEN the system は署名の `MAIL:` を空欄のまま表示する

1.3 WHEN 買主詳細画面のGmail送信ボタンから `<<担当名（営業）固定休>>` を含むテンプレートを選択する THEN the system は署名の `固定休：` を空欄のまま表示する

1.4 WHEN `mergeMultiple` エンドポイントが `follow_up_assignee` なしでリクエストを受け取る THEN the system は担当者情報を検索せずにプレースホルダーを空文字に置換する

### Expected Behavior (Correct)

2.1 WHEN 買主詳細画面のGmail送信ボタンから `<<担当名（営業）電話番号>>` を含むテンプレートを選択する THEN the system SHALL 後続担当のスタッフ情報を取得して電話番号を署名に表示する

2.2 WHEN 買主詳細画面のGmail送信ボタンから `<<担当名（営業）メールアドレス>>` を含むテンプレートを選択する THEN the system SHALL 後続担当のスタッフ情報を取得してメールアドレスを署名に表示する

2.3 WHEN 買主詳細画面のGmail送信ボタンから `<<担当名（営業）固定休>>` を含むテンプレートを選択する THEN the system SHALL 後続担当のスタッフ情報を取得して固定休を署名に表示する

2.4 WHEN `mergeMultiple` エンドポイントが `follow_up_assignee` を含むリクエストを受け取る THEN the system SHALL `StaffManagementService.getStaffByInitials()` でスタッフを検索し、見つからない場合は `getStaffByNameContains()` で部分一致検索して担当者情報を取得する

2.5 WHEN `follow_up_assignee` が指定されているがスタッフ情報が見つからない THEN the system SHALL 担当者情報プレースホルダーを空文字に置換してエラーなく処理を続行する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件報告メール等の売主向けテンプレートで `<<担当名（営業）電話番号>>` を使用する THEN the system SHALL CONTINUE TO 既存の `mergePropertyTemplate` 関数で担当者情報を正しく置換する

3.2 WHEN 買主向けテンプレートで `<<氏名>>`、`<<買主番号>>`、`<<メールアドレス>>` 等の買主情報プレースホルダーを使用する THEN the system SHALL CONTINUE TO 既存通り買主情報を正しく置換する

3.3 WHEN 買主向けテンプレートで `<<住居表示>>`、`<<GoogleMap>>`、`<<内覧アンケート>>` 等の物件情報プレースホルダーを使用する THEN the system SHALL CONTINUE TO 既存通り物件情報を正しく置換する

3.4 WHEN `follow_up_assignee` がリクエストに含まれない THEN the system SHALL CONTINUE TO 担当者情報プレースホルダーを空文字に置換して既存の動作を維持する

3.5 WHEN Gmail送信ボタンから `follow_up_assignee` を含まないテンプレートを選択する THEN the system SHALL CONTINUE TO テンプレートのマージと送信が正常に動作する
