# 実装計画：売主リスト通話モードページ「専任他決打合せ」フィールド追加

## 概要

売主リストの通話モードページに「専任他決打合せ」フィールドを追加します。このフィールドは、専任、他決、または一般が決定した売主に対する打合せ内容を記録するために使用されます。データベース、バックエンドAPI、フロントエンドUI、スプレッドシート同期の全てを実装します。

## タスク

- [x] 1. データベーススキーマの追加
  - `sellers`テーブルに`exclusive_other_decision_meeting`カラム（TEXT型、NULL許可）を追加するマイグレーションファイルを作成
  - マイグレーションファイル名: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_exclusive_other_decision_meeting.sql`
  - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 2. バックエンド型定義の追加
  - `backend/src/types/index.ts`の`Seller`型に`exclusive_other_decision_meeting?: string`フィールドを追加
  - _要件: 9.2_

- [x] 3. カラムマッピングの追加
  - `backend/src/config/column-mapping.json`の`spreadsheetToDatabase`セクションに`"専任他決打合せ": "exclusive_other_decision_meeting"`を追加
  - `databaseToSpreadsheet`セクションに`"exclusive_other_decision_meeting": "専任他決打合せ"`を追加
  - `typeConversions`セクションに`"exclusive_other_decision_meeting": "string"`を追加
  - _要件: 4.1, 4.2, 4.3_

- [x] 4. SellerServiceのAPIレスポンスに追加
  - `backend/src/services/SellerService.supabase.ts`の`decryptSeller()`メソッドに`exclusiveOtherDecisionMeeting: seller.exclusive_other_decision_meeting`を追加
  - APIレスポンスに`exclusiveOtherDecisionMeeting`フィールドが含まれることを確認
  - _要件: 5.1, 5.2, 5.3, 5.4_

- [ ]* 4.1 SellerServiceのプロパティテスト - APIレスポンスの完全性
  - **プロパティ4: APIレスポンスの完全性**
  - **検証: 要件5.1, 5.2, 5.3**
  - 任意の売主IDに対して、`/api/sellers/:id`エンドポイントを呼び出した場合、レスポンスに`exclusiveOtherDecisionMeeting`フィールドが含まれることを検証
  - テストファイル: `backend/src/__tests__/SellerService-exclusive-other-decision-meeting-properties.test.ts`

- [x] 5. スプレッドシート同期処理の追加
  - [x] 5.1 EnhancedAutoSyncServiceのsyncSingleSellerメソッドに同期処理を追加
    - CZ列（列番号104、0-indexed: 103）から「専任他決打合せ」を取得
    - `updateData.exclusive_other_decision_meeting`に設定
    - _要件: 8.1, 8.3_
  
  - [x] 5.2 EnhancedAutoSyncServiceのupdateSingleSellerメソッドに同期処理を追加
    - CZ列（列番号104、0-indexed: 103）から「専任他決打合せ」を取得
    - `updateData.exclusive_other_decision_meeting`に設定
    - _要件: 8.2, 8.4_

- [ ]* 5.3 スプレッドシート同期のプロパティテスト - 双方向同期の一貫性
  - **プロパティ5: 双方向同期の一貫性**
  - **検証: 要件8.3, 8.4**
  - データベース→スプレッドシート、スプレッドシート→データベースの双方向同期が正しく動作することを検証
  - テストファイル: `backend/src/__tests__/exclusive-other-decision-meeting-sync-properties.test.ts`

- [x] 6. フロントエンド型定義の追加
  - `frontend/frontend/src/types/index.ts`の`Seller`型に`exclusiveOtherDecisionMeeting?: string`フィールドを追加
  - _要件: 9.1_

- [x] 7. CallModePageの状態管理とUI実装
  - [x] 7.1 状態管理の追加
    - `editedExclusiveOtherDecisionMeeting`状態を追加
    - 初期値を`seller?.exclusiveOtherDecisionMeeting || ''`に設定
    - _要件: 6.1, 6.2, 6.3_
  
  - [x] 7.2 UIコンポーネントの追加
    - ステータスセクションに「専任他決打合せ」フィールド（複数行テキストフィールド）を追加
    - 表示条件: `requiresDecisionDate(editedStatus)`（ステータスに「専任」「他決」「一般」が含まれる場合）
    - 配置位置: 「確度」フィールドの上
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 7.3 保存処理の実装
    - `handleUpdateStatus()`関数のAPIリクエストに`exclusiveOtherDecisionMeeting: editedExclusiveOtherDecisionMeeting`を追加
    - 保存成功時に売主データを再読み込み
    - _要件: 6.4, 7.1, 7.2, 7.3, 7.4_

- [ ]* 7.4 CallModePageのプロパティテスト - 表示条件の正確性
  - **プロパティ1: 表示条件の正確性**
  - **検証: 要件1.1**
  - 任意の売主ステータスに対して、ステータスに「専任」「他決」「一般」が含まれる場合、「専任他決打合せ」フィールドが表示されることを検証
  - テストファイル: `frontend/frontend/src/__tests__/CallModePage-exclusive-other-decision-meeting-properties.test.tsx`

- [ ]* 7.5 CallModePageの単体テスト
  - 「専任」「他決」「一般」が含まれるステータスの場合、フィールドが表示されることをテスト
  - 「追客中」のステータスの場合、フィールドが表示されないことをテスト
  - フィールドに入力した場合、状態が更新されることをテスト
  - 保存ボタンをクリックした場合、APIが呼び出されることをテスト
  - テストファイル: `frontend/frontend/src/__tests__/CallModePage-exclusive-other-decision-meeting.test.tsx`
  - _要件: 1.1, 1.5, 6.3, 7.1_

- [x] 8. チェックポイント - 基本機能の動作確認
  - 全てのテストが通ることを確認
  - ローカル環境で通話モードページを開き、「専任他決打合せ」フィールドが正しく表示されることを確認
  - フィールドに入力して保存し、データベースに保存されることを確認
  - 質問があればユーザーに確認

- [ ]* 9. 統合テスト - データ保存と同期の検証
  - フロントエンドからバックエンドへのAPI呼び出しをテスト
  - バックエンドからデータベースへの保存をテスト
  - データベースからスプレッドシートへの同期をテスト（SyncQueue経由）
  - スプレッドシートからデータベースへの同期をテスト（GAS経由）
  - テストファイル: `backend/src/__tests__/exclusive-other-decision-meeting-integration.test.ts`
  - _要件: 2.1, 2.2, 2.3, 8.3, 8.4_

- [ ]* 10. プロパティテスト - 保存時のデータ整合性
  - **プロパティ2: 保存時のデータ整合性**
  - **検証: 要件2.1, 2.2, 2.3**
  - 任意の入力値に対して、データベースとスプレッドシートに同じ値が保存されることを検証
  - テストファイル: `backend/src/__tests__/exclusive-other-decision-meeting-data-integrity.test.ts`

- [ ]* 11. プロパティテスト - NULL値の正確性
  - **プロパティ3: NULL値の正確性**
  - **検証: 要件2.5**
  - 空文字列を保存した場合、データベースとスプレッドシートにnullまたは空文字列が保存されることを検証
  - テストファイル: `backend/src/__tests__/exclusive-other-decision-meeting-null-handling.test.ts`

- [x] 12. 最終チェックポイント - 全体動作確認
  - 全てのテストが通ることを確認
  - ローカル環境でエンドツーエンドの動作確認（入力→保存→スプレッドシート同期→再読み込み）
  - 質問があればユーザーに確認

## 注意事項

- タスクに`*`が付いているものはオプションで、スキップ可能です
- 各タスクは要件定義書の特定の要件を検証します
- プロパティテストは設計ドキュメントの正確性プロパティを検証します
- チェックポイントで段階的に動作確認を行います
- スプレッドシートのCZ列（列番号104、0-indexed: 103）とデータベースの`exclusive_other_decision_meeting`カラムは常に同期されます
