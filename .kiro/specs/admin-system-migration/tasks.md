# Implementation Plan: 社内管理システムの段階的移行

## Overview

以前のプロジェクト（`c:\Users\kunih\sateituikyaku`）で開発した社内管理システムの全機能を、新しいプロジェクト（`sateituikyaku-admin-backend`/`sateituikyaku-admin-frontend`）に段階的に移行します。

**移行方式**: 8フェーズに分けた段階的移行（14日間）

**重要な制約**:
- 公開物件サイト（`backend/api/`）は移行対象外
- 各フェーズは独立して動作可能であること
- 認証エラーを防ぐため、認証関連の移行は慎重に行うこと

---

## Tasks

### 事前準備（1日目：2/23）

- [x] 1. Vercelプロジェクトの作成
  - 新しいVercelプロジェクト「sateituikyaku-admin-backend」を作成
  - 新しいVercelプロジェクト「sateituikyaku-admin-frontend」を作成
  - _Requirements: 全体_

- [x] 2. 環境変数の設定
  - Vercelダッシュボードで全ての環境変数を設定
  - `GOOGLE_SERVICE_ACCOUNT_KEY`をBase64エンコードして設定
  - 環境変数リストを確認（design.mdの「環境変数マッピング」セクション参照）
  - _Requirements: 全体_

- [x] 3. Gitリポジトリの準備
  - 新しいGitリポジトリを作成
  - `.gitignore`ファイルを作成（環境変数ファイルを除外）
  - 初回コミット
  - _Requirements: 全体_

- [x] 4. 以前のプロジェクトのバックアップ
  - 以前のプロジェクト全体をバックアップ
  - データベースのバックアップを作成
  - スプレッドシートのバックアップを作成
  - _Requirements: 11.1_

---

### Phase 1: 認証システムの移行（2日目：2/24）

- [x] 5. バックエンド認証ファイルのコピー
  - [x] 5.1 `backend/src/routes/auth.supabase.ts`をコピー
    - 移行元から移行先へコピー
    - インポートパスを確認
    - _Requirements: 1.1, 1.4_

  - [x] 5.2 `backend/src/services/AuthService.supabase.ts`をコピー
    - 移行元から移行先へコピー
    - 依存関係を確認
    - _Requirements: 1.1_

  - [x] 5.3 `backend/src/config/supabase.ts`をコピー
    - 移行元から移行先へコピー
    - 環境変数を確認
    - _Requirements: 1.1_

- [ ] 6. フロントエンド認証ファイルのコピー
  - [ ] 6.1 `frontend/src/pages/LoginPage.tsx`をコピー
    - 移行元から移行先へコピー
    - APIエンドポイントを確認
    - _Requirements: 1.1_

  - [ ] 6.2 `frontend/src/store/authStore.ts`をコピー
    - 移行元から移行先へコピー
    - Supabase設定を確認
    - _Requirements: 1.1_

  - [ ] 6.3 `frontend/src/components/ProtectedRoute.tsx`をコピー
    - 移行元から移行先へコピー
    - 認証チェックロジックを確認
    - _Requirements: 1.1_

- [ ] 7. バックエンドindex.tsの更新
  - 認証ルートを追加（`/auth`, `/api/auth`）
  - CORS設定を確認
  - _Requirements: 1.1_

- [ ] 8. フロントエンドApp.tsxの更新
  - ログインページのルートを追加
  - ProtectedRouteを設定
  - 認証チェックを初期化
  - _Requirements: 1.1_

- [ ] 9. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 1.1_

- [ ] 10. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 1.1_

