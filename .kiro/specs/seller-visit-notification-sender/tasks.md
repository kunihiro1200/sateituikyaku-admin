# 実装計画：売主通話モードページへの「通知送信者」フィールド追加

## 概要

`CallModePage` の `FollowUpLogHistoryTable` の直下に「通知送信者」フィールドを追加する。
表示条件は「活動履歴に☆訪問前日通知メールの記録がある OR `visitReminderAssignee` に値がある」。
ボタン選択UIは `button-select-layout-rule.md` に準拠し、`normalInitials`（既存）を使用する。
Gmail送信完了時の自動保存は `EMAIL_TEMPLATE_ASSIGNEE_MAP['visit_reminder']` の既存処理で対応済みのため追加実装不要。

## タスク

- [x] 1. `CallModePage.tsx` への「通知送信者」フィールド追加
  - [x] 1.1 表示条件の計算ロジックを追加する
    - `activities` に `☆訪問前日通知メール` の email 記録があるか判定する変数 `hasVisitReminderEmailHistory` を追加
    - `showVisitReminderSender = hasVisitReminderEmailHistory || !!(seller?.visitReminderAssignee)` を定義
    - _要件: 1.1, 1.2, 1.3_

  - [x] 1.2 「通知送信者」ボタン選択UIを `FollowUpLogHistoryTable` の直下に追加する
    - `showVisitReminderSender` が true の場合のみ表示
    - `button-select-layout-rule.md` に準拠したレイアウト（ラベル横並び・`flex: 1`・均等幅）
    - `normalInitials`（既存の state）を使用してボタンを生成
    - 選択済みボタン: `variant="contained"`、未選択: `variant="outlined"`
    - クリック時: `PUT /api/sellers/:id` で `visitReminderAssignee` を保存
    - 選択済みボタン再クリックで空文字を保存（解除）
    - 保存成功時: `setSeller` でローカルステートを更新
    - 保存失敗時: `setSnackbarMessage` でエラー表示
    - _要件: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.4, 3.5_

  - [x] 1.3 既存の Gmail 送信完了時の自動保存が正しく動作することを確認する
    - `EMAIL_TEMPLATE_ASSIGNEE_MAP['visit_reminder'] === 'visitReminderAssignee'` が定義済みであることを確認
    - `handleConfirmSend()` 内の既存処理で `visitReminderAssignee` が自動セットされることを確認
    - 自動保存後に `setSeller` が呼ばれ `showVisitReminderSender` が true になることを確認
    - _要件: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ]* 2. プロパティテスト：通知送信者の保存ラウンドトリップ（プロパティ 1）
  - **プロパティ 1: 通知送信者の保存ラウンドトリップ**
  - **検証: 要件 3.1, 3.2, 3.5**
  - `fast-check` で任意のイニシャル文字列を `visitReminderAssignee` として保存し、取得後の値が一致することを確認
  - テストファイル: `frontend/frontend/src/__tests__/sellerVisitNotificationSender.property.test.ts`

- [ ]* 3. プロパティテスト：通知送信者入力済みの場合は訪問日前日判定が false（プロパティ 2）
  - **プロパティ 2: 通知送信者入力済みの場合は訪問日前日判定が false**
  - **検証: 要件 4.1**
  - `fast-check` で任意の非空文字列を `visitReminderAssignee` に持つ売主に対して `isVisitDayBefore` が `false` を返すことを確認
  - テストファイル: `frontend/frontend/src/__tests__/sellerVisitNotificationSender.property.test.ts`

- [ ]* 4. プロパティテスト：通知送信者空欄かつ訪問日前日条件を満たす場合は訪問日前日判定が true（プロパティ 3）
  - **プロパティ 3: 通知送信者空欄かつ訪問日前日条件を満たす場合は訪問日前日判定が true**
  - **検証: 要件 4.2, 4.4**
  - `fast-check` で `visitReminderAssignee` が null または空文字、`visitAssignee` に値あり、訪問日が翌日の売主に対して `isVisitDayBefore` が `true` を返すことを確認
  - テストファイル: `frontend/frontend/src/__tests__/sellerVisitNotificationSender.property.test.ts`

- [x] 5. チェックポイント - 動作確認
  - `getDiagnostics` でエラーがないことを確認する
  - 疑問点があればユーザーに確認する

- [-] 6. git push でデプロイ
  - `git add .` → `git commit -m "feat: add visit reminder notification sender field to CallModePage"` → `git push origin main`
  - Vercel の自動デプロイで `sateituikyaku-admin-frontend` と `baikyaku-property-site3` の両方がデプロイされることを確認
  - _要件: 1.1〜1.5, 2.1〜2.7, 3.1〜3.5, 4.1〜4.4, 5.1〜5.4, 6.1〜6.7_

## 備考

- `*` が付いたサブタスクはオプション（スキップ可能）
- 日本語を含むファイル（`CallModePage.tsx`）の編集は Pythonスクリプト経由で行う（`file-encoding-protection.md` 参照）
- 変更不要なファイル（`AssigneeSection.tsx`、`sellerStatusFilters.ts`、`SellerService.supabase.ts`、マイグレーション）は既に実装済みのため触らない
- `normalInitials` は `CallModePage` に既存の state（`/api/employees/active-initials` から取得）を使用する
- `EMAIL_TEMPLATE_ASSIGNEE_MAP['visit_reminder'] === 'visitReminderAssignee'` は `AssigneeSection.tsx` に定義済みのため、Gmail送信完了時の自動保存は追加実装不要
