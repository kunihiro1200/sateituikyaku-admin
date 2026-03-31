# 要件定義書

## はじめに

売主リストの通話モードページに「専任他決打合せ」フィールドを追加する機能を実装します。このフィールドは、専任、他決、または一般が決定した売主に対して、打合せ内容を記録するために使用されます。

## 用語集

- **System**: 売主管理システム（`backend/src/`）
- **CallModePage**: 売主リストの通話モードページ（`/sellers/:id/call`）
- **ステータスセクション**: 通話モードページの「ステータス」セクション
- **専任（他決）決定日**: 専任または他決が決定した日付を記録するフィールド
- **専任他決打合せ**: 専任または他決が決定した売主に対する打合せ内容を記録するフィールド（新規追加）
- **確度フィールド**: 売主の確度（A, B, B', C, D, E, ダブり）を記録するフィールド
- **スプレッドシート**: Google スプレッドシートの売主リスト（CZ列が「専任他決打合せ」）
- **Database**: Supabaseデータベースの`sellers`テーブル

## 要件

### 要件1: 専任他決打合せフィールドの表示

**ユーザーストーリー**: 営業担当者として、専任、他決、または一般が決定した売主に対する打合せ内容を記録したい。そのため、通話モードページのステータスセクションに「専任他決打合せ」フィールドを表示してほしい。

#### 受入基準

1. WHEN 売主のステータスに「専任」、「他決」、または「一般」が含まれる場合、THE System SHALL ステータスセクションに「専任他決打合せ」フィールドを表示する
2. WHEN 「専任（他決）決定日」フィールドが表示される場合、THE System SHALL 「専任他決打合せ」フィールドを「確度」フィールドの上に表示する
3. THE System SHALL 「専任他決打合せ」フィールドをテキストフィールド（複数行）として表示する
4. THE System SHALL 「専任他決打合せ」フィールドのラベルを「専任他決打合せ」とする
5. WHEN 売主のステータスに「専任」、「他決」、または「一般」が含まれない場合、THE System SHALL 「専任他決打合せ」フィールドを表示しない

### 要件2: 専任他決打合せフィールドのデータ同期

**ユーザーストーリー**: 営業担当者として、通話モードページで入力した「専任他決打合せ」の内容をスプレッドシートとデータベースに保存したい。そのため、保存ボタンをクリックしたときに自動的に同期してほしい。

#### 受入基準

1. WHEN ユーザーが「専任他決打合せ」フィールドに入力してステータス保存ボタンをクリックした場合、THE System SHALL 入力内容をデータベースの`sellers.exclusive_other_decision_meeting`カラムに保存する
2. WHEN データベースへの保存が成功した場合、THE System SHALL スプレッドシートのCZ列（列番号104、0-indexed: 103）に同じ内容を同期する
3. WHEN スプレッドシートのCZ列が更新された場合、THE System SHALL データベースの`sellers.exclusive_other_decision_meeting`カラムに同じ内容を同期する
4. THE System SHALL 「専任他決打合せ」フィールドの値を文字列型（TEXT）として保存する
5. WHEN 「専任他決打合せ」フィールドが空の場合、THE System SHALL データベースとスプレッドシートに`null`を保存する

### 要件3: データベーススキーマの追加

**ユーザーストーリー**: システム管理者として、「専任他決打合せ」フィールドのデータを保存するために、データベースに新しいカラムを追加したい。

#### 受入基準

1. THE System SHALL `sellers`テーブルに`exclusive_other_decision_meeting`カラムを追加する
2. THE System SHALL `exclusive_other_decision_meeting`カラムのデータ型を`TEXT`とする
3. THE System SHALL `exclusive_other_decision_meeting`カラムを`NULL`許可とする
4. THE System SHALL `exclusive_other_decision_meeting`カラムのデフォルト値を`NULL`とする

### 要件4: カラムマッピングの追加

**ユーザーストーリー**: システム管理者として、スプレッドシートとデータベースのカラムマッピングを定義したい。そのため、`column-mapping.json`に「専任他決打合せ」のマッピングを追加してほしい。

#### 受入基準

1. THE System SHALL `backend/src/config/column-mapping.json`の`spreadsheetToDatabase`セクションに`"専任他決打合せ": "exclusive_other_decision_meeting"`を追加する
2. THE System SHALL `backend/src/config/column-mapping.json`の`databaseToSpreadsheet`セクションに`"exclusive_other_decision_meeting": "専任他決打合せ"`を追加する
3. THE System SHALL `backend/src/config/column-mapping.json`の`typeConversions`セクションに`"exclusive_other_decision_meeting": "string"`を追加する

### 要件5: APIレスポンスへの追加

**ユーザーストーリー**: フロントエンド開発者として、通話モードページで「専任他決打合せ」フィールドを表示するために、APIレスポンスに`exclusiveOtherDecisionMeeting`フィールドを含めてほしい。

#### 受入基準

1. WHEN `/api/sellers/:id`エンドポイントが呼び出された場合、THE System SHALL レスポンスに`exclusiveOtherDecisionMeeting`フィールドを含める
2. THE System SHALL `exclusiveOtherDecisionMeeting`フィールドの値をデータベースの`exclusive_other_decision_meeting`カラムから取得する
3. WHEN `exclusive_other_decision_meeting`カラムが`NULL`の場合、THE System SHALL `exclusiveOtherDecisionMeeting`フィールドを`null`として返す
4. THE System SHALL `SellerService.decryptSeller()`メソッドに`exclusiveOtherDecisionMeeting`フィールドを追加する

