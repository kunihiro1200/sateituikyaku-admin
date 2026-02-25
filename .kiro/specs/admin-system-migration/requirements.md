# 要件定義書：社内管理システムの段階的移行

## Introduction

本ドキュメントは、社内管理システムを`property-search-app`から`sateituikyaku`プロジェクトに段階的に移行するための要件を定義します。

### 移行の目的

1. **システムの統合**: 公開物件サイトと社内管理システムを1つのプロジェクトに統合
2. **保守性の向上**: コードベースを統一し、保守性を向上
3. **認証エラーの解消**: 現在発生している認証エラーを根本的に解決
4. **段階的移行**: リスクを最小化するため、8フェーズに分けて段階的に移行

### 現在の問題点

1. **認証エラー**: `property-search-app`で認証エラーが頻発
2. **プロジェクトの分散**: 公開物件サイトと社内管理システムが別プロジェクト
3. **保守の困難**: 2つのプロジェクトを別々に保守する必要がある
4. **コードの重複**: 同じ機能が2つのプロジェクトに重複して実装されている

### 期待される成果

1. **認証エラーの解消**: 認証システムを統合し、エラーを根本的に解決
2. **保守性の向上**: 1つのプロジェクトで全ての機能を管理
3. **開発効率の向上**: コードの重複を削減し、開発効率を向上
4. **システムの安定性向上**: 段階的移行により、リスクを最小化

---

## Glossary

- **System**: 社内管理システム全体
- **Auth_System**: 認証システム
- **Seller_Management**: 売主管理システム
- **Property_Management**: 物件管理システム
- **Buyer_Management**: 買主管理システム
- **Task_Management**: 業務リスト管理システム
- **Employee_Management**: 従業員管理システム
- **Calendar_Management**: カレンダー管理システム
- **Email_System**: メール送信システム
- **Notification_System**: 通知システム
- **Database**: Supabaseデータベース
- **Spreadsheet**: Google Sheetsスプレッドシート
- **Public_Site**: 公開物件サイト
- **Admin_Site**: 社内管理システム

---

## Requirements

### Requirement 1: 認証システム移行（Phase 1）

**User Story:** As a システム管理者, I want to 認証システムを新しいバックエンドに移行する, so that 認証エラーを解消し、システムの安定性を向上できる

#### Acceptance Criteria

1. WHEN ユーザーがログインする THEN THE Auth_System SHALL 認証トークンを正しく発行し、セッションを確立する
2. WHEN 認証エラーが発生する THEN THE Auth_System SHALL 適切なエラーメッセージを表示する
3. WHEN 公開物件サイトにアクセスする THEN THE Public_Site SHALL 認証システムの移行による影響を受けない
4. WHEN 既存の認証フローを使用する THEN THE Auth_System SHALL 既存の認証フローを維持しながら新しいバックエンドに接続する

---

### Requirement 2: 売主管理移行（Phase 2）

**User Story:** As a 営業担当者, I want to 売主データを管理する, so that 売主情報を正確に把握し、効率的に営業活動を行える

#### Acceptance Criteria

1. WHEN 売主データを取得する THEN THE Seller_Management SHALL 新しいバックエンドから正しいデータを返す
2. WHEN 売主データを更新する THEN THE Seller_Management SHALL データベースとスプレッドシートの両方を更新する
3. WHEN 売主リストをフィルタリングする THEN THE Seller_Management SHALL 正しいフィルタ条件でデータを返す
4. WHEN 通話モードページを表示する THEN THE Seller_Management SHALL 全ての必要なデータを正しく表示する
5. WHEN 売主詳細ページを表示する THEN THE Seller_Management SHALL 全ての必要なデータを正しく表示する

---

### Requirement 3: 物件管理移行（Phase 3）

**User Story:** As a 営業担当者, I want to 物件データを管理する, so that 物件情報を正確に把握し、効率的に営業活動を行える

#### Acceptance Criteria

