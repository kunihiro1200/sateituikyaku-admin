# Requirements Document

## Introduction

買主リスト一覧画面の検索バーにメールアドレス検索機能を追加します。現在、検索バーでは買主番号、名前、電話番号、物件番号での検索が可能ですが、メールアドレスでの検索はできません。この機能により、メールアドレスを使って買主を素早く検索できるようになります。

## Glossary

- **Search_Bar**: 買主リスト一覧画面の上部に配置されている検索入力フィールド
- **Buyer_Service**: バックエンドで買主データの検索・取得を担当するサービスクラス（`backend/src/services/BuyerService.ts`）
- **Email_Address**: 買主テーブルの`email`カラムに保存されているメールアドレス
- **ILIKE_Search**: PostgreSQLの大文字小文字を区別しない部分一致検索

## Requirements

### Requirement 1: メールアドレス検索機能の追加

**User Story:** As a ユーザー, I want 検索バーにメールアドレスを入力して買主を検索できる, so that メールアドレスから素早く買主情報を見つけられる

#### Acceptance Criteria

1. WHEN ユーザーが検索バーにメールアドレス（または一部）を入力, THE Search_Bar SHALL メールアドレスで部分一致検索を実行する
2. THE Buyer_Service SHALL 既存の検索条件（買主番号、名前、電話番号、物件番号）に加えて、メールアドレスでも検索する
3. THE Buyer_Service SHALL ILIKE_Searchを使用して大文字小文字を区別せずにメールアドレスを検索する
4. WHEN 検索結果が複数ある, THE Search_Bar SHALL 全ての一致する買主を表示する
5. THE Search_Bar SHALL 既存の検索機能（買主番号、名前、電話番号、物件番号）に影響を与えない

### Requirement 2: 検索パフォーマンスの維持

**User Story:** As a ユーザー, I want メールアドレス検索が既存の検索と同じ速度で動作する, so that 検索体験が低下しない

#### Acceptance Criteria

1. THE Buyer_Service SHALL メールアドレス検索を既存のORクエリに追加する
2. THE Buyer_Service SHALL 検索クエリの実行時間が既存の検索と同等である（500ms以内）
3. WHEN 検索バーが空, THE Buyer_Service SHALL 全買主を表示する（既存の動作を維持）
