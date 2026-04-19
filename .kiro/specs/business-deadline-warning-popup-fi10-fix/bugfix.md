# Bugfix Requirements Document

## Introduction

業務リスト（WorkTaskDetailModal）のFI10フィールド「サイト登録納期予定日（site_registration_due_date）」において、「⚠️ 締日超過の警告」ポップアップがモーダルを開くたびに毎回表示されてしまうバグを修正する。

本来、この警告は日付フィールドを入力・変更した時のみ表示されるべきである。しかし現在の実装では、`checkDeadlineOnLoad` 関数がモーダルオープン時の `useEffect` 内で呼ばれており、既存データが締日を超過している場合は閲覧するだけで毎回警告が表示される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 業務リストのモーダルを開いた時（日付を変更していない場合でも）THEN the system は「⚠️ 締日超過の警告」ポップアップを表示する

1.2 WHEN バックグラウンドでデータを再取得した後（`fetchData(true)` 完了時）THEN the system は `checkDeadlineOnLoad` を再度呼び出し、警告ポップアップを再表示する

### Expected Behavior (Correct)

2.1 WHEN ユーザーが `site_registration_due_date`（サイト登録納期予定日）フィールドの値を入力・変更した時 THEN the system SHALL 締日超過チェックを行い、超過している場合のみ警告ポップアップを表示する

2.2 WHEN モーダルを開いた時（日付フィールドを変更していない場合） THEN the system SHALL 警告ポップアップを表示しない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが `site_registration_due_date` フィールドに締日を超過する日付を入力した時 THEN the system SHALL CONTINUE TO 「⚠️ 締日超過の警告」ポップアップを表示する

3.2 WHEN ユーザーが `floor_plan_due_date`（間取図完了予定）フィールドに締日を超過する日付を入力した時 THEN the system SHALL CONTINUE TO 「⚠️ 締日超過の警告」ポップアップを表示する

3.3 WHEN ユーザーが締日を超過しない日付を入力した時 THEN the system SHALL CONTINUE TO 警告ポップアップを表示しない

3.4 WHEN 警告ポップアップが表示された時 THEN the system SHALL CONTINUE TO 「確認しました」ボタンでポップアップを閉じられる