1. WHEN 物件データを取得する THEN THE Property_Management SHALL 新しいバックエンドから正しいデータを返す
2. WHEN 物件データを更新する THEN THE Property_Management SHALL データベースとスプレッドシートの両方を更新する
3. WHEN 物件リストをフィルタリングする THEN THE Property_Management SHALL 正しいフィルタ条件でデータを返す
4. WHEN 物件画像を取得する THEN THE Property_Management SHALL Google Driveから正しい画像を返す

---

### Requirement 4: 買主管理移行（Phase 4）

**User Story:** As a 営業担当者, I want to 買主データを管理する, so that 買主情報を正確に把握し、効率的に営業活動を行える

#### Acceptance Criteria

1. WHEN 買主データを取得する THEN THE Buyer_Management SHALL 新しいバックエンドから正しいデータを返す
2. WHEN 買主データを更新する THEN THE Buyer_Management SHALL データベースとスプレッドシートの両方を更新する
3. WHEN 買主リストをフィルタリングする THEN THE Buyer_Management SHALL 正しいフィルタ条件でデータを返す

---

### Requirement 5: 業務リスト管理移行（Phase 5）

**User Story:** As a 営業担当者, I want to 業務データを管理する, so that 業務の進捗を正確に把握し、効率的に業務を遂行できる

#### Acceptance Criteria

1. WHEN 業務データを取得する THEN THE Task_Management SHALL 新しいバックエンドから正しいデータを返す
2. WHEN 業務データを更新する THEN THE Task_Management SHALL データベースとスプレッドシートの両方を更新する
3. WHEN 業務リストをフィルタリングする THEN THE Task_Management SHALL 正しいフィルタ条件でデータを返す

---

### Requirement 6: 従業員・カレンダー管理移行（Phase 6）

**User Story:** As a システム管理者, I want to 従業員とカレンダーを管理する, so that 従業員の情報とスケジュールを正確に把握できる

#### Acceptance Criteria

1. WHEN 従業員データを取得する THEN THE Employee_Management SHALL 新しいバックエンドから正しいデータを返す
2. WHEN カレンダーイベントを取得する THEN THE Calendar_Management SHALL 新しいバックエンドから正しいデータを返す
3. WHEN カレンダーイベントを作成する THEN THE Calendar_Management SHALL データベースに正しく保存する

---

### Requirement 7: メール・通知機能移行（Phase 7）

**User Story:** As a システム管理者, I want to メールと通知を送信する, so that ユーザーに重要な情報を伝えられる

#### Acceptance Criteria

1. WHEN メールを送信する THEN THE Email_System SHALL 正しい宛先に正しい内容を送信する
2. WHEN 通知を送信する THEN THE Notification_System SHALL 正しいユーザーに正しい内容を送信する

---

### Requirement 8: その他の機能移行（Phase 8）

**User Story:** As a システム管理者, I want to 統計とレポートを生成する, so that システムの利用状況を把握できる

#### Acceptance Criteria

1. WHEN 統計データを取得する THEN THE System SHALL 新しいバックエンドから正しいデータを返す
2. WHEN レポートを生成する THEN THE System SHALL 正しい形式でレポートを生成する

---

### Requirement 9: パフォーマンス要件

**User Story:** As a ユーザー, I want to システムが高速に動作する, so that ストレスなく業務を遂行できる

#### Acceptance Criteria

1. WHEN APIリクエストを送信する THEN THE System SHALL 500ms以内にレスポンスを返す
2. WHEN 同時に100ユーザーがアクセスする THEN THE System SHALL 正常に動作する
3. WHEN データベース接続が失敗する THEN THE System SHALL 適切なエラーハンドリングを行う

---

### Requirement 10: セキュリティ要件

**User Story:** As a システム管理者, I want to システムを安全に保つ, so that 不正アクセスを防止できる

#### Acceptance Criteria

1. WHEN 認証トークンが無効な場合 THEN THE Auth_System SHALL 401エラーを返す
2. WHEN 権限のないユーザーがアクセスする THEN THE System SHALL 403エラーを返す
3. WHEN SQLインジェクション攻撃を受ける THEN THE System SHALL 攻撃を防御する

