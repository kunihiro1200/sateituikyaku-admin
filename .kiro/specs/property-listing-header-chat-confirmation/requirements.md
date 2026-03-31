# Requirements Document

## Introduction

物件詳細ページのヘッダー部分に表示されるボタンのレイアウトを変更し、新たに「事務へCHAT」ボタンを追加します。また、物件リストに「確認」フィールドを実装し、スプレッドシートのDQ列と双方向同期を行います。「確認」フィールドが「未」の物件は、サイドバーに「未完了」カテゴリとして表示されます。

## Glossary

- **Property_Listing_System**: 物件リスト管理システム
- **Header_Button_Area**: 物件詳細ページのヘッダーに表示されるボタン領域
- **Chat_Button**: チャットアプリケーションを開くボタン
- **Confirmation_Field**: 物件の確認状態を管理するフィールド（「未」または「済」）
- **Sidebar**: 物件リスト画面の左側に表示されるステータスカテゴリ一覧
- **Spreadsheet_DQ_Column**: スプレッドシートのDQ列（列番号120）
- **Property_Detail_Page**: 物件詳細ページ（PropertyListingsPage）

## Requirements

### Requirement 1: ヘッダーボタンのレイアウト変更

**User Story:** As a 営業担当者, I want ヘッダーボタンが2行に分かれて表示される, so that 全てのボタンに簡単にアクセスできる

#### Acceptance Criteria

1. THE Header_Button_Area SHALL display 「売主TEL」「EMAIL送信」「SMS」「公開URL」 buttons in the first row
2. THE Header_Button_Area SHALL display 「担当へCHAT」「事務へCHAT」 buttons in the second row
3. WHEN the Header_Button_Area is rendered, THE Property_Listing_System SHALL maintain consistent spacing between buttons
4. THE Header_Button_Area SHALL maintain responsive layout on mobile devices

### Requirement 2: 「事務へCHAT」ボタンの実装

**User Story:** As a 営業担当者, I want 事務担当者とチャットできる, so that 物件に関する事務手続きを迅速に進められる

#### Acceptance Criteria

1. THE Property_Listing_System SHALL display 「事務へCHAT」 button in the Header_Button_Area
2. WHEN 「事務へCHAT」 button is clicked, THE Property_Listing_System SHALL open the chat application with the same chat address as 「担当へCHAT」
3. WHEN 「事務へCHAT」 button is clicked, THE Property_Listing_System SHALL automatically set the Confirmation_Field to 「未」
4. THE 「事務へCHAT」 button SHALL use the same implementation pattern as 「担当へCHAT」 button

### Requirement 3: 「確認」フィールドのデータベース実装

**User Story:** As a システム管理者, I want 物件の確認状態をデータベースで管理する, so that 確認状態を永続化できる

#### Acceptance Criteria

1. THE Property_Listing_System SHALL store Confirmation_Field in the property_listings table
2. THE Confirmation_Field SHALL accept only two values: 「未」 or 「済」
3. THE Property_Listing_System SHALL set Confirmation_Field to 「未」 as the default value for new properties
4. WHEN Confirmation_Field is updated, THE Property_Listing_System SHALL record the update timestamp

### Requirement 4: 「確認」フィールドのスプレッドシート同期

**User Story:** As a データ管理者, I want 確認状態がスプレッドシートと同期される, so that スプレッドシートでも確認状態を確認・編集できる

#### Acceptance Criteria

1. THE Property_Listing_System SHALL synchronize Confirmation_Field with Spreadsheet_DQ_Column (column 120)
2. WHEN Confirmation_Field is updated in the database, THE Property_Listing_System SHALL update Spreadsheet_DQ_Column within 5 seconds
3. WHEN Spreadsheet_DQ_Column is updated, THE Property_Listing_System SHALL update Confirmation_Field in the database within 10 minutes
4. THE Property_Listing_System SHALL validate that Spreadsheet_DQ_Column contains only 「未」 or 「済」 values
5. IF Spreadsheet_DQ_Column contains an invalid value, THEN THE Property_Listing_System SHALL log an error and skip synchronization for that property