- [ ]* 11. 認証システムのテスト
  - [ ]* 11.1 ログイン機能のテスト
    - ログインページにアクセス
    - 正しい認証情報でログイン
    - セッションが確立されることを確認
    - _Requirements: 1.1_

  - [ ]* 11.2 ログアウト機能のテスト
    - ログアウトボタンをクリック
    - セッションが削除されることを確認
    - ログインページにリダイレクトされることを確認
    - _Requirements: 1.1_

  - [ ]* 11.3 セッション永続化のテスト
    - ログイン後、ブラウザを閉じる
    - ブラウザを再度開く
    - セッションが保持されていることを確認
    - _Requirements: 1.1_

  - [ ]* 11.4 認証保護ルートのテスト
    - ログインせずに保護されたページにアクセス
    - ログインページにリダイレクトされることを確認
    - _Requirements: 1.1_

- [ ] 12. Checkpoint - Phase 1完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 2: 売主管理の移行（3-4日目：2/25-26）

- [ ] 13. バックエンド売主管理ファイルのコピー
  - [ ] 13.1 ルートファイルのコピー
    - `backend/src/routes/sellers.ts`をコピー
    - `backend/src/routes/sellersManagement.ts`をコピー
    - インポートパスを確認
    - _Requirements: 2.1, 2.2_

  - [ ] 13.2 サービスファイルのコピー
    - `backend/src/services/SellerService.supabase.ts`をコピー
    - `backend/src/services/SpreadsheetSyncService.ts`をコピー
    - `backend/src/services/SyncQueue.ts`をコピー
    - `backend/src/services/EnhancedAutoSyncService.ts`をコピー
    - `backend/src/services/GoogleSheetsClient.ts`をコピー
    - 依存関係を確認
    - _Requirements: 2.2_

  - [ ] 13.3 設定ファイルのコピー
    - `backend/src/config/column-mapping.json`をコピー
    - カラムマッピングを確認
    - _Requirements: 2.2_

- [ ] 14. フロントエンド売主管理ファイルのコピー
  - [ ] 14.1 ページファイルのコピー
    - `frontend/src/pages/SellersPage.tsx`をコピー
    - `frontend/src/pages/NewSellerPage.tsx`をコピー
    - `frontend/src/pages/SellerDetailPage.tsx`をコピー
    - `frontend/src/pages/CallModePage.tsx`をコピー
    - APIエンドポイントを確認
    - _Requirements: 2.1, 2.4, 2.5_

  - [ ] 14.2 コンポーネントのコピー（必要に応じて）
    - `frontend/src/components/sellers/`ディレクトリをコピー
    - 依存関係を確認
    - _Requirements: 2.1_

- [ ] 15. バックエンドindex.tsの更新
  - 売主ルートを追加（`/api/sellers`）
  - 同期ルートを追加（`/api/sync`）
  - 自動同期の起動コードを追加
  - _Requirements: 2.1, 2.2_

- [ ] 16. フロントエンドApp.tsxの更新
  - 売主一覧ページのルートを追加（`/`）
  - 売主作成ページのルートを追加（`/sellers/new`）
  - 売主詳細ページのルートを追加（`/sellers/:id`）
  - 通話モードページのルートを追加（`/sellers/:id/call`）
  - _Requirements: 2.1, 2.4, 2.5_

- [ ] 17. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - 自動同期が起動していることを確認
  - _Requirements: 2.1, 2.2_

- [ ] 18. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 2.1_

- [ ]* 19. 売主管理のテスト
  - [ ]* 19.1 売主一覧表示のテスト
    - 売主一覧ページにアクセス
    - 売主データが正しく表示されることを確認
    - _Requirements: 2.1_

  - [ ]* 19.2 売主作成のテスト
    - 売主作成ページにアクセス
    - 新しい売主を作成
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認（数秒以内）
    - _Requirements: 2.2_

  - [ ]* 19.3 売主編集のテスト
    - 売主詳細ページにアクセス
    - 売主データを編集
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認（数秒以内）
    - _Requirements: 2.2_

  - [ ]* 19.4 売主削除のテスト
    - 売主を削除
    - データベースから削除されることを確認
    - スプレッドシートから削除されることを確認（数秒以内）
    - _Requirements: 2.2_

  - [ ]* 19.5 スプレッドシート同期（Sheet → DB）のテスト
    - スプレッドシートで売主データを編集
    - 5分待機
    - データベースに反映されることを確認
    - _Requirements: 2.2_

  - [ ]* 19.6 通話モードのテスト
    - 通話モードページにアクセス
    - 全てのデータが正しく表示されることを確認
    - _Requirements: 2.4_

  - [ ]* 19.7 売主詳細ページのテスト
    - 売主詳細ページにアクセス
    - 全てのデータが正しく表示されることを確認
    - _Requirements: 2.5_

