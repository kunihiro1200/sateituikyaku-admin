# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（`/sellers/:id/call`）において、AA13953の売主で「不通時Sメール」をSMS送信した際に、正しい「不通時Sメール担当」フィールドに加えて、誤って「査定理由別３後Eメ担」（`valuationReasonEmailAssignee`）フィールドにも値が入力されてしまうバグを修正する。

また、査定メール（Eメール）を送信した際にも「査定理由別３後Eメ担」に値が入力されてしまう問題も対象とする。

本バグは `frontend/frontend/src/pages/CallModePage.tsx` の `handleConfirmSend` 関数内のラベルベースフォールバック判定ロジックに起因する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話モードページで「不通時Sメール」（templateId: `initial_cancellation`）をSMS送信する THEN システムは正しい `unreachableSmsAssignee` フィールドに担当者イニシャルを設定する（これは正しい）と同時に、誤って `valuationReasonEmailAssignee` フィールドにも担当者イニシャルを設定してしまう

1.2 WHEN 通話モードページで査定メール（Eメール）を送信する THEN システムは `valuationReasonEmailAssignee` フィールドに担当者イニシャルを設定するが、これは「査定理由別３後Eメール」（`reason_relocation_3day`、`reason_inheritance_3day`、`reason_divorce_3day`、`reason_loan_3day`）を送信した場合のみ正しく、それ以外の査定関連メール（例：査定額案内メール）を送信した場合にも誤って設定されてしまう

1.3 WHEN 以前も「査定理由別３後Eメ担」のEメールを送っていないのに値が入力されていた THEN システムはラベルフォールバック判定の `template.label.includes('査定額案内') || template.label.includes('査定理由')` という条件が、意図しないテンプレートラベルにもマッチしてしまい、誤って `valuationReasonEmailAssignee` に値を設定してしまう

### Expected Behavior (Correct)

2.1 WHEN 通話モードページで「不通時Sメール」（templateId: `initial_cancellation`）をSMS送信する THEN システムは `unreachableSmsAssignee` フィールドにのみ担当者イニシャルを設定し、`valuationReasonEmailAssignee` フィールドは変更しない

2.2 WHEN 通話モードページで「査定理由別３後Eメール」（templateId: `reason_relocation_3day`、`reason_inheritance_3day`、`reason_divorce_3day`、`reason_loan_3day`）を送信する THEN システムは `valuationReasonEmailAssignee` フィールドにのみ担当者イニシャルを設定する

2.3 WHEN 通話モードページで査定額案内メールなど「査定理由別３後Eメール」以外のメールを送信する THEN システムは `valuationReasonEmailAssignee` フィールドを変更しない

2.4 WHEN `handleConfirmSend` のラベルフォールバック判定を実行する THEN システムは `EMAIL_TEMPLATE_ASSIGNEE_MAP` に定義されたマッピングのみを使用し、ラベルの部分一致による誤ったマッピングを行わない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 通話モードページで「不通時Sメール」をSMS送信する THEN システムは引き続き `unreachableSmsAssignee` フィールドに担当者イニシャルを正しく設定する

3.2 WHEN 通話モードページで「査定理由別３後Eメール」（住替え先・相続・離婚・ローン厳しい）を送信する THEN システムは引き続き `valuationReasonEmailAssignee` フィールドに担当者イニシャルを正しく設定する

3.3 WHEN 通話モードページで「キャンセル案内」SMSを送信する THEN システムは引き続き `cancelNoticeAssignee` フィールドに担当者イニシャルを正しく設定し、`valuationReasonEmailAssignee` は変更しない

3.4 WHEN 通話モードページで「訪問前日通知メール」を送信する THEN システムは引き続き `visitReminderAssignee` フィールドに担当者イニシャルを正しく設定する

3.5 WHEN 通話モードページで「リマインドメール」を送信する THEN システムは引き続き `callReminderEmailAssignee` フィールドに担当者イニシャルを正しく設定する

3.6 WHEN 通話モードページで「キャンセル案内メール」（イエウール・LIFULL・すまいステップ・HOME4U）を送信する THEN システムは引き続き `cancelNoticeAssignee` フィールドに担当者イニシャルを正しく設定する

3.7 WHEN 通話モードページで「除外前・長期客メール」を送信する THEN システムは引き続き `longTermEmailAssignee` フィールドに担当者イニシャルを正しく設定する
