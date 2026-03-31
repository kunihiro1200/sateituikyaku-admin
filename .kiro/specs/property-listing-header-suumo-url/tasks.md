# 実装計画: property-listing-header-suumo-url

## 概要

物件リストの「レインズ登録・サイト入力」ページに物件基本情報ヘッダーとSuumo URLフィールドを追加し、データベース⇔スプレッドシート間の相互同期とGmail送信時の自動埋め込みを実装します。

## タスク

- [x] 1. データベーススキーマとスプレッドシートカラムの確認
  - `property_listings`テーブルに`suumo_url`カラムが存在することを確認
  - 物件リストスプレッドシートのCX列「Suumo URL」が存在することを確認
  - カラムマッピング定義に`suumo_url`が含まれていることを確認
  - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3_

- [x] 2. バックエンド：スプレッドシート同期サービスの実装
  - [x] 2.1 PropertyListingSyncQueueクラスを作成
    - `backend/src/services/PropertyListingSyncQueue.ts`を作成
    - キューイング機能（enqueue, process）を実装
    - リトライロジック（最大3回、Exponential backoff）を実装
    - _Requirements: 3.2, 3.5, 3.6_
  
  - [ ]* 2.2 PropertyListingSyncQueueのプロパティテストを作成
    - **Property 3: 同期キューのエンキュー**
    - **Validates: Requirements 3.2, 5.7**
  
  - [x] 2.3 PropertyListingSpreadsheetSyncクラスを作成
    - `backend/src/services/PropertyListingSpreadsheetSync.ts`を作成
    - syncToSpreadsheet()メソッドを実装（DB → スプレッドシート）
    - findRowIndex()メソッドを実装（物件番号で行を検索）
    - updateRow()メソッドを実装（CX列を更新）
    - _Requirements: 3.3, 4.2_
  
  - [ ]* 2.4 PropertyListingSpreadsheetSyncのプロパティテストを作成
    - **Property 2: スプレッドシート同期のラウンドトリップ**
    - **Validates: Requirements 3.3, 4.2**
  
  - [ ]* 2.5 同期リトライとログ記録のプロパティテストを作成
    - **Property 4: 同期リトライとログ記録**
    - **Validates: Requirements 3.5, 3.6**

- [x] 3. バックエンド：PropertyListingServiceの拡張
  - [x] 3.1 PropertyListingServiceにSyncQueueを統合
    - `backend/src/services/PropertyListingService.ts`を編集
    - update()メソッドに同期キューのenqueue処理を追加
    - getByPropertyNumber()メソッドが`suumo_url`を返すことを確認
    - _Requirements: 2.4, 2.5, 3.1, 3.2_
  
  - [ ]* 3.2 PropertyListingServiceのプロパティテストを作成
    - **Property 1: Suumo URL保存のラウンドトリップ**
    - **Validates: Requirements 2.4, 2.5, 3.1, 5.6**

- [x] 4. Checkpoint - バックエンドの動作確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 5. フロントエンド：レインズ登録ページのヘッダー情報表示
  - [x] 5.1 PropertyHeaderInfoコンポーネントを作成
    - `frontend/frontend/src/components/PropertyHeaderInfo.tsx`を作成
    - 物件所在地、売買価格、営業担当を表示
    - 空欄時のフォールバック表示（「未入力」「価格応談」「未設定」）を実装
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  
  - [ ]* 5.2 PropertyHeaderInfoのユニットテストを作成
    - 空欄時のフォールバック表示をテスト
    - レスポンシブデザインをテスト
    - _Requirements: 1.4, 1.5, 1.6, 10.3_