- [ ] 20. Checkpoint - Phase 2完了確認
  - 全てのテストが成功したことを確認
  - 自動同期が正常に動作していることを確認（`/api/sync/health`）
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 3: 物件管理の移行（5-6日目：2/27-28）

- [ ] 21. バックエンド物件管理ファイルのコピー
  - [ ] 21.1 ルートファイルのコピー
    - `backend/src/routes/properties.ts`をコピー
    - `backend/src/routes/propertyListings.ts`をコピー
    - インポートパスを確認
    - _Requirements: 3.1, 3.2_

  - [ ] 21.2 サービスファイルのコピー
    - `backend/src/services/PropertyService.ts`をコピー
    - `backend/src/services/PropertyListingService.ts`をコピー
    - `backend/src/services/PropertyImageService.ts`をコピー
    - `backend/src/services/GoogleDriveService.ts`をコピー
    - 依存関係を確認
    - _Requirements: 3.1, 3.4_

- [ ] 22. フロントエンド物件管理ファイルのコピー
  - [ ] 22.1 ページファイルのコピー
    - `frontend/src/pages/PropertyListingsPage.tsx`をコピー
    - `frontend/src/pages/PropertyListingDetailPage.tsx`をコピー
    - APIエンドポイントを確認
    - _Requirements: 3.1, 3.3_

  - [ ] 22.2 コンポーネントのコピー（必要に応じて）
    - `frontend/src/components/properties/`ディレクトリをコピー
    - 依存関係を確認
    - _Requirements: 3.1_

- [ ] 23. バックエンドindex.tsの更新
  - 物件ルートを追加（`/api/properties`, `/api/property-listings`）
  - _Requirements: 3.1_

- [ ] 24. フロントエンドApp.tsxの更新
  - 物件一覧ページのルートを追加（`/properties`）
  - 物件詳細ページのルートを追加（`/properties/:id`）
  - _Requirements: 3.1_

- [ ] 25. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 3.1_

- [ ] 26. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 3.1_

- [ ]* 27. 物件管理のテスト
  - [ ]* 27.1 物件一覧表示のテスト
    - 物件一覧ページにアクセス
    - 物件データが正しく表示されることを確認
    - _Requirements: 3.1_

  - [ ]* 27.2 物件詳細表示のテスト
    - 物件詳細ページにアクセス
    - 物件データが正しく表示されることを確認
    - _Requirements: 3.1_

  - [ ]* 27.3 物件画像表示のテスト
    - 物件詳細ページで画像を確認
    - Google Driveから画像が正しく取得されることを確認
    - _Requirements: 3.4_

  - [ ]* 27.4 物件データ更新のテスト
    - 物件データを編集
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認
    - _Requirements: 3.2_

- [ ] 28. Checkpoint - Phase 3完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 4: 買主管理の移行（7-8日目：3/1-2）

- [ ] 29. バックエンド買主管理ファイルのコピー
  - [ ] 29.1 ルートファイルのコピー
    - `backend/src/routes/buyers.ts`をコピー
    - インポートパスを確認
    - _Requirements: 4.1, 4.2_

  - [ ] 29.2 サービスファイルのコピー
    - `backend/src/services/BuyerService.ts`をコピー
    - `backend/src/services/BuyerSyncService.ts`をコピー
    - `backend/src/services/BuyerDistributionService.ts`をコピー
    - 依存関係を確認
    - _Requirements: 4.1, 4.2_

