# Requirements Document

## Introduction

物件リストの「レインズ登録・サイト入力」ヘッダーに、物件の基本情報（所在地、価格、営業担当）を表示し、Suumo URLフィールドを追加する機能です。この機能により、レインズ登録作業時に必要な情報を一目で確認でき、Suumo URLをスプレッドシートと相互同期できるようになります。

## Glossary

- **レインズ登録ページ**: 物件リスト詳細画面から遷移する、レインズ証明書メール送信やサイト入力状況を管理するページ（`/property-listings/:propertyNumber/reins-registration`）
- **物件リストスプレッドシート**: 物件データを管理するGoogle スプレッドシート（`PROPERTY_LISTING_SPREADSHEET_ID`）
- **物件詳細画面**: 物件の詳細情報を表示・編集する画面（`/property-listings/:propertyNumber`）
- **Database**: Supabaseの`property_listings`テーブル
- **GAS**: Google Apps Script（物件リストスプレッドシート → データベースの10分ごと同期を担当）
- **SyncQueue**: データベース → スプレッドシートの即時同期を担当するサービス

## Requirements

### Requirement 1: ヘッダー情報の表示

**User Story:** レインズ登録作業者として、ヘッダーに物件の基本情報（所在地、価格、営業担当）を表示したい。これにより、別画面を開かずに必要な情報を確認できる。

#### Acceptance Criteria

1. WHEN レインズ登録ページを開く、THE System SHALL ヘッダーに物件所在地を表示する
2. WHEN レインズ登録ページを開く、THE System SHALL ヘッダーに売買価格を表示する（万円単位、カンマ区切り）
3. WHEN レインズ登録ページを開く、THE System SHALL ヘッダーに営業担当の名前を表示する
4. IF 物件所在地が空欄、THEN THE System SHALL 「未入力」と表示する
5. IF 売買価格が空欄、THEN THE System SHALL 「価格応談」と表示する
6. IF 営業担当が空欄、THEN THE System SHALL 「未設定」と表示する
7. THE System SHALL ヘッダー情報を物件番号の下に表示する
8. THE System SHALL ヘッダー情報を読み取り専用で表示する（編集不可）

---

### Requirement 2: Suumo URLフィールドの追加（レインズ登録ページ）

**User Story:** レインズ登録作業者として、レインズ登録ページでSuumo URLを入力・編集したい。これにより、サイト入力状況を一元管理できる。

#### Acceptance Criteria

1. THE System SHALL レインズ登録ページに「Suumo URL」フィールドを追加する
2. THE System SHALL 「Suumo URL」フィールドを「レインズ証明書メール済み」セクションの下に配置する
3. THE System SHALL 「Suumo URL」フィールドにテキスト入力欄を表示する
4. WHEN ユーザーがSuumo URLを入力、THE System SHALL 入力値をデータベースの`suumo_url`カラムに保存する
5. WHEN ユーザーがSuumo URLを編集、THE System SHALL 変更をデータベースに即座に反映する
6. THE System SHALL Suumo URLフィールドに「開く」ボタンを表示する
7. WHEN ユーザーが「開く」ボタンをクリック、THE System SHALL 入力されたURLを新しいタブで開く
8. IF Suumo URLが空欄、THEN THE System SHALL 「開く」ボタンを非活性にする
9. THE System SHALL Suumo URLフィールドにプレースホルダー「https://suumo.jp/...」を表示する

---

### Requirement 3: Suumo URLのスプレッドシート同期（データベース → スプレッドシート）

**User Story:** システム管理者として、データベースで更新されたSuumo URLをスプレッドシートに即座に同期したい。これにより、スプレッドシートが常に最新の状態を保つ。

#### Acceptance Criteria

1. WHEN ユーザーがレインズ登録ページでSuumo URLを保存、THE System SHALL データベースの`suumo_url`カラムを更新する
2. WHEN データベースの`suumo_url`カラムが更新される、THE System SHALL SyncQueueに同期タスクをエンキューする
3. WHEN SyncQueueが同期タスクを処理、THE System SHALL スプレッドシートのCX列（「Suumo URL」カラム）を更新する
4. THE System SHALL 同期を数秒以内に完了する
5. IF 同期が失敗、THEN THE System SHALL 最大3回まで自動リトライする（Exponential backoff）
6. THE System SHALL 同期結果をログに記録する

---

### Requirement 4: Suumo URLのスプレッドシート同期（スプレッドシート → データベース）

**User Story:** システム管理者として、スプレッドシートで更新されたSuumo URLをデータベースに定期同期したい。これにより、スプレッドシートでの直接編集もシステムに反映される。

#### Acceptance Criteria

1. THE System SHALL GASの10分トリガーでスプレッドシートのCX列（「Suumo URL」カラム）を読み取る
2. WHEN スプレッドシートのSuumo URLが変更されている、THE System SHALL データベースの`suumo_url`カラムを更新する
3. THE System SHALL 同期を10分ごとに自動実行する
4. THE System SHALL 同期結果をログに記録する
5. IF 同期が失敗、THEN THE System SHALL 次回の10分トリガーで再試行する

---

### Requirement 5: Suumo URLフィールドの追加（物件詳細画面）

**User Story:** 物件管理者として、物件詳細画面の「地図・サイトURL」セクションでSuumo URLを確認・編集したい。これにより、物件情報を一元的に管理できる。

#### Acceptance Criteria

