# Requirements Document

## Introduction

買主内覧結果ページ（BuyerViewingResultPage）において、「カレンダーで開く」ボタンで一度保存した後に他のページに遷移する際、不要な警告ダイアログを表示しないようにする機能を実装します。現在は`calendarOpened`というローカルステートで管理されているため、ページリロード後に警告が再表示されてしまう問題があります。この問題を、`notification_sender`（通知送信者）フィールドの入力状態で判定することで解決します。

## Glossary

- **BuyerViewingResultPage**: 買主の内覧結果を表示・編集するページコンポーネント（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）
- **notification_sender**: 通知送信者フィールド。カレンダー登録が完了したことを示す指標として使用
- **needsCalendar**: 内覧日・時間・後続担当が設定されており、かつ内覧未確定が空の場合にtrueとなるロジック
- **guardedNavigate**: ページ遷移時にカレンダー登録の警告を表示する関数
- **calendarOpened**: カレンダーが開かれたかを示すローカルステート（現在の実装）

## Requirements

### Requirement 1: notification_senderによる警告抑制

**User Story:** As a ユーザー, I want 通知送信者フィールドが入力されている場合は警告ダイアログを表示しない, so that カレンダー登録済みの案件で不要な警告が出ない

#### Acceptance Criteria

1. WHEN `notification_sender`フィールドに値が入力されている, THEN THE System SHALL `needsCalendar`ロジックでfalseを返す
2. WHEN `notification_sender`フィールドが空である, THEN THE System SHALL 既存の`needsCalendar`ロジック（内覧日・時間・後続担当の有無、内覧未確定の空欄チェック）を適用する
3. THE System SHALL `needsCalendar`ロジックに`&& !buyer?.notification_sender`条件を追加する

### Requirement 2: 警告ダイアログの表示条件

**User Story:** As a システム, I want カレンダー登録が必要かつ未登録の場合のみ警告を表示する, so that 適切なタイミングで警告を出せる

#### Acceptance Criteria

1. WHEN `needsCalendar`がtrueかつ`calendarOpened`がfalse, THEN THE System SHALL 警告ダイアログを表示する
2. WHEN `needsCalendar`がfalse, THEN THE System SHALL 警告ダイアログを表示せずにページ遷移を許可する
3. WHEN `notification_sender`が入力されている, THEN THE System SHALL `needsCalendar`がfalseとなり警告ダイアログを表示しない

### Requirement 3: ページリロード後の動作

**User Story:** As a ユーザー, I want ページをリロードしても通知送信者が入力されていれば警告が出ない, so that 一度カレンダー登録した案件で繰り返し警告が出ない

#### Acceptance Criteria

1. WHEN ユーザーがページをリロードする, THEN THE System SHALL データベースから最新の`notification_sender`の値を取得する
2. WHEN `notification_sender`に値がある状態でページをリロードする, THEN THE System SHALL 警告ダイアログを表示しない
3. THE System SHALL ローカルステート`calendarOpened`に依存せず、データベースの`notification_sender`フィールドで判定する

### Requirement 4: 既存機能の維持

**User Story:** As a ユーザー, I want 通知送信者が未入力の場合は従来通り警告が表示される, so that カレンダー登録忘れを防げる

#### Acceptance Criteria

1. WHEN 内覧日・時間・後続担当が設定されており、内覧未確定が空で、`notification_sender`が空の場合, THEN THE System SHALL 警告ダイアログを表示する
2. WHEN ユーザーが「カレンダーで開く」ボタンを押す, THEN THE System SHALL `calendarOpened`ステートをtrueに設定し、同一セッション内では警告を抑制する
3. THE System SHALL 既存の`guardedNavigate`関数のロジックを維持する

### Requirement 5: needsCalendarロジックの更新

**User Story:** As a システム, I want needsCalendarロジックを正確に実装する, so that 警告の表示判定が正しく動作する

#### Acceptance Criteria

1. THE System SHALL `needsCalendar`を以下の条件で計算する：`buyer?.viewing_date && buyer?.viewing_time && buyer?.follow_up_assignee && !buyer?.viewing_unconfirmed && !buyer?.notification_sender`
2. THE System SHALL 全ての条件がtrueの場合のみ`needsCalendar`をtrueとする
3. THE System SHALL `notification_sender`が存在する場合は、他の条件に関係なく`needsCalendar`をfalseとする