- [ ] 30. フロントエンド買主管理ファイルのコピー
  - [ ] 30.1 ページファイルのコピー
    - `frontend/src/pages/BuyersPage.tsx`をコピー
    - `frontend/src/pages/NewBuyerPage.tsx`をコピー
    - `frontend/src/pages/BuyerDetailPage.tsx`をコピー
    - APIエンドポイントを確認
    - _Requirements: 4.1_

  - [ ] 30.2 コンポーネントのコピー（必要に応じて）
    - `frontend/src/components/buyers/`ディレクトリをコピー
    - 依存関係を確認
    - _Requirements: 4.1_

- [ ] 31. バックエンドindex.tsの更新
  - 買主ルートを追加（`/api/buyers`）
  - _Requirements: 4.1_

- [ ] 32. フロントエンドApp.tsxの更新
  - 買主一覧ページのルートを追加（`/buyers`）
  - 買主作成ページのルートを追加（`/buyers/new`）
  - 買主詳細ページのルートを追加（`/buyers/:id`）
  - _Requirements: 4.1_

- [ ] 33. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 4.1_

- [ ] 34. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 4.1_

- [ ]* 35. 買主管理のテスト
  - [ ]* 35.1 買主一覧表示のテスト
    - 買主一覧ページにアクセス
    - 買主データが正しく表示されることを確認
    - _Requirements: 4.1_

  - [ ]* 35.2 買主作成のテスト
    - 買主作成ページにアクセス
    - 新しい買主を作成
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認
    - _Requirements: 4.2_

  - [ ]* 35.3 買主編集のテスト
    - 買主詳細ページにアクセス
    - 買主データを編集
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認
    - _Requirements: 4.2_

  - [ ]* 35.4 買主削除のテスト
    - 買主を削除
    - データベースから削除されることを確認
    - _Requirements: 4.2_

  - [ ]* 35.5 買主リストフィルタリングのテスト
    - フィルタ条件を指定
    - 正しい買主のみが表示されることを確認
    - _Requirements: 4.3_

- [ ] 36. Checkpoint - Phase 4完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 5: 業務リスト管理の移行（9日目：3/3）

- [ ] 37. バックエンド業務リスト管理ファイルのコピー
  - [ ] 37.1 ルートファイルのコピー
    - `backend/src/routes/workTasks.ts`をコピー
    - インポートパスを確認
    - _Requirements: 5.1, 5.2_

  - [ ] 37.2 サービスファイルのコピー
    - `backend/src/services/WorkTaskService.ts`をコピー
    - `backend/src/services/WorkTaskSyncService.ts`をコピー
    - 依存関係を確認
    - _Requirements: 5.1, 5.2_

- [ ] 38. フロントエンド業務リスト管理ファイルのコピー
  - [ ] 38.1 ページファイルのコピー
    - `frontend/src/pages/WorkTasksPage.tsx`をコピー
    - APIエンドポイントを確認
    - _Requirements: 5.1_

  - [ ] 38.2 コンポーネントのコピー（必要に応じて）
    - `frontend/src/components/workTasks/`ディレクトリをコピー
    - 依存関係を確認
    - _Requirements: 5.1_

- [ ] 39. バックエンドindex.tsの更新
  - 業務タスクルートを追加（`/api/work-tasks`）
  - _Requirements: 5.1_

- [ ] 40. フロントエンドApp.tsxの更新
  - 業務リストページのルートを追加（`/work-tasks`）
  - _Requirements: 5.1_

- [ ] 41. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 5.1_

- [ ] 42. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 5.1_

