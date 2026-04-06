# Requirements Document

## Introduction

買主リストのスプレッドシートから手動で行が削除されると、10分ごとに実行される削除同期処理によってデータベースから物理削除されてしまう問題があります。買主4154のように、DBには存在していたがスプレッドシートから削除されたことで、自動的にDBからも削除されるケースが頻繁に発生しています。

この機能では、スプレッドシートからの誤削除を防ぎ、削除同期の安全性を高め、削除された買主を復元できるようにします。

## Glossary

- **Buyer_Spreadsheet**: Google スプレッドシートで管理されている買主リスト
- **Deletion_Sync_Service**: スプレッドシートとデータベースの差分を検出し、DBから買主を削除する自動同期サービス（`EnhancedAutoSyncService`）
- **GAS_Trigger**: Google Apps Script のトリガー機能（10分ごとに削除同期を実行）
- **Protected_Range**: Google スプレッドシートの範囲保護機能
- **Soft_Delete**: 論理削除（`deleted_at`フィールドにタイムスタンプを設定し、物理的には削除しない）
- **Hard_Delete**: 物理削除（データベースから完全に削除）
- **Deletion_Log**: 削除履歴テーブル（削除された買主の情報を記録）
- **Manual_Approval**: 削除前に管理者が承認する仕組み

## Requirements

### Requirement 1: スプレッドシート範囲保護

**User Story:** As a システム管理者, I want スプレッドシートの買主データ範囲を保護する, so that 誤って行を削除できないようにする

#### Acceptance Criteria

1. THE GAS_Initialization_Script SHALL 買主スプレッドシートの全データ範囲（A2:最終行）に Protected_Range を設定する
2. WHEN Protected_Range が設定されている, THE Buyer_Spreadsheet SHALL 編集者による行削除を禁止する
3. THE Protected_Range SHALL 特定の管理者アカウントのみ編集を許可する
4. WHEN 買主が新規追加される, THE GAS_Script SHALL Protected_Range を自動的に拡張する

### Requirement 2: 削除同期の安全性強化

**User Story:** As a システム管理者, I want 削除同期処理の安全ガードを強化する, so that 大量削除や誤削除を防ぐ

#### Acceptance Criteria

1. WHEN 削除対象の買主数が10件を超える, THE Deletion_Sync_Service SHALL 削除処理を一時停止し、管理者に通知する
2. WHEN スプレッドシートの買主数がDBの50%未満, THE Deletion_Sync_Service SHALL 削除処理をスキップする（既存の安全ガード）
3. WHEN スプレッドシートが0件, THE Deletion_Sync_Service SHALL 削除処理をスキップする（既存の安全ガード）
4. THE Deletion_Sync_Service SHALL 削除対象の買主番号リストをログに記録する

### Requirement 3: 論理削除への移行

**User Story:** As a システム管理者, I want 買主を物理削除ではなく論理削除する, so that 誤削除時に復元できるようにする

#### Acceptance Criteria

1. THE Deletion_Sync_Service SHALL 買主を Hard_Delete ではなく Soft_Delete する
2. WHEN 買主が Soft_Delete される, THE Database SHALL `deleted_at` フィールドに現在時刻を設定する
3. THE Buyer_Query SHALL `deleted_at IS NULL` の条件でアクティブな買主のみを取得する
4. THE Buyer_Spreadsheet_Sync SHALL 論理削除された買主をスプレッドシートに同期しない

### Requirement 4: 削除履歴の記録

**User Story:** As a システム管理者, I want 削除された買主の履歴を記録する, so that いつ誰が削除したか追跡できるようにする

#### Acceptance Criteria

1. THE Deletion_Sync_Service SHALL 削除された買主の情報を Deletion_Log テーブルに記録する
2. THE Deletion_Log SHALL 買主番号、削除日時、削除理由（「スプレッドシートから削除」）を含む
3. THE Deletion_Log SHALL 削除前の買主データのスナップショット（JSON形式）を保存する
4. THE Admin_UI SHALL Deletion_Log を閲覧できる画面を提供する

