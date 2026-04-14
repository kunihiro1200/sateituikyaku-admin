# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（CallModePage）でメールテンプレート「★訪問前日通知メール」を使用する際、
本文中の `<<訪問日>>` と `<<時間>>` プレースホルダーが空文字に置換されてしまうバグ。

`replaceEmailPlaceholders` 関数が `seller.appointmentDate`（`appointment_date` カラム）のみを参照しており、
実際の訪問日時が保存されている `seller.visitDate`（`visit_date` カラム）および
`seller.visitTime`（`visit_time` カラム）を参照していないことが原因。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitDate` に訪問日時が設定されている THEN the system は `<<訪問日>>` を空文字に置換する

1.2 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitDate` に訪問日時が設定されている THEN the system は `<<時間>>` を空文字に置換する

1.3 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitTime`（`HH:mm:ss` 形式）に時間が設定されている THEN the system は `<<時間>>` を空文字に置換する

### Expected Behavior (Correct)

2.1 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitDate` に訪問日時が設定されている THEN the system SHALL `seller.visitDate` から日付文字列（例: `7月15日`）を生成して `<<訪問日>>` を置換する

2.2 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitDate` に訪問日時が設定されている THEN the system SHALL `seller.visitDate` から時刻文字列（例: `10:00`）を生成して `<<時間>>` を置換する

2.3 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitDate` の時刻部分が 00:00 かつ `seller.visitTime` に時間が設定されている THEN the system SHALL `seller.visitTime`（`HH:mm:ss` 形式）から時刻文字列を生成して `<<時間>>` を置換する

2.4 WHEN `seller.appointmentDate` が null/undefined かつ `seller.visitDate` も null/undefined THEN the system SHALL `<<訪問日>>` と `<<時間>>` を空文字に置換する（現行動作を維持）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `seller.appointmentDate` に有効な日時が設定されている THEN the system SHALL CONTINUE TO `seller.appointmentDate` から日付・時刻文字列を生成して `<<訪問日>>` と `<<時間>>` を置換する

3.2 WHEN `seller.appointmentDate` に有効な日時が設定されている THEN the system SHALL CONTINUE TO `seller.visitDate` を参照せずに `seller.appointmentDate` を優先して使用する

3.3 WHEN その他のプレースホルダー（`<<名前（漢字のみ）>>`、`<<物件所在地>>`、`<<査定額1>>` 等）を置換する THEN the system SHALL CONTINUE TO 既存の置換ロジックを変更せずに動作する
