# Requirements Document

## Introduction

査定計算セクションの「査定メール送信」ボタンをクリックした際に、ヘッダーのEmail送信ボタンと同様のテンプレート選択UIを表示する機能。現在の「査定メール送信」ボタンは固定の本文を直接送信するが、スプレッドシートから取得した2種類のテンプレートを選択できるように変更する。また、「査定理由（査定サイトから転記）」フィールドの内容に応じて、表示するテンプレートを自動的に絞り込む。

## Glossary

- **ValuationEmailSelector**: 査定計算セクションの査定メール送信ボタンに追加するテンプレート選択UI
- **SellerEmailTemplate**: スプレッドシートから取得した売主向けEmailテンプレート（`sellerEmailTemplates` state）
- **ValuationReason**: 売主の「査定理由（査定サイトから転記）」フィールド（`seller.valuationReason`）
- **InheritanceTemplate**: 「査定額案内メール（相続）」テンプレート
- **NonInheritanceTemplate**: 「査定額案内メール（相続以外）」テンプレート
- **ConfirmDialog**: メール送信前の確認・編集ダイアログ（既存の `confirmDialog` state）

## Requirements

### Requirement 1: 査定メール送信ボタンのテンプレート選択UI表示

**User Story:** As a 営業担当者, I want 査定メール送信ボタンをクリックした際にテンプレート選択UIが表示される, so that 適切なテンプレートを選んでメールを送信できる。

#### Acceptance Criteria

1. WHEN 査定計算セクションの「査定メール送信」ボタンをクリックする, THE ValuationEmailSelector SHALL ヘッダーのEmail送信ボタンと同様のドロップダウン形式のテンプレート選択UIを表示する
2. THE ValuationEmailSelector SHALL 表示するテンプレートを「査定額案内メール（相続）」と「査定額案内メール（相続以外）」の2種類のみに限定する
3. WHEN テンプレートを選択する, THE ValuationEmailSelector SHALL 既存の `handleEmailTemplateSelect` 関数と同じ処理（プレースホルダー置換・確認ダイアログ表示）を実行する
4. THE ValuationEmailSelector SHALL スプレッドシートから取得済みの `sellerEmailTemplates` を使用してテンプレートの件名・本文を取得する

### Requirement 2: 査定理由による自動フィルタリング

**User Story:** As a 営業担当者, I want 査定理由フィールドの内容に応じて表示テンプレートが自動的に絞り込まれる, so that 状況に合ったテンプレートだけが表示されて選択ミスを防げる。

#### Acceptance Criteria

1. WHEN `seller.valuationReason` に「相続」という文字列が含まれる, THE ValuationEmailSelector SHALL 「査定額案内メール（相続）」のみを表示する
2. WHEN `seller.valuationReason` に「相続」という文字列が含まれない（空欄を含む）, THE ValuationEmailSelector SHALL 「査定額案内メール（相続以外）」のみを表示する
3. THE ValuationEmailSelector SHALL フィルタリングを `sellerEmailTemplates` の `name` フィールドで行う
4. IF フィルタリング後に表示対象テンプレートが0件になる, THEN THE ValuationEmailSelector SHALL 全テンプレートをフィルタリングなしで表示する（フォールバック）

### Requirement 3: 既存機能との整合性

**User Story:** As a 営業担当者, I want 査定メール送信の操作感がヘッダーのEmail送信と同じである, so that 操作を迷わずに行える。

#### Acceptance Criteria

1. WHEN テンプレートを選択する, THE ConfirmDialog SHALL ヘッダーのEmail送信と同じ確認・編集ダイアログを表示する
2. THE ValuationEmailSelector SHALL `seller.email` が未設定の場合は選択を無効化する
3. THE ValuationEmailSelector SHALL `sellerEmailTemplatesLoading` が true の場合は選択を無効化する
4. WHEN テンプレートを選択する, THE ValuationEmailSelector SHALL `replaceEmailPlaceholders` 関数を使用して査定額等のプレースホルダーを置換する

### Requirement 4: 査定メール送信への添付ファイル機能

**User Story:** As a 営業担当者, I want 査定メール送信時にファイルを添付できる, so that 査定書や関連資料をメールに添付して送信できる。

#### Acceptance Criteria

1. THE ValuationEmailSelector SHALL ヘッダーのEmail送信ボタンと同じ添付ファイル機能を提供する
2. WHEN 査定メール送信の確認ダイアログが表示される, THE ConfirmDialog SHALL ヘッダーのEmail送信と同じ添付ファイルUIコンポーネントを表示する
3. THE ValuationEmailSelector SHALL ヘッダーのEmail送信ボタンの添付ファイル機能と同一の実装（コンポーネント・ロジック）を使用する
4. WHEN ファイルが添付された状態でメールを送信する, THE ConfirmDialog SHALL 添付ファイルをメールに含めて送信する
5. THE ValuationEmailSelector SHALL 添付ファイルの選択・削除・表示において、ヘッダーのEmail送信と同じ操作感を提供する
