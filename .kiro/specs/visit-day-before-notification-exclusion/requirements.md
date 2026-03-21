# Requirements Document

## Introduction

売主リストのサイドバーカテゴリー「訪問日前日」において、スプレッドシートのBX列「通知送信者」（DBカラム名：`visit_reminder_assignee`、フロントエンドキー：`visitReminderAssignee`）に値が入力されている売主を除外する機能。

現在の「訪問日前日」カテゴリーは、営担（visitAssignee）に入力があり、かつ今日が訪問日の前営業日である売主を表示している。この機能追加により、すでに訪問事前通知メールの担当者が割り当てられている（＝通知済みまたは通知予定が確定している）売主を除外し、未対応の売主のみを表示できるようにする。

## Glossary

- **SellerStatusFilter**: `frontend/frontend/src/utils/sellerStatusFilters.ts` に実装されたフィルタリングロジック
- **isVisitDayBefore**: 「訪問日前日」カテゴリーの判定関数
- **visitReminderAssignee**: フロントエンドの売主オブジェクトにおける訪問事前通知メール担当フィールドのキー名
- **visit_reminder_assignee**: データベース（Supabase）における訪問事前通知メール担当フィールドのカラム名
- **訪問日前日カテゴリー**: サイドバーに表示される `①訪問日前日` カテゴリー（緑色）
- **前営業日**: 通常は訪問日の1日前。木曜訪問の場合のみ2日前（水曜定休のため火曜に通知）。日曜訪問は1日前（土曜に通知）

## Requirements

### Requirement 1: 訪問事前通知メール担当が入力済みの売主を「訪問日前日」から除外

**User Story:** As a 営業担当者, I want 訪問事前通知メール担当が既に入力されている売主を「訪問日前日」カテゴリーから除外したい, so that 未対応の売主のみに集中して通知作業を行える。

#### Acceptance Criteria

1. WHEN `isVisitDayBefore()` が評価される, THE SellerStatusFilter SHALL `visitReminderAssignee`（または `visit_reminder_assignee`）フィールドに空でない文字列が入力されている売主を `false` と判定する
2. WHEN `isVisitDayBefore()` が評価される, THE SellerStatusFilter SHALL `visitReminderAssignee` フィールドが `undefined`、`null`、または空文字列（`""`）の売主に対して、既存の前営業日ロジックを引き続き適用する
3. THE SellerStatusFilter SHALL `visitReminderAssignee` の値の有無チェックを、既存の `hasVisitAssignee()` チェックおよび前営業日チェックより先に評価しない（既存の判定順序を維持する）
4. WHEN 売主の `visitReminderAssignee` に値が入力されている, THE SellerStatusFilter SHALL その売主を「訪問日前日」カテゴリーのカウントから除外する

### Requirement 2: 既存の「訪問日前日」判定ロジックへの影響なし

**User Story:** As a 開発者, I want 既存の前営業日判定ロジック（水曜定休・木曜2日前ロジック）を変更せずに除外条件のみを追加したい, so that 既存の動作を壊さずに新機能を追加できる。

#### Acceptance Criteria

1. THE SellerStatusFilter SHALL `visitReminderAssignee` が空の売主に対して、木曜訪問の場合は訪問日の2日前（火曜）に `true` を返す既存ロジックを維持する
2. THE SellerStatusFilter SHALL `visitReminderAssignee` が空の売主に対して、木曜以外の訪問日（月・火・水・金・土・日）の場合は訪問日の1日前に `true` を返す既存ロジックを維持する
3. THE SellerStatusFilter SHALL `visitReminderAssignee` が空の売主に対して、`hasVisitAssignee()` が `false` の場合は `false` を返す既存ロジックを維持する
4. THE SellerStatusFilter SHALL `visitReminderAssignee` が空の売主に対して、`visitDate` が未設定の場合は `false` を返す既存ロジックを維持する

### Requirement 3: フロントエンドのデータ取得における visitReminderAssignee の利用可能性

**User Story:** As a 開発者, I want 売主リストページで `visitReminderAssignee` フィールドが確実に取得されている状態を確認したい, so that フィルタリングロジックが正しく動作することを保証できる。

#### Acceptance Criteria

1. THE SellerStatusFilter SHALL `seller.visitReminderAssignee` と `seller.visit_reminder_assignee` の両方の形式でフィールドを参照できる（既存の他フィールドと同様のパターン）
2. IF `visitReminderAssignee` フィールドが売主オブジェクトに存在しない（`undefined`）, THEN THE SellerStatusFilter SHALL そのフィールドを空として扱い、除外しない
