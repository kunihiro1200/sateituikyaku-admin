# Requirements Document

## Introduction

通話モードページ（CallModePage）の「追客の活動ログ」セクションの上に、各種メール・SMS担当者をスタッフのイニシャルボタンで選択・保存できる「担当者設定」セクションを追加する。

対象フィールドは以下の7つで、それぞれスプレッドシートの特定カラムに対応する：

| フィールド名 | スプシカラム | DBカラム |
|---|---|---|
| 不通時Sメール担当 | CS列 | `unreachable_sms_assignee` |
| 査定Sメール担当 | CT列 | `valuation_sms_assignee` |
| 査定理由別３後Eメ担 | DL列 | `valuation_reason_email_assignee` |
| 査定理由（査定サイトから転記） | AO列 | `valuation_reason` |
| キャンセル案内担当 | AF列 | `cancel_notice_assignee` |
| 除外前、長期客メール担当 | CX列 | `long_term_email_assignee` |
| 当社が電話したというリマインドメール担当 | CO列 | `call_reminder_email_assignee` |

スタッフのイニシャルはスタッフ管理シートの「有効」=TRUEのスタッフから動的に取得する。
「不要」ボタンも常に表示する。

---

## Glossary

- **AssigneeSection**: 通話モードページに追加する担当者設定セクション
- **InitialButton**: スタッフのイニシャルを表示するボタン（選択時に赤くハイライト）
- **ActiveStaff**: スタッフ管理シートの「有効」列がTRUEのスタッフ
- **StaffManagementService**: スタッフ管理スプレッドシートからスタッフ情報を取得するバックエンドサービス（`backend/src/services/StaffManagementService.ts`）
- **SellerService**: 売主データの取得・更新を行うバックエンドサービス（`backend/src/services/SellerService.supabase.ts`）
- **decryptSeller**: SellerServiceのメソッド。DBから取得した売主データをフロントエンド向けに変換する
- **CallModePage**: 通話モードページ（`frontend/frontend/src/pages/CallModePage.tsx`）
- **不要ボタン**: 担当者を「不要」に設定するための特殊ボタン

---

## Requirements

### Requirement 1: DBマイグレーション

**User Story:** As a 開発者, I want 新しい担当者フィールドをDBに追加したい, so that 担当者情報を永続化できる。

#### Acceptance Criteria

1. THE System SHALL `sellers`テーブルに以下の6つのTEXTカラムを追加するマイグレーションを作成する：
   - `unreachable_sms_assignee`（不通時Sメール担当）
   - `valuation_sms_assignee`（査定Sメール担当）
   - `valuation_reason_email_assignee`（査定理由別３後Eメ担）
   - `cancel_notice_assignee`（キャンセル案内担当）
   - `long_term_email_assignee`（除外前、長期客メール担当）
   - `call_reminder_email_assignee`（当社が電話したというリマインドメール担当）
2. THE System SHALL `sellers`テーブルに`valuation_reason`（査定理由）TEXTカラムを追加するマイグレーションを作成する（AO列対応）
3. IF マイグレーションが既に適用済みの場合, THEN THE System SHALL エラーなく処理を継続する

---

### Requirement 2: バックエンド型定義の更新

**User Story:** As a 開発者, I want バックエンドの型定義に新フィールドを追加したい, so that TypeScriptの型安全性を保てる。

#### Acceptance Criteria

1. THE System SHALL `backend/src/types/index.ts`の`Seller`インターフェースに以下のオプショナルフィールドを追加する：
   - `unreachableSmsAssignee?: string`
   - `valuationSmsAssignee?: string`
   - `valuationReasonEmailAssignee?: string`
   - `valuationReason?: string`
   - `cancelNoticeAssignee?: string`
   - `longTermEmailAssignee?: string`
   - `callReminderEmailAssignee?: string`
2. THE System SHALL `backend/src/services/SellerService.supabase.ts`の`decryptSeller`メソッドに上記7フィールドのマッピングを追加する

---

### Requirement 3: スプレッドシートカラムマッピングの更新

**User Story:** As a 開発者, I want スプレッドシートとDBのカラムマッピングを更新したい, so that 自動同期が正しく動作する。

#### Acceptance Criteria