### Requirement 5: 削除承認フロー

**User Story:** As a システム管理者, I want 削除前に承認する仕組み, so that 誤削除を防ぐ

#### Acceptance Criteria

1. WHEN 削除対象の買主が検出される, THE Deletion_Sync_Service SHALL 削除を保留し、承認待ちステータスに設定する
2. THE Admin_UI SHALL 承認待ちの削除リストを表示する
3. WHEN 管理者が削除を承認する, THE Deletion_Sync_Service SHALL 買主を Soft_Delete する
4. WHEN 管理者が削除を拒否する, THE Deletion_Sync_Service SHALL 買主をスプレッドシートに復元する

### Requirement 6: 買主復元機能

**User Story:** As a システム管理者, I want 論理削除された買主を復元する, so that 誤削除を取り消せるようにする

#### Acceptance Criteria

1. THE Admin_UI SHALL 論理削除された買主のリストを表示する
2. WHEN 管理者が買主の復元を実行する, THE Restoration_Service SHALL `deleted_at` フィールドを NULL に設定する
3. WHEN 買主が復元される, THE Restoration_Service SHALL 買主をスプレッドシートに再追加する
4. THE Restoration_Service SHALL 復元履歴を Deletion_Log に記録する

### Requirement 7: 削除通知機能

**User Story:** As a システム管理者, I want 削除が検出されたときに通知を受け取る, so that 即座に対応できるようにする

#### Acceptance Criteria

1. WHEN 削除対象の買主が検出される, THE Deletion_Sync_Service SHALL 管理者にメール通知を送信する
2. THE Email_Notification SHALL 削除対象の買主番号リスト、検出日時、承認リンクを含む
3. WHEN 削除対象が10件を超える, THE Email_Notification SHALL 件名に「緊急」を含める
4. THE Email_Notification SHALL 削除承認画面への直接リンクを含む

### Requirement 8: 削除同期の手動実行モード

**User Story:** As a システム管理者, I want 削除同期を手動で実行する, so that 自動実行を無効化できるようにする

#### Acceptance Criteria

1. THE Admin_UI SHALL 削除同期の自動実行を有効/無効にする設定を提供する
2. WHEN 自動実行が無効, THE GAS_Trigger SHALL 削除同期処理をスキップする
3. THE Admin_UI SHALL 削除同期を手動で実行するボタンを提供する
4. WHEN 手動実行が実行される, THE Deletion_Sync_Service SHALL 通常の削除同期処理を実行する

### Requirement 9: スプレッドシート削除の検出と警告

**User Story:** As a システム管理者, I want スプレッドシートで行が削除されたことを検出する, so that 即座に警告できるようにする

#### Acceptance Criteria

1. THE GAS_Script SHALL スプレッドシートの `onEdit` イベントで行削除を検出する
2. WHEN 行が削除される, THE GAS_Script SHALL 削除された買主番号をログに記録する
3. WHEN 行が削除される, THE GAS_Script SHALL 管理者に即座にメール通知を送信する
4. THE Email_Notification SHALL 削除された買主番号、削除者、削除日時を含む

### Requirement 10: 削除同期の実行間隔の調整

**User Story:** As a システム管理者, I want 削除同期の実行間隔を調整する, so that 誤削除の影響を最小化できるようにする

#### Acceptance Criteria

1. THE Admin_UI SHALL 削除同期の実行間隔（10分、30分、1時間、手動のみ）を設定できる
2. WHEN 実行間隔が変更される, THE GAS_Trigger SHALL トリガーの間隔を更新する
3. THE System SHALL デフォルトの実行間隔を30分に設定する（現在は10分）
4. WHEN 実行間隔が「手動のみ」, THE GAS_Trigger SHALL 削除同期の自動実行を完全に無効化する
