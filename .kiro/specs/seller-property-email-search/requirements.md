# Requirements Document

## Introduction

売主リスト一覧と物件リスト一覧の検索バーにメールアドレス検索機能を追加します。現在、買主リストでは既にメールアドレス検索が実装されていますが、売主リストと物件リストではメールアドレスが検索できません。この機能により、メールアドレスを使って売主や物件（売主のメールアドレス経由）を素早く検索できるようになります。

## Glossary

- **Search_Bar**: 売主リスト一覧・物件リスト一覧画面の上部に配置されている検索入力フィールド
- **Seller_Service**: バックエンドで売主データの検索・取得を担当するサービスクラス（`backend/src/services/SellerService.supabase.ts`）
- **Property_Listing_Service**: バックエンドで物件データの検索・取得を担当するサービスクラス（`backend/src/services/PropertyListingService.ts`）
- **Email_Address**: 売主テーブルの`email`カラムに保存されているメールアドレス（暗号化済み）
- **Seller_Email_Address**: 物件リストテーブルの`seller_email`カラムに保存されている売主のメールアドレス（平文）
- **ILIKE_Search**: PostgreSQLの大文字小文字を区別しない部分一致検索

## Requirements

### Requirement 1: 売主リスト検索バーにメールアドレス検索機能を追加

**User Story:** As a ユーザー, I want 売主リスト検索バーにメールアドレスを入力して売主を検索できる, so that メールアドレスから素早く売主情報を見つけられる

#### Acceptance Criteria

1. WHEN ユーザーが検索バーにメールアドレス（または一部）を入力, THE Search_Bar SHALL メールアドレスで部分一致検索を実行する
2. THE Seller_Service SHALL 既存の検索条件（売主番号、名前、住所、電話番号）に加えて、メールアドレスでも検索する
3. THE Seller_Service SHALL 暗号化されたメールアドレスを復号化してから検索する
4. WHEN 検索結果が複数ある, THE Search_Bar SHALL 全ての一致する売主を表示する
5. THE Search_Bar SHALL 既存の検索機能（売主番号、名前、住所、電話番号）に影響を与えない

### Requirement 2: 物件リスト検索バーにメールアドレス検索機能を追加

**User Story:** As a ユーザー, I want 物件リスト検索バーにメールアドレスを入力して物件を検索できる, so that 売主のメールアドレスから素早く物件情報を見つけられる

#### Acceptance Criteria

1. WHEN ユーザーが検索バーにメールアドレス（または一部）を入力, THE Search_Bar SHALL 売主のメールアドレスで部分一致検索を実行する
2. THE Property_Listing_Service SHALL 既存の検索条件（物件番号）に加えて、売主のメールアドレスでも検索する
3. THE Property_Listing_Service SHALL ILIKE_Searchを使用して大文字小文字を区別せずにメールアドレスを検索する
4. WHEN 検索結果が複数ある, THE Search_Bar SHALL 全ての一致する物件を表示する
5. THE Search_Bar SHALL 既存の検索機能（物件番号）に影響を与えない

### Requirement 3: 検索パフォーマンスの維持

**User Story:** As a ユーザー, I want メールアドレス検索が既存の検索と同じ速度で動作する, so that 検索体験が低下しない

#### Acceptance Criteria

1. THE Seller_Service SHALL メールアドレス検索を既存の復号化後検索ロジックに追加する
2. THE Property_Listing_Service SHALL メールアドレス検索を既存のILIKE検索に追加する
3. THE Seller_Service SHALL 検索クエリの実行時間が既存の検索と同等である（暗号化フィールド検索のため全件取得が必要）
4. THE Property_Listing_Service SHALL 検索クエリの実行時間が既存の検索と同等である（500ms以内）
5. WHEN 検索バーが空, THE Search_Bar SHALL 全売主・全物件を表示する（既存の動作を維持）