1. THE System SHALL `backend/src/config/column-mapping.json`の`spreadsheetToDatabase`セクションに以下のマッピングを追加する（スプシカラム名 → DBカラム名）
2. THE System SHALL `backend/src/config/column-mapping.json`の`databaseToSpreadsheet`セクションに逆方向のマッピングを追加する
3. WHEN スプレッドシートのCS列（不通時Sメール担当）が更新された場合, THE System SHALL `unreachable_sms_assignee`カラムに同期する
4. WHEN スプレッドシートのCT列（査定Sメール担当）が更新された場合, THE System SHALL `valuation_sms_assignee`カラムに同期する
5. WHEN スプレッドシートのDL列（査定理由別３後Eメ担）が更新された場合, THE System SHALL `valuation_reason_email_assignee`カラムに同期する
6. WHEN スプレッドシートのAO列（査定理由）が更新された場合, THE System SHALL `valuation_reason`カラムに同期する
7. WHEN スプレッドシートのAF列（キャンセル案内担当）が更新された場合, THE System SHALL `cancel_notice_assignee`カラムに同期する
8. WHEN スプレッドシートのCX列（除外前、長期客メール担当）が更新された場合, THE System SHALL `long_term_email_assignee`カラムに同期する
9. WHEN スプレッドシートのCO列（当社が電話したというリマインドメール担当）が更新された場合, THE System SHALL `call_reminder_email_assignee`カラムに同期する

---

### Requirement 4: フロントエンド型定義の更新

**User Story:** As a 開発者, I want フロントエンドの型定義に新フィールドを追加したい, so that TypeScriptの型安全性を保てる。

#### Acceptance Criteria

1. THE System SHALL `frontend/frontend/src/types/index.ts`の`Seller`インターフェースに以下のオプショナルフィールドを追加する：
   - `unreachableSmsAssignee?: string`
   - `valuationSmsAssignee?: string`
   - `valuationReasonEmailAssignee?: string`
   - `valuationReason?: string`
   - `cancelNoticeAssignee?: string`
   - `longTermEmailAssignee?: string`
   - `callReminderEmailAssignee?: string`

---

### Requirement 5: 担当者設定セクションのUI

**User Story:** As a スタッフ, I want 通話モードページで各種メール・SMS担当者をイニシャルボタンで選択したい, so that 担当者を素早く設定できる。

#### Acceptance Criteria

1. THE AssigneeSection SHALL 通話モードページの「追客の活動ログ」セクション（`FollowUpLogHistoryTable`）の直上に表示される
2. THE AssigneeSection SHALL 以下の7つのフィールドを縦に並べて表示する：
   - 不通時Sメール担当
   - 査定Sメール担当
   - 査定理由別３後Eメ担
   - 査定理由（テキスト入力フィールド）
   - キャンセル案内担当
   - 除外前、長期客メール担当
   - 当社が電話したというリマインドメール担当
3. WHEN ページが読み込まれた場合, THE AssigneeSection SHALL `/api/employees/active-initials`エンドポイントからスタッフのイニシャル一覧を取得する
4. THE InitialButton SHALL 各フィールドに対してActiveStaffのイニシャルボタンを横並びで表示する
5. THE AssigneeSection SHALL 各フィールドに「不要」ボタンを常に表示する
6. WHEN InitialButtonが選択された場合, THE InitialButton SHALL 赤色（`error`カラー）でハイライト表示される
7. WHEN 未選択の場合, THE InitialButton SHALL デフォルトの`outlined`スタイルで表示される
8. THE AssigneeSection SHALL 「査定理由」フィールドをテキスト入力フィールドとして表示する（イニシャルボタンではなく）

---

### Requirement 6: 担当者の保存

**User Story:** As a スタッフ, I want 選択した担当者が自動的に保存されたい, so that 手動で保存ボタンを押す必要がない。

#### Acceptance Criteria

1. WHEN InitialButtonが選択された場合, THE System SHALL 即座に`PUT /api/sellers/:id`エンドポイントを呼び出してDBに保存する
2. WHEN 「不要」ボタンが選択された場合, THE System SHALL 対応するフィールドに`"不要"`という文字列を保存する
3. WHEN 同じボタンが再度選択された場合（選択解除）, THE System SHALL 対応するフィールドを`null`に更新する
4. WHEN 保存が成功した場合, THE System SHALL ローカルのseller状態を更新する
5. IF 保存が失敗した場合, THEN THE System SHALL エラーメッセージを表示する
6. WHEN 「査定理由」テキストフィールドが変更された場合, THE System SHALL 1秒のデバウンス後に自動保存する

---

### Requirement 7: 初期値の表示

**User Story:** As a スタッフ, I want ページを開いた時に既存の担当者設定が表示されたい, so that 現在の設定を確認できる。

#### Acceptance Criteria

1. WHEN ページが読み込まれた場合, THE AssigneeSection SHALL DBから取得した売主データの担当者フィールドを初期値として表示する
2. WHEN 売主データに担当者が設定されている場合, THE InitialButton SHALL 対応するボタンを赤色でハイライト表示する
3. WHEN 売主データに「不要」が設定されている場合, THE AssigneeSection SHALL 「不要」ボタンを赤色でハイライト表示する