- [ ]* 43. 業務リスト管理のテスト
  - [ ]* 43.1 業務リスト表示のテスト
    - 業務リストページにアクセス
    - 業務データが正しく表示されることを確認
    - _Requirements: 5.1_

  - [ ]* 43.2 タスク作成のテスト
    - 新しいタスクを作成
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認
    - _Requirements: 5.2_

  - [ ]* 43.3 タスク編集のテスト
    - タスクを編集
    - データベースに保存されることを確認
    - スプレッドシートに同期されることを確認
    - _Requirements: 5.2_

  - [ ]* 43.4 タスク完了のテスト
    - タスクを完了にする
    - データベースに保存されることを確認
    - _Requirements: 5.2_

  - [ ]* 43.5 業務リストフィルタリングのテスト
    - フィルタ条件を指定
    - 正しい業務のみが表示されることを確認
    - _Requirements: 5.3_

- [ ] 44. Checkpoint - Phase 5完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 6: 従業員・カレンダー管理の移行（10日目：3/4）

- [ ] 45. バックエンド従業員・カレンダー管理ファイルのコピー
  - [ ] 45.1 ルートファイルのコピー
    - `backend/src/routes/employees.ts`をコピー
    - `backend/src/routes/googleCalendar.ts`をコピー
    - インポートパスを確認
    - _Requirements: 6.1, 6.2_

  - [ ] 45.2 サービスファイルのコピー
    - `backend/src/services/CalendarService.supabase.ts`をコピー
    - 依存関係を確認
    - _Requirements: 6.2, 6.3_

- [ ] 46. フロントエンド従業員・カレンダー管理ファイルのコピー
  - [ ] 46.1 ページファイルのコピー
    - `frontend/src/pages/EmployeeCalendarStatusPage.tsx`をコピー
    - APIエンドポイントを確認
    - _Requirements: 6.1, 6.2_

  - [ ] 46.2 コンポーネントのコピー（必要に応じて）
    - `frontend/src/components/employees/`ディレクトリをコピー
    - `frontend/src/components/calendar/`ディレクトリをコピー
    - 依存関係を確認
    - _Requirements: 6.1, 6.2_

- [ ] 47. バックエンドindex.tsの更新
  - 従業員ルートを追加（`/api/employees`）
  - カレンダールートを追加（`/api/google-calendar`）
  - _Requirements: 6.1, 6.2_

- [ ] 48. フロントエンドApp.tsxの更新
  - 従業員カレンダー状態ページのルートを追加（`/employee-calendar`）
  - _Requirements: 6.1, 6.2_

- [ ] 49. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 6.1, 6.2_

- [ ] 50. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 6.1, 6.2_

- [ ]* 51. 従業員・カレンダー管理のテスト
  - [ ]* 51.1 従業員一覧表示のテスト
    - 従業員カレンダー状態ページにアクセス
    - 従業員データが正しく表示されることを確認
    - _Requirements: 6.1_

  - [ ]* 51.2 カレンダーイベント取得のテスト
    - カレンダーイベントを取得
    - 正しいイベントが表示されることを確認
    - _Requirements: 6.2_

  - [ ]* 51.3 カレンダーイベント作成のテスト
    - 新しいイベントを作成
    - データベースに保存されることを確認
    - Google Calendarに同期されることを確認
    - _Requirements: 6.3_

- [ ] 52. Checkpoint - Phase 6完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 7: メール・通知機能の移行（11日目：3/5）

- [ ] 53. バックエンドメール・通知機能ファイルのコピー
  - [ ] 53.1 ルートファイルのコピー
    - `backend/src/routes/emails.ts`をコピー
    - `backend/src/routes/gmail.ts`をコピー
    - インポートパスを確認
    - _Requirements: 7.1_

  - [ ] 53.2 サービスファイルのコピー
    - `backend/src/services/EmailService.supabase.ts`をコピー
    - `backend/src/services/ChatNotificationService.ts`をコピー
    - 依存関係を確認
    - _Requirements: 7.1, 7.2_