### 要件6: フロントエンドの状態管理

**ユーザーストーリー**: フロントエンド開発者として、「専任他決打合せ」フィールドの入力状態を管理したい。そのため、Reactの状態管理を実装してほしい。

#### 受入基準

1. THE System SHALL `CallModePage`コンポーネントに`editedExclusiveOtherDecisionMeeting`状態を追加する
2. THE System SHALL `editedExclusiveOtherDecisionMeeting`の初期値を売主データの`exclusiveOtherDecisionMeeting`フィールドから取得する
3. WHEN ユーザーが「専任他決打合せ」フィールドに入力した場合、THE System SHALL `editedExclusiveOtherDecisionMeeting`状態を更新する
4. WHEN ステータス保存ボタンがクリックされた場合、THE System SHALL `editedExclusiveOtherDecisionMeeting`の値をAPIリクエストに含める

### 要件7: 保存処理の実装

**ユーザーストーリー**: 営業担当者として、「専任他決打合せ」フィールドの内容を保存したい。そのため、ステータス保存ボタンをクリックしたときに自動的に保存してほしい。

#### 受入基準

1. WHEN ユーザーがステータス保存ボタンをクリックした場合、THE System SHALL `editedExclusiveOtherDecisionMeeting`の値を`/api/sellers/:id`エンドポイントに送信する
2. THE System SHALL `exclusiveOtherDecisionMeeting`フィールドを`handleUpdateStatus()`関数のAPIリクエストに含める
3. WHEN 保存が成功した場合、THE System SHALL 「ステータスを更新しました」というメッセージを表示する
4. WHEN 保存が成功した場合、THE System SHALL 売主データを再読み込みする

### 要件8: スプレッドシート同期の実装

**ユーザーストーリー**: システム管理者として、「専任他決打合せ」フィールドの内容をスプレッドシートに同期したい。そのため、自動同期サービスに同期処理を追加してほしい。

#### 受入基準

1. THE System SHALL `EnhancedAutoSyncService.syncSingleSeller()`メソッドに「専任他決打合せ」フィールドの同期処理を追加する
2. THE System SHALL `EnhancedAutoSyncService.updateSingleSeller()`メソッドに「専任他決打合せ」フィールドの同期処理を追加する
3. WHEN スプレッドシートのCZ列（列番号104、0-indexed: 103）が更新された場合、THE System SHALL データベースの`exclusive_other_decision_meeting`カラムに同じ内容を同期する
4. WHEN データベースの`exclusive_other_decision_meeting`カラムが更新された場合、THE System SHALL スプレッドシートのCZ列に同じ内容を同期する

### 要件9: 型定義の追加

**ユーザーストーリー**: フロントエンド開発者として、TypeScriptの型安全性を保つために、`Seller`型に`exclusiveOtherDecisionMeeting`フィールドを追加してほしい。

#### 受入基準

1. THE System SHALL `frontend/frontend/src/types/index.ts`の`Seller`型に`exclusiveOtherDecisionMeeting?: string`フィールドを追加する
2. THE System SHALL `backend/src/types/index.ts`の`Seller`型に`exclusive_other_decision_meeting?: string`フィールドを追加する

## 技術的背景

### 関連ファイル

#### フロントエンド
- `frontend/frontend/src/pages/CallModePage.tsx`: 通話モードページのメインコンポーネント
- `frontend/frontend/src/types/index.ts`: TypeScript型定義

#### バックエンド
- `backend/src/services/SellerService.supabase.ts`: 売主サービス（APIレスポンス生成）
- `backend/src/services/EnhancedAutoSyncService.ts`: スプレッドシート同期サービス
- `backend/src/config/column-mapping.json`: カラムマッピング定義
- `backend/src/types/index.ts`: TypeScript型定義

#### データベース
- `backend/supabase/migrations/`: マイグレーションファイル（新規作成）

### スプレッドシート仕様

- **カラム名**: 「専任他決打合せ」
- **列位置**: CZ列（列番号104、0-indexed: 103）
- **データ型**: 文字列（TEXT）

### データベース仕様

- **テーブル**: `sellers`
- **カラム名**: `exclusive_other_decision_meeting`
- **データ型**: `TEXT`
- **NULL許可**: `YES`
- **デフォルト値**: `NULL`

## 制約事項

1. 「専任他決打合せ」フィールドは、ステータスに「専任」または「他決」が含まれる場合のみ表示される
2. 「専任他決打合せ」フィールドは、「確度」フィールドの上に配置される
3. 「専任他決打合せ」フィールドは、複数行のテキストフィールドとして表示される
4. 「専任他決打合せ」フィールドは、必須項目ではない（空欄でも保存可能）
5. スプレッドシートのCZ列（列番号104、0-indexed: 103）とデータベースの`exclusive_other_decision_meeting`カラムは常に同期される

## 参考資料

- `seller-table-column-definition.md`: 売主テーブルのカラム定義
- `seller-spreadsheet-column-mapping.md`: スプレッドシートのカラムマッピング
- `backend-architecture.md`: バックエンドアーキテクチャ定義