---

### Requirement 11: データ移行要件

**User Story:** As a システム管理者, I want to データを正確に移行する, so that データの整合性を保つことができる

#### Acceptance Criteria

1. WHEN データ移行を実行する THEN THE System SHALL 全てのデータを正しく移行する
2. WHEN データ移行中にエラーが発生する THEN THE System SHALL ロールバックを正しく実行する
3. WHEN データ移行後にデータを検証する THEN THE System SHALL 移行前後のデータが一致することを確認する

---

### Requirement 12: 後方互換性要件

**User Story:** As a 開発者, I want to 既存のコードが動作し続ける, so that 移行後も既存の機能が正常に動作する

#### Acceptance Criteria

1. WHEN 既存のAPIエンドポイントにアクセスする THEN THE System SHALL 移行後も同じレスポンスを返す
2. WHEN 既存のフロントエンドコードを使用する THEN THE System SHALL 移行後も正常に動作する
3. WHEN 既存のデータ形式を使用する THEN THE System SHALL 移行後も正しく処理する

---

### Requirement 13: 公開物件サイトへの影響ゼロ

**User Story:** As a システム管理者, I want to 公開物件サイトに影響を与えない, so that 一般ユーザーが引き続き公開物件サイトを利用できる

#### Acceptance Criteria

1. WHEN 社内管理システムを移行する THEN THE Public_Site SHALL 移行による影響を受けない
2. WHEN 公開物件サイトにアクセスする THEN THE Public_Site SHALL 移行前と同じ速度で動作する
3. WHEN 公開物件サイトのAPIを呼び出す THEN THE Public_Site SHALL 移行前と同じレスポンスを返す

---

### Requirement 14: 段階的移行の実施

**User Story:** As a システム管理者, I want to 段階的に移行する, so that リスクを最小化できる

#### Acceptance Criteria

1. WHEN 各フェーズを完了する THEN THE System SHALL 次のフェーズに進む前に動作確認を行う
2. WHEN フェーズ中にエラーが発生する THEN THE System SHALL 前のフェーズにロールバックする
3. WHEN 全てのフェーズを完了する THEN THE System SHALL 最終的な動作確認を行う

---

## 制約条件

### 技術的制約

1. **公開物件サイトへの影響ゼロ**: 移行中も公開物件サイトは正常に動作し続ける必要がある
2. **段階的移行**: 一度に全ての機能を移行するのではなく、8フェーズに分けて段階的に移行する
3. **認証エラーの回避**: 認証システムを最優先で移行し、認証エラーを早期に解消する
4. **データの整合性**: データベースとスプレッドシートの両方を同期し、データの整合性を保つ

### 運用上の制約

1. **移行期間**: 14日間で全ての移行を完了する
2. **ダウンタイム**: 各フェーズの移行中、該当機能は一時的に利用できなくなる可能性がある
3. **テスト期間**: 各フェーズ完了後、1日のテスト期間を設ける
4. **ロールバック**: 問題が発生した場合、前のフェーズにロールバックできる体制を整える

---

## 受け入れ基準

### 各フェーズの完了条件

1. **Phase 1（認証システム）**: 認証フローが正常に動作し、認証エラーが発生しない
2. **Phase 2（売主管理）**: 売主データの取得・更新が正常に動作し、通話モードページと売主詳細ページが正しく表示される
3. **Phase 3（物件管理）**: 物件データの取得・更新が正常に動作し、物件画像が正しく表示される
4. **Phase 4（買主管理）**: 買主データの取得・更新が正常に動作する
5. **Phase 5（業務リスト管理）**: 業務データの取得・更新が正常に動作する
6. **Phase 6（従業員・カレンダー管理）**: 従業員データとカレンダーイベントの取得・作成が正常に動作する
7. **Phase 7（メール・通知機能）**: メールと通知が正しく送信される
8. **Phase 8（その他の機能）**: 統計データとレポートが正しく生成される

### 最終的な受け入れ基準