- [ ] 54. バックエンドindex.tsの更新
  - メールルートを追加（`/api/emails`）
  - Gmailルートを追加（`/api/gmail`）
  - _Requirements: 7.1_

- [ ] 55. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 7.1_

- [ ]* 56. メール・通知機能のテスト
  - [ ]* 56.1 メール送信のテスト
    - メールを送信
    - 正しい宛先に送信されることを確認
    - 正しい内容が送信されることを確認
    - _Requirements: 7.1_

  - [ ]* 56.2 Gmail連携のテスト
    - Gmail APIを使用してメールを送信
    - 正しく送信されることを確認
    - _Requirements: 7.1_

  - [ ]* 56.3 通知送信のテスト
    - 通知を送信
    - 正しいユーザーに送信されることを確認
    - 正しい内容が送信されることを確認
    - _Requirements: 7.2_

- [ ] 57. Checkpoint - Phase 7完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### Phase 8: その他の機能の移行（12日目：3/6）

- [ ] 58. バックエンドその他機能ファイルのコピー
  - [ ] 58.1 アクティビティログ関連ファイルのコピー
    - `backend/src/routes/activityLogs.ts`をコピー（存在する場合）
    - `backend/src/services/ActivityLogService.ts`をコピー（存在する場合）
    - _Requirements: 8.1_

  - [ ] 58.2 フォローアップ関連ファイルのコピー
    - `backend/src/routes/followUps.ts`をコピー（存在する場合）
    - `backend/src/services/FollowUpService.ts`をコピー（存在する場合）
    - _Requirements: 8.1_

  - [ ] 58.3 予約管理関連ファイルのコピー
    - `backend/src/routes/appointments.ts`をコピー（存在する場合）
    - `backend/src/services/AppointmentService.ts`をコピー（存在する場合）
    - _Requirements: 8.1_

  - [ ] 58.4 統計・レポート関連ファイルのコピー
    - `backend/src/routes/statistics.ts`をコピー（存在する場合）
    - `backend/src/services/StatisticsService.ts`をコピー（存在する場合）
    - _Requirements: 8.1, 8.2_

- [ ] 59. フロントエンドその他機能ファイルのコピー
  - [ ] 59.1 設定ページのコピー
    - `frontend/src/pages/SettingsPage.tsx`をコピー（存在する場合）
    - _Requirements: 8.1_

  - [ ] 59.2 統計ページのコピー
    - `frontend/src/pages/StatisticsPage.tsx`をコピー（存在する場合）
    - _Requirements: 8.1_

- [ ] 60. バックエンドindex.tsの更新
  - その他のルートを追加
  - _Requirements: 8.1_

- [ ] 61. フロントエンドApp.tsxの更新
  - その他のページのルートを追加
  - _Requirements: 8.1_

- [ ] 62. バックエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 8.1_

- [ ] 63. フロントエンドのデプロイ
  - Vercelにデプロイ
  - デプロイログを確認
  - _Requirements: 8.1_

- [ ]* 64. その他機能のテスト
  - [ ]* 64.1 統計データ取得のテスト
    - 統計データを取得
    - 正しいデータが返されることを確認
    - _Requirements: 8.1_

  - [ ]* 64.2 レポート生成のテスト
    - レポートを生成
    - 正しい形式で生成されることを確認
    - _Requirements: 8.2_

- [ ] 65. Checkpoint - Phase 8完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに動作確認を依頼

---

### 最終検証（13日目：3/7）