1. THE System SHALL 物件詳細画面の「地図・サイトURL」セクションに「Suumo URL」フィールドを追加する
2. THE System SHALL 「Suumo URL」フィールドを「地図URL」フィールドの下に配置する
3. THE System SHALL 「Suumo URL」フィールドに現在のURLを表示する
4. THE System SHALL 「Suumo URL」フィールドに「編集」ボタンを表示する
5. WHEN ユーザーが「編集」ボタンをクリック、THE System SHALL テキスト入力欄を表示する
6. WHEN ユーザーがSuumo URLを入力して保存、THE System SHALL データベースの`suumo_url`カラムを更新する
7. THE System SHALL 保存後にスプレッドシートへの同期を自動実行する
8. IF Suumo URLが空欄、THEN THE System SHALL 「未設定」と表示する
9. THE System SHALL Suumo URLにリンクアイコンを表示する
10. WHEN ユーザーがリンクアイコンをクリック、THE System SHALL URLを新しいタブで開く

---

### Requirement 6: スプレッドシートカラムの追加

**User Story:** システム管理者として、物件リストスプレッドシートにSuumo URLカラムを追加したい。これにより、スプレッドシートでもSuumo URLを管理できる。

#### Acceptance Criteria

1. THE System SHALL 物件リストスプレッドシートのCX列に「Suumo URL」カラムを追加する
2. THE System SHALL 「Suumo URL」カラムをテキスト形式で保存する
3. THE System SHALL 既存の物件データに対して空欄で初期化する
4. THE System SHALL カラムマッピング定義（`property-listing-column-mapping.json`）に`suumo_url`を追加する
5. THE System SHALL カラムマッピングの`spreadsheetToDatabase`セクションに`"Suumo URL": "suumo_url"`を追加する
6. THE System SHALL カラムマッピングの`databaseToSpreadsheet`セクションに`"suumo_url": "Suumo URL"`を追加する

---

### Requirement 7: データベーススキーマの更新

**User Story:** システム管理者として、`property_listings`テーブルに`suumo_url`カラムを追加したい。これにより、Suumo URLをデータベースで管理できる。

#### Acceptance Criteria

1. THE System SHALL `property_listings`テーブルに`suumo_url`カラムを追加する
2. THE System SHALL `suumo_url`カラムをTEXT型で定義する
3. THE System SHALL `suumo_url`カラムをNULL許可で定義する
4. THE System SHALL マイグレーションスクリプトを作成する
5. THE System SHALL マイグレーション実行後、既存データに対して`suumo_url`をNULLで初期化する

---

### Requirement 8: Gmail送信時のSuumo URL埋め込み

**User Story:** レインズ登録作業者として、Gmail送信時にSuumo URLを自動的にメール本文に埋め込みたい。これにより、手動でURLをコピー&ペーストする手間を省ける。

#### Acceptance Criteria

1. WHEN ユーザーがレインズ登録ページで「Gmail送信」ボタンをクリック、THE System SHALL メール本文テンプレートにSuumo URLを埋め込む
2. IF Suumo URLが入力されている、THEN THE System SHALL メール本文の「■SUUMO」行の下にURLを追加する
3. IF Suumo URLが空欄、THEN THE System SHALL 「■SUUMO」行のみを表示する（URLなし）
4. THE System SHALL メール本文のフォーマットを維持する
5. THE System SHALL Suumo URLを改行で区切って表示する

---

### Requirement 9: エラーハンドリング

**User Story:** システム管理者として、Suumo URL関連のエラーを適切に処理したい。これにより、システムの安定性を保つ。

#### Acceptance Criteria

1. IF データベース更新が失敗、THEN THE System SHALL エラーメッセージ「Suumo URLの保存に失敗しました」を表示する
2. IF スプレッドシート同期が失敗、THEN THE System SHALL エラーログに記録する
3. IF GAS同期が失敗、THEN THE System SHALL 次回の10分トリガーで再試行する
4. THE System SHALL エラー発生時にユーザーに通知する（Snackbar）
5. THE System SHALL エラー詳細をコンソールログに出力する

---

### Requirement 10: UI/UXの一貫性

**User Story:** ユーザーとして、Suumo URLフィールドが既存のUIと一貫したデザインであることを期待する。これにより、直感的に操作できる。

#### Acceptance Criteria

1. THE System SHALL Suumo URLフィールドを既存のフィールドと同じスタイルで表示する
2. THE System SHALL Material-UIのコンポーネントを使用する
3. THE System SHALL レスポンシブデザインに対応する（モバイル・デスクトップ）
4. THE System SHALL フィールドラベルを太字で表示する
5. THE System SHALL 入力欄にフォーカス時のハイライトを表示する
6. THE System SHALL 保存成功時に緑色のSnackbarを表示する
7. THE System SHALL エラー時に赤色のSnackbarを表示する

---

## まとめ

この要件定義により、以下の機能が実現されます：

1. **ヘッダー情報の表示**: レインズ登録ページのヘッダーに物件所在地、価格、営業担当を表示
2. **Suumo URLフィールドの追加**: レインズ登録ページと物件詳細画面にSuumo URL入力欄を追加
3. **スプレッドシート同期**: データベース ⇔ スプレッドシート間でSuumo URLを相互同期
4. **Gmail送信時の自動埋め込み**: メール本文にSuumo URLを自動挿入
5. **エラーハンドリング**: 適切なエラー処理とユーザー通知

これらの機能により、レインズ登録作業の効率が向上し、データの一貫性が保たれます。

---

**最終更新日**: 2026年3月25日  
**作成者**: Kiro AI Assistant  
**機能名**: property-listing-header-suumo-url