- [x] 6. フロントエンド：レインズ登録ページのSuumo URLフィールド
  - [x] 6.1 ReinsRegistrationPageにSuumo URLフィールドを追加
    - `frontend/frontend/src/pages/ReinsRegistrationPage.tsx`を編集
    - Suumo URLフィールドを「レインズ証明書メール済み」セクションの下に配置
    - テキスト入力欄、「開く」ボタン、プレースホルダーを実装
    - URL形式バリデーション（`/^https:\/\/suumo\.jp\/.+/`）を実装
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  
  - [ ]* 6.2 Suumo URLフィールドのユニットテストを作成
    - URL形式バリデーションをテスト
    - 「開く」ボタンの活性化/非活性化をテスト
    - エラーハンドリングをテスト
    - _Requirements: 2.4, 2.5, 9.1, 9.4, 9.5_

- [x] 7. フロントエンド：物件詳細画面のSuumo URLフィールド
  - [x] 7.1 PropertyListingDetailPageにSuumo URLフィールドを追加
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`を編集
    - 「地図・サイトURL」セクションにSuumo URLフィールドを追加
    - EditableUrlFieldコンポーネントを使用
    - リンクアイコンと編集機能を実装
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_
  
  - [ ]* 7.2 物件詳細画面のSuumo URLフィールドのユニットテストを作成
    - 編集機能をテスト
    - リンクアイコンのクリックをテスト
    - 空欄時の「未設定」表示をテスト
    - _Requirements: 5.4, 5.5, 5.6, 5.8_

- [x] 8. フロントエンド：Gmail送信時のSuumo URL埋め込み
  - [x] 8.1 buildEmailBody()関数を拡張
    - `frontend/frontend/src/utils/emailBuilder.ts`（または該当ファイル）を編集
    - メール本文テンプレートに「■SUUMO」セクションを追加
    - Suumo URLが存在する場合のみURLを埋め込む
    - メール本文のフォーマットを維持
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ]* 8.2 buildEmailBody()のプロパティテストを作成
    - **Property 5: Gmail本文へのSuumo URL埋め込み**
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5**
  
  - [ ]* 8.3 buildEmailBody()のユニットテストを作成
    - Suumo URLあり/なしの両方のケースをテスト
    - メール本文フォーマットをテスト
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [x] 9. Checkpoint - フロントエンドの動作確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 10. 統合とワイヤリング
  - [x] 10.1 ReinsRegistrationPageにPropertyHeaderInfoを統合
    - ヘッダー情報を物件番号の下に配置
    - APIから物件データを取得してヘッダーに表示
    - _Requirements: 1.7_
  
  - [x] 10.2 エラーハンドリングの統合
    - データベース更新失敗時のSnackbar表示を実装
    - スプレッドシート同期失敗時のログ記録を実装
    - _Requirements: 9.1, 9.2, 9.4, 9.5_
  
  - [ ]* 10.3 エラーハンドリングのプロパティテストを作成
    - **Property 6: データベース更新失敗時のエラーメッセージ**
    - **Validates: Requirements 9.1**
  
  - [ ]* 10.4 スプレッドシート同期失敗のプロパティテストを作成
    - **Property 7: スプレッドシート同期失敗時のエラーログ**
    - **Validates: Requirements 9.2, 9.5**

- [x] 11. UI/UXの最終調整
  - [x] 11.1 Material-UIスタイルの適用
    - 既存フィールドと一貫したスタイルを適用
    - レスポンシブデザインを実装（モバイル・デスクトップ）
    - フォーカス時のハイライトを実装
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 11.2 Snackbar通知の実装
    - 保存成功時の緑色Snackbarを実装
    - エラー時の赤色Snackbarを実装
    - _Requirements: 10.6, 10.7_

- [x] 12. 最終Checkpoint - 全機能の動作確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

## 注意事項

- `*`マークのタスクはオプションで、スキップ可能です
- 各タスクは具体的な要件番号を参照しています
- Checkpointで段階的に検証を行います
- プロパティテストは対応する実装タスクの直後に配置されています
- データベースの`suumo_url`カラムとスプレッドシートのCX列「Suumo URL」は既に存在するため、マイグレーションは不要です