- [ ] 66. 全機能の動作確認
  - [ ] 66.1 認証システムの確認
    - ログイン・ログアウトが正常に動作することを確認
    - _Requirements: 1.1_

  - [ ] 66.2 売主管理の確認
    - 売主CRUD操作が正常に動作することを確認
    - スプレッドシート同期が正常に動作することを確認
    - _Requirements: 2.1, 2.2_

  - [ ] 66.3 物件管理の確認
    - 物件表示が正常に動作することを確認
    - 画像取得が正常に動作することを確認
    - _Requirements: 3.1, 3.4_

  - [ ] 66.4 買主管理の確認
    - 買主CRUD操作が正常に動作することを確認
    - _Requirements: 4.1, 4.2_

  - [ ] 66.5 業務リスト管理の確認
    - 業務リスト表示が正常に動作することを確認
    - _Requirements: 5.1_

  - [ ] 66.6 従業員・カレンダー管理の確認
    - 従業員データとカレンダーイベントが正常に表示されることを確認
    - _Requirements: 6.1, 6.2_

  - [ ] 66.7 メール・通知機能の確認
    - メール送信と通知が正常に動作することを確認
    - _Requirements: 7.1, 7.2_

  - [ ] 66.8 その他機能の確認
    - 統計データとレポートが正常に生成されることを確認
    - _Requirements: 8.1, 8.2_

- [ ]* 67. パフォーマンステスト
  - [ ]* 67.1 ページ読み込み時間の測定
    - 全てのページの読み込み時間を測定
    - 3秒以内であることを確認
    - _Requirements: 9.1_

  - [ ]* 67.2 API応答時間の測定
    - 全てのAPIエンドポイントの応答時間を測定
    - 500ms以内であることを確認
    - _Requirements: 9.1_

  - [ ]* 67.3 スプレッドシート同期時間の測定
    - スプレッドシート同期の時間を測定
    - 30秒以内であることを確認
    - _Requirements: 9.1_

  - [ ]* 67.4 同時アクセステスト
    - 100ユーザーが同時にアクセス
    - 全てのリクエストが正常に処理されることを確認
    - _Requirements: 9.2_

- [ ]* 68. セキュリティテスト
  - [ ]* 68.1 認証・認可のテスト
    - 無効な認証トークンでアクセス
    - 401エラーが返されることを確認
    - _Requirements: 10.1_

  - [ ]* 68.2 データ暗号化のテスト
    - 機密データが暗号化されていることを確認
    - _Requirements: 10.1_

  - [ ]* 68.3 CORS設定のテスト
    - CORS設定が正しいことを確認
    - _Requirements: 10.1_

- [ ]* 69. 回帰テスト
  - [ ]* 69.1 以前のプロジェクトとの比較
    - 以前のプロジェクトと新しいプロジェクトの動作を比較
    - 同じ動作をすることを確認
    - _Requirements: 12.1_

  - [ ]* 69.2 データの整合性確認
    - データベースとスプレッドシートのデータが一致することを確認
    - _Requirements: 11.3_

  - [ ]* 69.3 パフォーマンスの比較
    - 以前のプロジェクトと新しいプロジェクトのパフォーマンスを比較
    - 同等以上であることを確認
    - _Requirements: 9.1_

- [ ] 70. 公開物件サイトへの影響確認
  - 公開物件サイトにアクセス
  - 移行前と同じように動作することを確認
  - パフォーマンスが維持されていることを確認
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 71. Checkpoint - 最終検証完了確認
  - 全てのテストが成功したことを確認
  - エラーログを確認
  - ユーザーに最終確認を依頼

---

### 本番切り替え（14日目：3/8）

- [ ] 72. 最終確認
  - 全機能が正常に動作することを確認
  - パフォーマンスが許容範囲内であることを確認
  - セキュリティ対策が実装済みであることを確認
  - _Requirements: 全体_

- [ ] 73. DNS切り替え（該当する場合）
  - カスタムドメインを使用している場合、DNSレコードを新しいVercelプロジェクトに向ける
  - DNS伝播を確認（最大48時間）
  - _Requirements: 全体_

- [ ] 74. 監視開始
  - エラーログの監視を開始
  - パフォーマンスの監視を開始
  - ユーザーフィードバックの収集を開始
  - _Requirements: 全体_

