# 実装計画: buyer-calendar-agency-tenant-send

## 概要

`BuyerViewingResultPage.tsx` の `handleCalendarButtonClick` 関数内で、後続担当が「業者」の場合に `setSnackbar + return` していたブロックを `assignedEmail = 'tenant@ifoo-oita.com'` に置き換える。

## タスク

- [x] 1. `handleCalendarButtonClick` の「業者」判定ロジックを変更する
  - `followUpAssignee === '業者'` のブロックを変更する
  - 変更前: `setSnackbar({ ... severity: 'warning' })` + `return`
  - 変更後: `assignedEmail = 'tenant@ifoo-oita.com'`（定数 `TENANT_EMAIL` を使用）
  - 対象ファイル: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 ユニットテストを追加する（任意）
    - `follow_up_assignee === '業者'` → `assignedEmail === 'tenant@ifoo-oita.com'`
    - 警告snackbarが表示されないこと
    - `window.open` が呼ばれること
    - 生成URLに `src=tenant%40ifoo-oita.com` が含まれること
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. チェックポイント
  - 変更後の動作を確認し、既存の社員担当者・空担当者のフローが壊れていないことを確認する。
