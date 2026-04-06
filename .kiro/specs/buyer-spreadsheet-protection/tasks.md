# Implementation Plan: Buyer Spreadsheet Protection

## Overview

買主リストのスプレッドシートから手動で行が削除されると、10分ごとに実行される削除同期処理によってデータベースから物理削除されてしまう問題を解決します。この実装では、スプレッドシートの範囲保護、削除同期の安全性強化、論理削除への移行、削除承認フロー、復元機能を段階的に実装します。

## Tasks

- [ ] 1. データベーススキーマの準備
  - [ ] 1.1 buyer_deletion_pending テーブルを作成
    - SQLマイグレーションファイルを作成（`buyer_deletion_pending`テーブル）
    - インデックスを設定（`status`, `buyer_number`）
    - _Requirements: 5.1_
  
  - [ ] 1.2 deletion_sync_config テーブルを作成
    - SQLマイグレーションファイルを作成（`deletion_sync_config`テーブル）
    - デフォルト設定を挿入（auto_sync_enabled=true, sync_interval_minutes=30, approval_required=true, max_auto_delete_count=10）
    - _Requirements: 8.1, 10.1_
  
  - [ ] 1.3 buyers テーブルの deleted_at インデックスを確認
    - `deleted_at`フィールドのインデックスが存在することを確認
    - 存在しない場合はインデックスを作成
    - _Requirements: 3.2_

- [ ] 2. BuyerDeletionService の実装
  - [ ] 2.1 BuyerDeletionService クラスを作成
    - `backend/src/services/BuyerDeletionService.ts`を作成
    - コンストラクタでSupabaseClientとGoogleSheetsClientを受け取る
    - _Requirements: 3.1, 6.2_
  
  - [ ] 2.2 softDelete メソッドを実装
    - 買主を論理削除（`deleted_at`フィールドに現在時刻を設定）
    - 監査ログ（`buyer_deletion_audit`）にバックアップを保存
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3_
  
  - [ ]* 2.3 softDelete メソッドのプロパティテストを作成
    - **Property 3: 論理削除の実行**
    - **Property 6: 監査ログの記録**
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 4.3**
  
  - [ ] 2.4 recover メソッドを実装
    - `deleted_at`フィールドをNULLに設定
    - 監査ログを更新（`recovered_at`, `recovered_by`）
    - スプレッドシートに買主を復元
    - _Requirements: 6.2, 6.3, 6.4_
  
  - [ ]* 2.5 recover メソッドのプロパティテストを作成
    - **Property 10: 復元時のdeleted_atのNULL設定**
    - **Property 11: 復元時のスプレッドシート追加**
    - **Property 12: 復元時の監査ログ更新**
    - **Validates: Requirements 6.2, 6.3, 6.4**
  
  - [ ] 2.6 getDeletionHistory メソッドを実装
    - `buyer_deletion_audit`テーブルから削除履歴を取得
    - 削除日時の降順でソート
    - _Requirements: 4.1_

- [ ] 3. EnhancedAutoSyncService の拡張
  - [ ] 3.1 削除件数による安全ガードを実装
    - `syncDeletedBuyers`メソッドに削除件数チェックを追加
    - 10件超の場合は承認待ちステータスに設定
    - _Requirements: 2.1_
  
  - [ ]* 3.2 削除件数による安全ガードのプロパティテストを作成
    - **Property 1: 削除件数による安全ガード**
    - **Validates: Requirements 2.1**
  
  - [ ] 3.3 件数比率による安全ガードを確認
    - 既存の安全ガード（スプレッドシート件数がDBの50%未満でスキップ）が正しく動作することを確認
    - _Requirements: 2.2_
  
  - [ ]* 3.4 件数比率による安全ガードのプロパティテストを作成
    - **Property 2: 件数比率による安全ガード**
    - **Validates: Requirements 2.2**
  
  - [ ] 3.5 createPendingDeletion メソッドを実装
    - 削除対象を`buyer_deletion_pending`テーブルに挿入
    - status='pending'で作成
    - _Requirements: 5.1_
  
  - [ ]* 3.6 createPendingDeletion メソッドのプロパティテストを作成
    - **Property 7: 承認待ちレコードの作成**
    - **Validates: Requirements 5.1**
  
  - [ ] 3.7 getPendingDeletions メソッドを実装
    - status='pending'の承認待ちレコードを取得
    - 検出日時の降順でソート
    - _Requirements: 5.2_
  
  - [ ] 3.8 approveDeletion メソッドを実装
    - 承認待ちレコードを取得
    - BuyerDeletionService.softDeleteを呼び出して論理削除を実行
    - 承認待ちレコードのstatusを'approved'に更新
    - _Requirements: 5.3_
  
  - [ ]* 3.9 approveDeletion メソッドのプロパティテストを作成
    - **Property 8: 承認時の論理削除実行**
    - **Validates: Requirements 5.3**
  
  - [ ] 3.10 rejectDeletion メソッドを実装
    - 承認待ちレコードを取得
    - restoreBuyerToSpreadsheetを呼び出してスプレッドシートに復元
    - 承認待ちレコードのstatusを'rejected'に更新
    - _Requirements: 5.4_
  
  - [ ]* 3.11 rejectDeletion メソッドのプロパティテストを作成
    - **Property 9: 拒否時のスプレッドシート復元**
    - **Validates: Requirements 5.4**
  
  - [ ] 3.12 restoreBuyerToSpreadsheet メソッドを実装
    - DBから買主データを取得
    - GoogleSheetsClient.appendRowでスプレッドシートに追加
    - _Requirements: 5.4_
  
  - [ ] 3.13 executeBuyerSoftDelete メソッドを実装
    - BuyerDeletionService.softDeleteを呼び出す
    - 削除対象の買主番号をログに記録
    - _Requirements: 2.4, 3.1_
  
  - [ ] 3.14 アクティブな買主のクエリを更新
    - 全ての買主取得クエリに`deleted_at IS NULL`の条件を追加
    - _Requirements: 3.3_
  
  - [ ]* 3.15 アクティブな買主のクエリのプロパティテストを作成
    - **Property 4: アクティブな買主のクエリ**
    - **Validates: Requirements 3.3**
  
  - [ ] 3.16 スプレッドシート同期から論理削除された買主を除外
    - スプレッドシート同期処理に`deleted_at IS NULL`の条件を追加
    - _Requirements: 3.4_
  
  - [ ]* 3.17 スプレッドシート同期除外のプロパティテストを作成
    - **Property 5: 論理削除された買主の同期除外**
    - **Validates: Requirements 3.4**