- [ ] 75. 以前のプロジェクトの保持
  - 以前のプロジェクトを最低1ヶ月間保持
  - 問題が発生した場合、即座にロールバックできる体制を整える
  - _Requirements: 全体_

- [ ] 76. ユーザーへの通知
  - 移行完了をユーザーに通知
  - 新しいURLを案内（該当する場合）
  - _Requirements: 全体_

- [ ] 77. Checkpoint - 本番切り替え完了確認
  - 本番環境で全機能が正常に動作することを確認
  - エラーログを確認
  - ユーザーフィードバックを確認

---

## Notes

### 重要な注意事項

1. **公開物件サイトへの影響ゼロ**
   - `backend/api/`ディレクトリは絶対に移行しない
   - 移行中も公開物件サイトを定期的に確認
   - 問題が発生した場合、即座に対応

2. **段階的移行の徹底**
   - 各フェーズを順番に実行
   - 各フェーズ完了後、必ずCheckpointで確認
   - 問題が発生した場合、前のフェーズにロールバック

3. **テストの徹底**
   - 各フェーズで必ずテストを実行
   - テストが失敗した場合、原因を特定して修正
   - 全てのテストが成功するまで次のフェーズに進まない

4. **環境変数の管理**
   - 環境変数は絶対にGitにコミットしない
   - Vercelダッシュボードで設定
   - `GOOGLE_SERVICE_ACCOUNT_KEY`はBase64エンコードして設定

5. **自動同期の確認**
   - Phase 2完了後、自動同期が正常に動作していることを確認
   - `/api/sync/health`エンドポイントで同期ステータスを確認
   - 同期間隔は5分ごと（デフォルト）

6. **ロールバック準備**
   - 以前のプロジェクトを1ヶ月間保持
   - 問題が発生した場合、即座にロールバックできる体制を整える
   - データベースのバックアップを定期的に作成

### タスクマーキングについて

- `*`マークが付いているタスクはオプション（テスト関連）
- オプションタスクはスキップ可能だが、実行を推奨
- コアタスク（`*`なし）は必ず実行すること

### 移行スケジュール

| 日 | フェーズ | 主要タスク |
|----|---------|-----------|
| 1日目（2/23） | 事前準備 | Vercelプロジェクト作成、環境変数設定 |
| 2日目（2/24） | Phase 1 | 認証システム移行 |
| 3-4日目（2/25-26） | Phase 2 | 売主管理移行 |
| 5-6日目（2/27-28） | Phase 3 | 物件管理移行 |
| 7-8日目（3/1-2） | Phase 4 | 買主管理移行 |
| 9日目（3/3） | Phase 5 | 業務リスト管理移行 |
| 10日目（3/4） | Phase 6 | 従業員・カレンダー管理移行 |
| 11日目（3/5） | Phase 7 | メール・通知機能移行 |
| 12日目（3/6） | Phase 8 | その他機能移行 |
| 13日目（3/7） | 最終検証 | 全機能の動作確認、パフォーマンステスト |
| 14日目（3/8） | 本番切り替え | DNS切り替え、監視開始 |

### トラブルシューティング

**問題が発生した場合の対応手順**:

1. **エラーログを確認**
   - Vercelのログを確認
   - ブラウザのコンソールを確認
   - サーバーのログを確認

2. **原因を特定**
   - エラーメッセージを読む
   - 関連するコードを確認
   - 環境変数を確認

3. **修正を試みる**
   - 問題を修正
   - テスト環境で検証
   - 再デプロイ

4. **ロールバック（必要な場合）**
   - 前のフェーズに戻す
   - 以前のプロジェクトに戻す
   - ユーザーに通知

### 連絡先

**問題が解決しない場合**:
- 技術サポートに連絡
- ログを収集して共有
- エラーメッセージを記録

---

**移行開始予定日**: 2026年2月23日  
**本番切り替え予定日**: 2026年3月8日  
**移行期間**: 14日間
