# Requirements Document

## Introduction

売主リストのテンプレートメッセージ機能において、売主番号に基づいた条件分岐機能を実装します。現在、テンプレートメッセージ内のプレースホルダーは固定値に置き換えられていますが、売主番号に「FI」が含まれるかどうかで異なる内容に置き換える必要があります。

## Glossary

- **System**: テンプレートメッセージ生成システム
- **Seller**: 売主（売主番号、名前、住所などの情報を持つエンティティ）
- **Seller_Number**: 売主番号（例: AA13501、FI12345など）
- **Template_Message**: テンプレートメッセージ（プレースホルダーを含むメッセージテキスト）
- **Placeholder**: プレースホルダー（`<<当社住所>>`、`<<売買実績ｖ>>`など）
- **CallModePage**: 通話モードページ（売主リストページの通話モード）
- **SMS_Template_Generator**: SMSテンプレート生成関数（`smsTemplateGenerators.ts`内の関数）

## Requirements

### Requirement 1: 当社住所プレースホルダーの条件分岐

**User Story:** As a 営業担当者, I want テンプレートメッセージ内の`<<当社住所>>`プレースホルダーが売主番号に応じて異なる住所に置き換えられる, so that 福岡支店と大分本社で正しい住所を表示できる

#### Acceptance Criteria

1. WHEN 売主番号に「FI」が含まれる, THE System SHALL `<<当社住所>>`を「住所：福岡市中央区六本松４丁目３－２」に置き換える
2. WHEN 売主番号に「FI」が含まれない, THE System SHALL `<<当社住所>>`を「住所：大分市舞鶴町1-3-30STビル１F」に置き換える
3. THE System SHALL 売主番号の大文字・小文字を区別せずに「FI」を検索する
4. WHEN 売主番号がnullまたは空文字列, THE System SHALL デフォルト住所（大分本社）を使用する

### Requirement 2: 売買実績プレースホルダーの条件分岐

**User Story:** As a 営業担当者, I want テンプレートメッセージ内の`<<売買実績ｖ>>`プレースホルダーが売主番号に応じて表示・非表示が切り替わる, so that 福岡支店の売主には売買実績URLを表示しない

#### Acceptance Criteria

1. WHEN 売主番号に「FI」が含まれる, THE System SHALL `<<売買実績ｖ>>`を空文字列（何も表示しない）に置き換える
2. WHEN 売主番号に「FI」が含まれない, THE System SHALL `<<売買実績ｖ>>`を「売買実績はこちら：https://property-site-frontend-kappa.vercel.app/public/properties?view=map」に置き換える
3. THE System SHALL 売主番号の大文字・小文字を区別せずに「FI」を検索する
4. WHEN 売主番号がnullまたは空文字列, THE System SHALL デフォルト値（売買実績URLあり）を使用する

### Requirement 3: プレースホルダー置換関数の実装

**User Story:** As a 開発者, I want プレースホルダーを条件に応じて置き換える汎用関数, so that 全てのSMSテンプレート生成関数で一貫した置換処理を実行できる

#### Acceptance Criteria

1. THE System SHALL `replacePlaceholders(message: string, seller: Seller): string`関数を提供する
2. THE `replacePlaceholders` SHALL メッセージ内の全てのプレースホルダーを検出して置き換える
3. THE `replacePlaceholders` SHALL 売主番号に基づいて条件分岐を実行する
4. THE `replacePlaceholders` SHALL 既存の`[改行]`プレースホルダーを保持する（`convertLineBreaks`関数で後処理）
5. THE `replacePlaceholders` SHALL 未知のプレースホルダーをそのまま残す（エラーを発生させない）

### Requirement 4: 既存SMSテンプレート生成関数への統合

**User Story:** As a 開発者, I want 既存の全てのSMSテンプレート生成関数がプレースホルダー置換機能を使用する, so that 全てのテンプレートメッセージで条件分岐が動作する

#### Acceptance Criteria

1. THE System SHALL `generateInitialCancellationGuidance`関数でプレースホルダー置換を実行する
2. THE System SHALL `generateCancellationGuidance`関数でプレースホルダー置換を実行する
3. THE System SHALL `generateValuationSMS`関数でプレースホルダー置換を実行する
4. THE System SHALL `generateVisitReminderSMS`関数でプレースホルダー置換を実行する
5. THE System SHALL `generatePostVisitThankYouSMS`関数でプレースホルダー置換を実行する
6. THE System SHALL `generateLongTermCustomerSMS`関数でプレースホルダー置換を実行する
7. THE System SHALL `generateCallReminderSMS`関数でプレースホルダー置換を実行する
8. WHEN プレースホルダー置換後, THE System SHALL 既存の改行変換処理（`convertLineBreaks`）を実行する

### Requirement 5: 後方互換性の保持

**User Story:** As a 開発者, I want 既存のテンプレートメッセージが引き続き動作する, so that 既存機能を壊さずに新機能を追加できる

#### Acceptance Criteria

1. WHEN テンプレートメッセージにプレースホルダーが含まれない, THE System SHALL 既存の動作を維持する
2. THE System SHALL 既存の`[改行]`プレースホルダーの動作を変更しない
3. THE System SHALL 既存のサイト別分岐ロジック（`site === 'ウ'`など）を変更しない
4. THE System SHALL 既存の査定額フォーマット処理を変更しない
5. THE System SHALL 既存の担当者名解決処理（`getEmployeeName`）を変更しない

### Requirement 6: テストケースの実装

**User Story:** As a 開発者, I want プレースホルダー置換機能のテストケース, so that 条件分岐が正しく動作することを保証できる

#### Acceptance Criteria

1. THE System SHALL 売主番号に「FI」が含まれる場合のテストケースを提供する
2. THE System SHALL 売主番号に「FI」が含まれない場合のテストケースを提供する
3. THE System SHALL 売主番号がnullの場合のテストケースを提供する
4. THE System SHALL 売主番号が空文字列の場合のテストケースを提供する
5. THE System SHALL 複数のプレースホルダーが含まれる場合のテストケースを提供する
6. THE System SHALL 未知のプレースホルダーが含まれる場合のテストケースを提供する

### Requirement 7: エラーハンドリング

**User Story:** As a 開発者, I want プレースホルダー置換処理がエラーを発生させない, so that テンプレートメッセージ生成が常に成功する

#### Acceptance Criteria

1. WHEN 売主オブジェクトがnull, THE System SHALL デフォルト値を使用してプレースホルダーを置き換える
2. WHEN 売主番号がundefined, THE System SHALL デフォルト値を使用してプレースホルダーを置き換える
3. THE System SHALL プレースホルダー置換処理で例外を発生させない
4. WHEN プレースホルダー置換に失敗, THE System SHALL 元のメッセージを返す
5. THE System SHALL エラーログを出力する（コンソールログ）

### Requirement 8: ドキュメント更新

**User Story:** As a 開発者, I want プレースホルダー機能のドキュメント, so that 将来の開発者が機能を理解できる

#### Acceptance Criteria

1. THE System SHALL `replacePlaceholders`関数のJSDocコメントを提供する
2. THE JSDoc SHALL サポートされているプレースホルダーの一覧を記載する
3. THE JSDoc SHALL 条件分岐のロジックを説明する
4. THE JSDoc SHALL 使用例を提供する
5. THE System SHALL README.mdまたはCOMMENTS.mdに機能説明を追加する
