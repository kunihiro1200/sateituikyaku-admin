# Requirements Document

## Introduction

通話モードページのSMS送信機能を改善し、ユーザー体験を向上させます。現在、SMSテンプレート選択後に確認ダイアログが表示され、ユーザーが「送信」ボタンをクリックする必要がありますが、この確認ステップをスキップして、テンプレート選択後すぐにスマートフォン連携（SMSアプリ）を開くように変更します。

## Glossary

- **SMS_Sender**: SMS送信機能を提供するシステムコンポーネント
- **Template_Selector**: SMSテンプレート選択UI
- **Smartphone_Link**: スマートフォンのSMSアプリを開く機能
- **Confirmation_Dialog**: 現在表示されている確認ダイアログ
- **Activity_Logger**: 活動履歴を記録するコンポーネント

## Requirements

### Requirement 1: テンプレート選択後の即時スマートフォン連携

**User Story:** As a 営業担当者, I want SMSテンプレートを選択したらすぐにスマートフォンのSMSアプリが開く, so that 素早くSMSを送信できる

#### Acceptance Criteria

1. WHEN ユーザーがSMSテンプレートを選択, THE SMS_Sender SHALL 確認ダイアログを表示せずにスマートフォン連携を開始する
2. WHEN スマートフォン連携が開始される, THE SMS_Sender SHALL テンプレートの雛形文章をSMSアプリに渡す
3. WHEN スマートフォン連携が開始される, THE SMS_Sender SHALL 売主の電話番号をSMSアプリに渡す
4. WHEN スマートフォン連携が完了, THE Activity_Logger SHALL 活動履歴に「【テンプレート名】を送信」と記録する

### Requirement 2: 確認ダイアログの削除

**User Story:** As a 営業担当者, I want 確認ダイアログが表示されない, so that 操作ステップを減らして効率的に作業できる

#### Acceptance Criteria

1. WHEN ユーザーがSMSテンプレートを選択, THE SMS_Sender SHALL 確認ダイアログを表示しない
2. THE SMS_Sender SHALL 雛形の文章を画面に表示しない
3. WHEN テンプレート選択が完了, THE SMS_Sender SHALL 即座にスマートフォン連携を実行する

### Requirement 3: エラーハンドリング

**User Story:** As a 営業担当者, I want エラーが発生した場合に適切なメッセージが表示される, so that 問題を理解して対処できる

#### Acceptance Criteria

1. IF 売主の電話番号が空, THEN THE SMS_Sender SHALL エラーメッセージ「電話番号が設定されていません」を表示する
2. IF テンプレートの生成に失敗, THEN THE SMS_Sender SHALL エラーメッセージ「メッセージの生成に失敗しました」を表示する
3. IF メッセージが670文字を超える, THEN THE SMS_Sender SHALL エラーメッセージ「メッセージが長すぎます（X文字 / 670文字制限）」を表示する
4. IF 活動履歴の記録に失敗, THEN THE SMS_Sender SHALL エラーをログに記録するが、スマートフォン連携は継続する

### Requirement 4: 担当フィールドの自動セット

**User Story:** As a システム, I want SMS送信後に対応する担当フィールドにログインユーザーのイニシャルを自動セットする, so that 誰がSMSを送信したか記録できる

#### Acceptance Criteria

1. WHEN SMS送信が記録される, THE SMS_Sender SHALL SMS_TEMPLATE_ASSIGNEE_MAPからテンプレートIDに対応する担当フィールドを取得する
2. WHEN 担当フィールドが特定される, THE SMS_Sender SHALL ログインユーザーのイニシャルを取得する
3. WHEN イニシャルが取得される, THE SMS_Sender SHALL 売主テーブルの対応する担当フィールドを更新する
4. IF イニシャルの取得に失敗, THEN THE SMS_Sender SHALL エラーをログに記録するが、スマートフォン連携は継続する

### Requirement 5: 既存機能の維持

**User Story:** As a システム管理者, I want 既存のSMS送信機能が正常に動作し続ける, so that 他の機能に影響を与えない

#### Acceptance Criteria

1. THE SMS_Sender SHALL テンプレート生成ロジック（generator関数）を変更しない
2. THE SMS_Sender SHALL メッセージ長の検証（670文字制限）を維持する
3. THE SMS_Sender SHALL 改行プレースホルダーの変換処理を維持する
4. THE SMS_Sender SHALL 活動履歴の記録形式を維持する
5. THE SMS_Sender SHALL 担当フィールドの自動セットロジックを維持する