### Requirement 5: 「確認」フィールドのUI表示

**User Story:** As a 営業担当者, I want 物件詳細ページで確認状態を変更できる, so that 確認作業を効率的に進められる

#### Acceptance Criteria

1. THE Property_Detail_Page SHALL display Confirmation_Field as a button toggle with two options: 「未」 and 「済」
2. WHEN a user clicks 「未」 button, THE Property_Listing_System SHALL set Confirmation_Field to 「未」
3. WHEN a user clicks 「済」 button, THE Property_Listing_System SHALL set Confirmation_Field to 「済」
4. THE Property_Listing_System SHALL visually indicate the currently selected value
5. WHEN Confirmation_Field is updated, THE Property_Listing_System SHALL display a success notification

### Requirement 6: サイドバーの「未完了」カテゴリ表示

**User Story:** As a 営業担当者, I want 確認が未完了の物件を一覧で確認できる, so that 確認漏れを防げる

#### Acceptance Criteria

1. THE Sidebar SHALL display a 「未完了」 category
2. THE 「未完了」 category SHALL show the count of properties where Confirmation_Field equals 「未」
3. WHEN a user clicks the 「未完了」 category, THE Property_Listing_System SHALL filter and display only properties with Confirmation_Field equal to 「未」
4. THE 「未完了」 category SHALL update the count in real-time when Confirmation_Field is changed
5. THE 「未完了」 category SHALL be displayed at the top of the Sidebar with high priority styling

### Requirement 7: 「確認」フィールドの初期値設定

**User Story:** As a システム管理者, I want 既存物件の確認フィールドに初期値を設定する, so that システムが正常に動作する

#### Acceptance Criteria

1. THE Property_Listing_System SHALL set Confirmation_Field to 「未」 for all existing properties where Confirmation_Field is null
2. THE Property_Listing_System SHALL execute the initial value setting as a one-time migration
3. THE Property_Listing_System SHALL log the number of properties updated during migration
4. THE Property_Listing_System SHALL complete the migration within 60 seconds for up to 10,000 properties

### Requirement 8: エラーハンドリング

**User Story:** As a システム管理者, I want エラーが適切に処理される, so that システムの安定性を保てる

#### Acceptance Criteria

1. IF the chat application fails to open, THEN THE Property_Listing_System SHALL display an error message to the user
2. IF Confirmation_Field update fails, THEN THE Property_Listing_System SHALL display an error message and retain the previous value
3. IF Spreadsheet synchronization fails, THEN THE Property_Listing_System SHALL retry up to 3 times with exponential backoff
4. THE Property_Listing_System SHALL log all errors with timestamp, property_number, and error details

### Requirement 9: パフォーマンス要件

**User Story:** As a ユーザー, I want システムが高速に動作する, so that ストレスなく作業できる

#### Acceptance Criteria

1. WHEN 「事務へCHAT」 button is clicked, THE Property_Listing_System SHALL open the chat application within 1 second
2. WHEN Confirmation_Field is updated, THE Property_Listing_System SHALL update the UI within 500 milliseconds
3. WHEN the Sidebar is rendered, THE Property_Listing_System SHALL calculate the 「未完了」 count within 200 milliseconds for up to 10,000 properties
4. THE Property_Listing_System SHALL synchronize Confirmation_Field to Spreadsheet_DQ_Column without blocking the UI

### Requirement 10: アクセシビリティ要件

**User Story:** As a 視覚障害のあるユーザー, I want スクリーンリーダーで操作できる, so that 平等にシステムを利用できる

#### Acceptance Criteria

1. THE 「事務へCHAT」 button SHALL have an appropriate aria-label
2. THE Confirmation_Field toggle buttons SHALL have appropriate aria-labels
3. WHEN Confirmation_Field is updated, THE Property_Listing_System SHALL announce the change to screen readers using aria-live
4. THE Sidebar 「未完了」 category SHALL have an appropriate aria-label with the current count
