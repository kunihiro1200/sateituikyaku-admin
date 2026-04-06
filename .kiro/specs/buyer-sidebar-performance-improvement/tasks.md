# Implementation Plan: 買主サイドバーパフォーマンス改善

## Overview

買主リストページのサイドバー表示速度を改善します。売主リストで成功した「GAS事前計算 + 高速エンドポイント + 並列取得」のアーキテクチャをそのまま適用し、初回表示を5秒以内（目標1秒以内）に短縮します。

## Tasks

- [x] 1. GASコードと既存エンドポイントの確認
  - `gas_buyer_complete_code.js`に`updateBuyerSidebarCounts_()`関数が存在することを確認
  - `buyer_sidebar_counts`テーブルにデータが保存されていることを確認
  - `/api/buyers/sidebar-counts`エンドポイントが正しく動作することを確認
  - _Requirements: 1.1, 2.1_

- [ ] 2. データベースクエリの最適化
  - [x] 2.1 必要最小限のカラムのみSELECTするようにクエリを修正
    - `BuyerService.ts`の全買主データ取得クエリを修正
    - `select('*')`を`select('buyer_number, calculated_status, assignee, viewing_date, next_call_date, deleted_at')`に変更
    - _Requirements: 4.1_
  
  - [ ] 2.2 deleted_at IS NULL条件のインデックスを作成
    - SQLマイグレーションファイルを作成
    - `CREATE INDEX idx_buyers_deleted_at ON buyers(deleted_at) WHERE deleted_at IS NULL;`を実行
    - _Requirements: 4.2_
  
  - [ ] 2.3 Supabaseクライアントの接続プール設定を確認
    - `backend/src/config/supabase.ts`の設定を確認
    - 接続プールが有効化されていることを確認
    - _Requirements: 4.4_

- [ ] 3. パフォーマンス監視とロギングの実装
  - [ ] 3.1 BuyerService.getSidebarCounts()にログを追加
    - 処理開始時刻を記録
    - 処理完了時に所要時間をログ出力
    - 5秒超過時に警告ログを出力
    - エラー発生時にスタックトレースを出力
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ] 3.2 BuyerService.getSidebarCountsFallback()にログを追加
    - フォールバック処理の開始をログ出力
    - 処理時間をログ出力
    - _Requirements: 5.1, 5.4_

- [ ] 4. Checkpoint - バックエンドの動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. フロントエンドの並列取得ロジックを実装
  - [ ] 5.1 SellersPage.tsxの並列取得ロジックをコピー
    - `frontend/src/pages/SellersPage.tsx`から並列取得ロジックをコピー
    - `BuyersPage.tsx`に貼り付け
    - _Requirements: 1.2, 3.3_
  
  - [ ] 5.2 変数名とエンドポイントを買主用に変更
    - `sellers` → `buyers`に置換
    - `CACHE_KEYS.SELLERS_WITH_STATUS` → `CACHE_KEYS.BUYERS_WITH_STATUS`に置換
    - `/api/sellers/*` → `/api/buyers/*`に置換
    - _Requirements: 1.2_
  
  - [ ] 5.3 プログレッシブローディングの実装
    - 「読み込み中」インジケーターを表示
    - サイドバーカウントが完了したカテゴリから順次表示
    - 全買主データの取得完了を待たずにサイドバー表示
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 5.4 タイムアウトエラーの実装
    - 5秒超過時にタイムアウトエラーを表示
    - エラーメッセージをユーザーに表示
    - _Requirements: 3.4_
  
  - [ ] 5.5 フロントエンドのパフォーマンスログを追加
    - サイドバーカウント取得時間をログ出力
    - 全買主データ取得時間をログ出力
    - 合計処理時間をログ出力
    - 5秒超過時に警告ログを出力
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 6. Checkpoint - フロントエンドの動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. 後方互換性の確認
  - [ ] 7.1 APIレスポンス形式の確認
    - `/api/buyers/sidebar-counts`のレスポンスに`categoryCounts`と`normalStaffInitials`が含まれることを確認
    - 既存のフロントエンドコードと互換性があることを確認
    - _Requirements: 6.1_
  
  - [ ] 7.2 キャッシュキーの互換性確認
    - `CACHE_KEYS.BUYERS_WITH_STATUS`が既存のキャッシュキーと互換性があることを確認
    - _Requirements: 6.2_
  
  - [ ] 7.3 ステータス計算ロジックの一貫性確認
    - GASで計算されたステータスとバックエンドで計算されたステータスが一致することを確認
    - _Requirements: 6.3_
  
  - [ ] 7.4 買主データ更新時のキャッシュ無効化確認
    - 買主データ更新時にサイドバーカウントが即座に反映されることを確認
    - _Requirements: 6.4_

- [ ] 8. 統合テストとパフォーマンス測定
  - [ ] 8.1 ローカル環境でのテスト
    - 買主リストページを開く
    - サイドバーカウントが5秒以内に表示されることを確認
    - バックグラウンドで全買主データが取得されることを確認（DevToolsのNetworkタブ）
    - カテゴリー展開時に詳細データが表示されることを確認
    - _Requirements: 1.1, 3.2, 3.3_
  
  - [ ] 8.2 プログレッシブローディングの確認
    - 「読み込み中」インジケーターが表示されることを確認
    - サイドバーカウントが先に表示されることを確認
    - 全買主データの取得完了を待たずにサイドバーが表示されることを確認
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 8.3 エラーハンドリングの確認
    - 5秒超過時にタイムアウトエラーが表示されることを確認（テスト用に遅延を追加）
    - APIエラー時にカウントが0にリセットされることを確認
    - _Requirements: 3.4_
  
  - [ ] 8.4 キャッシュの動作確認
    - 2回目以降のアクセスが高速であることを確認（キャッシュから取得）
    - 買主データ更新時にキャッシュが無効化されることを確認
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 9. Final checkpoint - 全テスト完了確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- GASコード（`gas_buyer_complete_code.js`）は絶対に変更しない
- `/api/buyers/sidebar-counts`エンドポイントは既に実装済み・変更不要
- 売主リストの成功パターンをそのままコピーして適用
- 新しい実装は一切行わず、既存の動作しているコードを再利用
- 各タスクは具体的な要件番号を参照して実装
- Checkpointタスクでユーザーに進捗を確認