- [ ] 4. Checkpoint - バックエンドサービスのテスト
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. NotificationService の拡張
  - [ ] 5.1 sendDeletionDetectedNotification メソッドを実装
    - 削除対象の買主番号リストを含むメール通知を送信
    - 削除件数が10件超の場合は件名に「緊急」を含める
    - 承認画面への直接リンクを含める
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 5.2 sendDeletionDetectedNotification メソッドのプロパティテストを作成
    - **Property 13: メール件名の条件分岐**
    - **Validates: Requirements 7.3**
  
  - [ ] 5.3 sendRowDeletionNotification メソッドを実装
    - スプレッドシートで行が削除されたことを即座に通知
    - 削除者、削除日時、削除行数を含める
    - _Requirements: 9.3_

- [ ] 6. Google Apps Script の実装
  - [ ] 6.1 initializeBuyerSheetProtection 関数を作成
    - 買主スプレッドシートの全データ範囲（A2:最終行）に保護を設定
    - 管理者アカウントのみ編集を許可
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ] 6.2 onEdit トリガーを作成
    - 行削除を検出（changeType === 'REMOVE_ROW'）
    - バックエンドに削除検出を通知（POST /api/buyers/deletion-detected）
    - _Requirements: 9.1, 9.2_
  
  - [ ] 6.3 GAS環境変数を設定
    - BACKEND_URLをスクリプトプロパティに設定
    - 管理者メールアドレスをスクリプトプロパティに設定
    - _Requirements: 1.3, 9.3_

- [ ] 7. バックエンドAPIエンドポイントの実装
  - [ ] 7.1 POST /api/buyers/deletion-detected エンドポイントを作成
    - GASからの削除検出通知を受け取る
    - NotificationService.sendRowDeletionNotificationを呼び出す
    - _Requirements: 9.2, 9.3_
  
  - [ ] 7.2 GET /api/buyers/deletion/pending エンドポイントを作成
    - EnhancedAutoSyncService.getPendingDeletionsを呼び出す
    - 承認待ちの削除リストを返す
    - _Requirements: 5.2_
  
  - [ ] 7.3 POST /api/buyers/deletion/approve エンドポイントを作成
    - EnhancedAutoSyncService.approveDeletionを呼び出す
    - 削除を承認して実行
    - _Requirements: 5.3_
  
  - [ ] 7.4 POST /api/buyers/deletion/reject エンドポイントを作成
    - EnhancedAutoSyncService.rejectDeletionを呼び出す
    - 削除を拒否してスプレッドシートに復元
    - _Requirements: 5.4_
  
  - [ ] 7.5 GET /api/buyers/deleted エンドポイントを作成
    - 論理削除された買主のリストを取得（deleted_at IS NOT NULL）
    - _Requirements: 6.1_
  
  - [ ] 7.6 POST /api/buyers/:buyerNumber/recover エンドポイントを作成
    - BuyerDeletionService.recoverを呼び出す
    - 買主を復元
    - _Requirements: 6.2, 6.3, 6.4_
  
  - [ ] 7.7 GET /api/buyers/deletion/history エンドポイントを作成
    - BuyerDeletionService.getDeletionHistoryを呼び出す
    - 削除履歴を返す
    - _Requirements: 4.1_
  
  - [ ] 7.8 GET /api/settings/deletion-sync エンドポイントを作成
    - deletion_sync_configテーブルから設定を取得
    - _Requirements: 8.1, 10.1_
  
  - [ ] 7.9 PUT /api/settings/deletion-sync エンドポイントを作成
    - deletion_sync_configテーブルの設定を更新
    - _Requirements: 8.1, 10.1_
  
  - [ ]* 7.10 APIエンドポイントの統合テストを作成
    - 全エンドポイントの正常系とエラー系をテスト
    - _Requirements: 全要件_