1. **全ての機能が正常に動作する**: 移行後、全ての機能が正常に動作することを確認
2. **公開物件サイトへの影響がない**: 公開物件サイトが移行前と同じように動作することを確認
3. **パフォーマンスが維持される**: APIレスポンスタイムが500ms以内であることを確認
4. **データの整合性が保たれる**: データベースとスプレッドシートのデータが一致することを確認
5. **セキュリティが確保される**: 認証・認可が正しく機能することを確認

---

## 非機能要件

### パフォーマンス要件

1. **APIレスポンスタイム**: 500ms以内
2. **同時接続数**: 100ユーザーまで対応
3. **データベースクエリ**: 100ms以内

### セキュリティ要件

1. **認証**: JWT認証を使用
2. **認可**: ロールベースアクセス制御（RBAC）を実装
3. **データ暗号化**: 機密データは暗号化して保存
4. **SQLインジェクション対策**: パラメータ化クエリを使用

### 可用性要件

1. **稼働率**: 99.9%以上
2. **ダウンタイム**: 月間1時間以内
3. **バックアップ**: 日次バックアップを実施

### 保守性要件

1. **コードの可読性**: TypeScriptの型定義を活用
2. **テストカバレッジ**: 80%以上
3. **ドキュメント**: 全ての機能にドキュメントを作成
4. **ログ**: 全てのエラーをログに記録

---

## データ移行計画

### 移行対象データ

1. **売主データ**: `sellers`テーブル
2. **物件データ**: `property_listings`, `property_details`テーブル
3. **買主データ**: `buyers`テーブル
4. **業務データ**: `tasks`テーブル
5. **従業員データ**: `employees`テーブル
6. **カレンダーデータ**: `calendar_events`テーブル

### 移行手順

1. **データのバックアップ**: 移行前に全てのデータをバックアップ
2. **データの検証**: 移行前後のデータを比較し、整合性を確認
3. **データの移行**: 各フェーズで該当するデータを移行
4. **データの検証**: 移行後、データが正しく移行されたことを確認

### ロールバック計画

1. **バックアップからの復元**: 問題が発生した場合、バックアップからデータを復元
2. **前のフェーズへの復帰**: 問題が発生した場合、前のフェーズに復帰
3. **エラーログの確認**: エラーログを確認し、問題の原因を特定

---

## リスク管理

### 主要リスク

1. **認証エラーの継続**: 移行後も認証エラーが発生する可能性
2. **データの不整合**: データ移行中にデータの不整合が発生する可能性
3. **パフォーマンスの低下**: 移行後、パフォーマンスが低下する可能性
4. **公開物件サイトへの影響**: 移行中に公開物件サイトに影響が出る可能性

### リスク対策

1. **認証エラー**: 認証システムを最優先で移行し、早期にテストを実施
2. **データの不整合**: データ移行前後でデータを検証し、整合性を確認
3. **パフォーマンス**: 移行後、パフォーマンステストを実施し、問題があれば最適化
4. **公開物件サイト**: 移行中も公開物件サイトを監視し、問題があれば即座に対応

---

## まとめ

本要件定義書は、社内管理システムを`property-search-app`から`sateituikyaku`プロジェクトに段階的に移行するための要件を定義しました。

**主要な要件**:
1. 認証システムの移行（Phase 1）
2. 売主管理の移行（Phase 2）
3. 物件管理の移行（Phase 3）
4. 買主管理の移行（Phase 4）
5. 業務リスト管理の移行（Phase 5）
6. 従業員・カレンダー管理の移行（Phase 6）
7. メール・通知機能の移行（Phase 7）
8. その他の機能の移行（Phase 8）

**制約条件**:
- 公開物件サイトへの影響ゼロ
- 段階的移行（8フェーズ、14日間）
- 認証エラーの早期解消

**受け入れ基準**:
- 全ての機能が正常に動作する
- 公開物件サイトへの影響がない
- パフォーマンスが維持される
- データの整合性が保たれる
- セキュリティが確保される

この要件定義書に基づいて、設計書（design.md）とタスクリスト（tasks.md）を作成し、段階的に移行を進めます。
