# Bugfix Requirements Document

## Introduction

売主管理システムの通話モードページ（CallModePage）において、「専任媒介通知」ボタンを押したときに送信されるGoogle Chat通知が、誤って他決Chat（別のChat Space）のWebhook URLに送信されているバグを修正する。

`ChatNotificationService` は単一の環境変数 `GOOGLE_CHAT_WEBHOOK_URL` を使用しており、選任媒介通知（`sendExclusiveContractNotification`）も他決通知（`sendPostVisitOtherDecisionNotification`、`sendPreVisitOtherDecisionNotification`）も同じWebhook URLに送信している。

正しい選任媒介通知Chat専用のWebhook URLは以下の通り：
`https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが通話モードページで「専任媒介通知」ボタンを押した場合 THEN システムは `GOOGLE_CHAT_WEBHOOK_URL` 環境変数に設定されているURLに通知を送信するが、そのURLが他決ChatのURLになっているため、選任媒介通知が他決Chat Spaceに誤って届く

1.2 WHEN `ChatNotificationService` が選任媒介通知（`sendExclusiveContractNotification`）を送信する場合 THEN システムは選任媒介通知専用のWebhook URLではなく、共通の `GOOGLE_CHAT_WEBHOOK_URL` を使用するため、他決ChatのURLが設定されていると誤ったChat Spaceに通知が届く

1.3 WHEN `ChatNotificationService` が他決通知（`sendPostVisitOtherDecisionNotification`、`sendPreVisitOtherDecisionNotification`）を送信する場合 THEN システムは選任媒介通知と同じ `GOOGLE_CHAT_WEBHOOK_URL` を使用するため、選任媒介通知専用のURLが設定されていると他決通知が誤ったChat Spaceに届く

### Expected Behavior (Correct)

2.1 WHEN ユーザーが通話モードページで「専任媒介通知」ボタンを押した場合 THEN システムは選任媒介通知専用のWebhook URL（`GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` 環境変数）に通知を送信し、正しい選任媒介Chat Spaceにメッセージが届く

2.2 WHEN `ChatNotificationService` が選任媒介通知（`sendExclusiveContractNotification`）を送信する場合 THEN システムは `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` 環境変数のURLを使用し、選任媒介Chat Space（`AAAAEz1pOnw`）にメッセージが届く

2.3 WHEN `ChatNotificationService` が他決通知（`sendPostVisitOtherDecisionNotification`、`sendPreVisitOtherDecisionNotification`）を送信する場合 THEN システムは引き続き `GOOGLE_CHAT_WEBHOOK_URL` 環境変数のURLを使用し、他決Chat Spaceに正しくメッセージが届く

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが「一般媒介通知」ボタンを押した場合 THEN システムは引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して通知を送信する

3.2 WHEN ユーザーが「訪問後他決通知」または「未訪問他決通知」ボタンを押した場合 THEN システムは引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して通知を送信する

3.3 WHEN 専任媒介通知の送信に成功した場合 THEN システムは引き続きサクセスメッセージを表示する

3.4 WHEN 専任媒介通知の送信に失敗した場合 THEN システムは引き続きエラーメッセージを表示する

3.5 WHEN 必須フィールド（専任（他決）決定日、競合、専任・他決要因）が未入力の場合 THEN システムは引き続きバリデーションエラーを表示し、通知を送信しない