- [ ] 8. Checkpoint - バックエンドAPIのテスト
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Admin UI - 削除承認画面の実装
  - [ ] 9.1 BuyerDeletionApprovalPage コンポーネントを作成
    - `/admin/buyers/deletion-approval`パスに配置
    - GET /api/buyers/deletion/pendingで承認待ちリストを取得
    - _Requirements: 5.2_
  
  - [ ] 9.2 承認・拒否ボタンを実装
    - 承認ボタン: POST /api/buyers/deletion/approveを呼び出す
    - 拒否ボタン: POST /api/buyers/deletion/rejectを呼び出す
    - _Requirements: 5.3, 5.4_
  
  - [ ] 9.3 承認待ちリストのテーブルを実装
    - 買主番号、検出日時、理由を表示
    - _Requirements: 5.2_

- [ ] 10. Admin UI - 復元画面の実装
  - [ ] 10.1 BuyerRecoveryPage コンポーネントを作成
    - `/admin/buyers/recovery`パスに配置
    - GET /api/buyers/deletedで論理削除された買主のリストを取得
    - _Requirements: 6.1_
  
  - [ ] 10.2 復元ボタンを実装
    - POST /api/buyers/:buyerNumber/recoverを呼び出す
    - _Requirements: 6.2_
  
  - [ ] 10.3 論理削除された買主のテーブルを実装
    - 買主番号、削除日時、削除理由を表示
    - _Requirements: 6.1_

- [ ] 11. Admin UI - 削除履歴画面の実装
  - [ ] 11.1 BuyerDeletionHistoryPage コンポーネントを作成
    - `/admin/buyers/deletion-history`パスに配置
    - GET /api/buyers/deletion/historyで削除履歴を取得
    - _Requirements: 4.1_
  
  - [ ] 11.2 削除履歴のテーブルを実装
    - 買主番号、削除日時、削除者、削除理由、復元日時、復元者を表示
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 12. Admin UI - 設定画面の実装
  - [ ] 12.1 DeletionSyncSettingsPage コンポーネントを作成
    - `/admin/settings/deletion-sync`パスに配置
    - GET /api/settings/deletion-syncで現在の設定を取得
    - _Requirements: 8.1, 10.1_
  
  - [ ] 12.2 自動実行の有効/無効トグルを実装
    - PUT /api/settings/deletion-syncで設定を更新
    - _Requirements: 8.1, 8.2_
  
  - [ ]* 12.3 自動実行の無効化のプロパティテストを作成
    - **Property 14: 自動実行の無効化**
    - **Validates: Requirements 8.2, 10.4**
  
  - [ ] 12.4 実行間隔の選択ドロップダウンを実装
    - 10分、30分、1時間、手動のみを選択可能
    - PUT /api/settings/deletion-syncで設定を更新
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ] 12.5 手動実行ボタンを実装
    - POST /api/buyers/deletion/manual-syncを呼び出す
    - _Requirements: 8.3_

- [ ] 13. EnhancedAutoSyncService の設定連携
  - [ ] 13.1 設定読み込みメソッドを実装
    - deletion_sync_configテーブルから設定を読み込む
    - _Requirements: 8.1, 10.1_
  
  - [ ] 13.2 自動実行の有効/無効チェックを追加
    - auto_sync_enabled=falseの場合は削除同期処理をスキップ
    - _Requirements: 8.2, 10.4_
  
  - [ ] 13.3 手動実行メソッドを実装
    - POST /api/buyers/deletion/manual-syncエンドポイントで呼び出される
    - 設定に関わらず削除同期処理を実行
    - _Requirements: 8.4_

- [ ] 14. GAS Trigger の実行間隔調整
  - [ ] 14.1 GAS Trigger の更新スクリプトを作成
    - deletion_sync_configの設定に基づいてトリガーの間隔を更新
    - _Requirements: 10.2_
  
  - [ ] 14.2 デフォルト実行間隔を30分に変更
    - deletion_sync_configのデフォルト値を30分に設定
    - _Requirements: 10.3_

- [ ] 15. Final Checkpoint - 統合テストと動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. ドキュメントとデプロイ
  - [ ] 16.1 README.mdを更新
    - 新機能の説明を追加
    - 設定方法を記載
  
  - [ ] 16.2 GAS初期化手順を作成
    - initializeBuyerSheetProtection関数の実行手順
    - 環境変数の設定手順
  
  - [ ] 16.3 デプロイ手順を確認
    - バックエンドのデプロイ
    - フロントエンドのデプロイ
    - GASスクリプトのデプロイ

## Notes

- タスクに`*`が付いているものはオプション（プロパティテストとユニットテスト）で、スキップ可能です
- 各タスクは要件番号を参照しており、トレーサビリティを確保しています
- Checkpointタスクで段階的に動作確認を行い、問題を早期に発見します
- プロパティテストは設計ドキュメントのプロパティを明示的に参照しています
- Google Apps Scriptの範囲保護設定とUI操作は手動テストで確認します
