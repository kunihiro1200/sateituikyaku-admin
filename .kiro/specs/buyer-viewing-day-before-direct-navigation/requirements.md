# Requirements Document

## Introduction

買主リストの「内覧日前日」カテゴリから案件をクリックした際に、詳細画面ではなく内覧ページを直接開く機能を実装します。これにより、内覧日前日の案件について、すぐに内覧情報を確認・編集できるようになります。

## Glossary

- **買主リスト**: 買主の一覧を表示するページ（`/buyers`）
- **内覧日前日カテゴリ**: サイドバーに表示される「②内覧日前日」カテゴリ
- **詳細画面**: 買主の詳細情報を表示するページ（`/buyers/:id`）
- **内覧ページ**: 買主の内覧情報を表示・編集するページ（`/buyers/:id/viewing-result`）
- **BuyersPage**: 買主リストページのコンポーネント
- **BuyerStatusSidebar**: サイドバーのステータスカテゴリを表示するコンポーネント

## Requirements

### Requirement 1: 内覧日前日カテゴリからの直接遷移

**User Story:** As a ユーザー, I want 「内覧日前日」カテゴリから案件をクリックした際に内覧ページを直接開く, so that 内覧情報をすぐに確認・編集できる

#### Acceptance Criteria

1. WHEN ユーザーが「内覧日前日」カテゴリを選択している状態で買主をクリック, THEN THE System SHALL 内覧ページ（`/buyers/:id/viewing-result`）を開く
2. WHEN ユーザーが「内覧日前日」以外のカテゴリを選択している状態で買主をクリック, THEN THE System SHALL 詳細画面（`/buyers/:id`）を開く
3. WHEN ユーザーがカテゴリを選択していない状態（All）で買主をクリック, THEN THE System SHALL 詳細画面（`/buyers/:id`）を開く

### Requirement 2: カテゴリ判定の正確性

**User Story:** As a システム, I want 選択されているカテゴリを正確に判定する, so that 正しいページに遷移できる

#### Acceptance Criteria

1. THE System SHALL サイドバーで選択されているカテゴリキー（`viewingDayBefore`）を日本語表示名（「内覧日前日」）に変換して判定する
2. THE System SHALL カテゴリキーと表示名のマッピングを`categoryKeyToDisplayName`オブジェクトで管理する
3. WHEN カテゴリキーが`viewingDayBefore`の場合, THEN THE System SHALL 表示名「内覧日前日」として判定する

### Requirement 3: 既存機能の維持

**User Story:** As a ユーザー, I want 他のカテゴリからの遷移は従来通り動作する, so that 既存の操作に影響がない

#### Acceptance Criteria

1. THE System SHALL 「内覧日前日」以外のカテゴリからの遷移は詳細画面を開く
2. THE System SHALL モバイル表示でも同じ遷移ロジックを適用する
3. THE System SHALL デスクトップ表示でも同じ遷移ロジックを適用する

### Requirement 4: ルーティングの正確性

**User Story:** As a システム, I want 内覧ページのルートが正しく設定されている, so that ページ遷移が正常に動作する

#### Acceptance Criteria

1. THE System SHALL 内覧ページのルートを`/buyers/:id/viewing-result`として定義する
2. THE System SHALL 買主IDを正しくURLパラメータとして渡す
3. WHEN 内覧ページが存在しない場合, THEN THE System SHALL 404エラーを表示する
