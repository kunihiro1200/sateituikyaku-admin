# 実装計画: 物件詳細ページヘッダーボタンレイアウト変更と確認フィールド実装

## 概要

物件詳細ページのヘッダー部分に表示されるボタンのレイアウトを2行に変更し、新たに「事務へCHAT」ボタンを追加します。また、物件リストに「確認」フィールドを実装し、スプレッドシートのDQ列（列番号120）と双方向同期を行います。「確認」フィールドが「未」の物件は、サイドバーに「未完了」カテゴリとして表示されます。

## タスク

- [ ] 1. データベースとバックエンドAPIの実装
  - [ ] 1.1 property_listingsテーブルの確認フィールドにデフォルト値とCHECK制約を追加
    - マイグレーションファイルを作成（`backend/migrations/XXX_add_confirmation_constraints.sql`）
    - 既存物件の確認フィールドに初期値「未」を設定
    - デフォルト値を「未」に設定
    - CHECK制約を追加（「未」または「済」のみ許可）
    - _要件: 3.2, 3.3, 7.1, 7.2_
  
  - [ ]* 1.2 確認フィールドのバリデーションプロパティテストを作成
    - **Property 2: 確認フィールドのバリデーション**
    - **検証: 要件 3.2, 4.4**
    - テストファイル: `backend/src/__tests__/property-listing-confirmation-validation.property.test.ts`
  
  - [ ]* 1.3 新規物件のデフォルト値プロパティテストを作成
    - **Property 3: 新規物件のデフォルト値**
    - **検証: 要件 3.3**
    - テストファイル: `backend/src/__tests__/property-listing-confirmation-default.property.test.ts`
  
  - [ ] 1.4 PropertyListingServiceに確認フィールド更新メソッドを追加
    - `updateConfirmation(propertyNumber: string, confirmation: '未' | '済')`メソッドを実装
    - バリデーション処理を追加
    - updated_atタイムスタンプの更新
    - 同期キューへの追加
    - _要件: 3.1, 3.2, 3.4_
  
  - [ ]* 1.4.1 確認フィールド更新時のタイムスタンプ記録プロパティテストを作成
    - **Property 4: 確認フィールド更新時のタイムスタンプ記録**
    - **検証: 要件 3.4**
    - テストファイル: `backend/src/__tests__/property-listing-confirmation-timestamp.property.test.ts`
  
  - [ ] 1.5 PropertyListingServiceに事務へCHAT送信メソッドを追加
    - `sendChatToOffice(propertyNumber: string, message: string, senderName: string)`メソッドを実装
    - チャットアドレス取得処理
    - チャットアプリケーション起動処理（既存の「担当へCHAT」と同じパターン）
    - 確認フィールドを「未」に自動設定
    - _要件: 2.2, 2.3, 2.4_
  
  - [ ]* 1.5.1 事務へCHATボタンクリック時の確認フィールド自動設定プロパティテストを作成
    - **Property 1: 事務へCHATボタンクリック時の確認フィールド自動設定**
    - **検証: 要件 2.3**
    - テストファイル: `backend/src/__tests__/property-listing-chat-to-office.property.test.ts`
  
  - [ ] 1.6 APIルートに確認フィールド更新エンドポイントを追加
    - `PUT /api/property-listings/:propertyNumber/confirmation`エンドポイントを実装
    - リクエストボディのバリデーション
    - エラーハンドリング
    - _要件: 5.2, 5.3, 8.2_
  
  - [ ] 1.7 APIルートに事務へCHAT送信エンドポイントを追加
    - `POST /api/property-listings/:propertyNumber/send-chat-to-office`エンドポイントを実装
    - リクエストボディのバリデーション
    - エラーハンドリング
    - _要件: 2.1, 2.2, 8.1_

- [ ] 2. スプレッドシート同期の実装
  - [ ] 2.1 PropertyListingSyncServiceに確認フィールドのスプレッドシート同期メソッドを追加
    - `syncConfirmationToSpreadsheet(propertyNumber: string, confirmation: '未' | '済')`メソッドを実装
    - DQ列（列番号120）への書き込み処理
    - 物件番号から行番号を取得する処理
    - エラーハンドリングとリトライ処理（最大3回、Exponential backoff）
    - _要件: 4.1, 4.2, 8.3_
  
  - [ ] 2.2 PropertyListingSyncServiceに確認フィールドのスプレッドシート→DB同期メソッドを追加
    - `syncConfirmationFromSpreadsheet()`メソッドを実装
    - DQ列（列番号120）からの読み取り処理
    - バリデーション処理（「未」または「済」のみ許可）
    - 無効な値のエラーログ記録とスキップ処理
    - _要件: 4.3, 4.4, 4.5_
  
  - [ ]* 2.3 確認フィールドの双方向同期プロパティテストを作成
    - **Property 5: 確認フィールドの双方向同期**
    - **検証: 要件 4.1**
    - テストファイル: `backend/src/__tests__/property-listing-confirmation-sync.property.test.ts`
  
  - [ ] 2.4 PropertyListingSyncQueueに確認フィールド同期のキュー処理を追加
    - 確認フィールド更新時の同期キュー追加
    - キュー処理の実装
    - _要件: 4.2_

- [ ] 3. フロントエンド - 確認フィールドUI実装
  - [ ] 3.1 PropertyListingsPageに確認フィールドトグルボタンを追加
    - 「未」「済」ボタンの実装
    - 現在選択されている値の視覚的表示
    - ボタンクリック時のハンドラー実装
    - ローディング状態の管理
    - _要件: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 3.1.1 確認ボタンクリック時の動作プロパティテストを作成
    - **Property 6: 確認ボタンクリック時の動作**
    - **検証: 要件 5.2, 5.3**
    - テストファイル: `frontend/frontend/src/__tests__/property-listing-confirmation-toggle.property.test.ts`
  
  - [ ] 3.2 確認フィールド更新時の成功通知を実装
    - Snackbarコンポーネントでの通知表示
    - エラー時の通知表示
    - _要件: 5.5, 8.2_
  
  - [ ]* 3.2.1 確認フィールド更新時の成功通知プロパティテストを作成
    - **Property 7: 確認フィールド更新時の成功通知**
    - **検証: 要件 5.5**
    - テストファイル: `frontend/frontend/src/__tests__/property-listing-confirmation-notification.property.test.ts`
  
  - [ ] 3.3 確認フィールドのアクセシビリティ対応
    - aria-labelの設定
    - aria-pressedの設定
    - aria-live領域の実装
    - _要件: 10.2, 10.3_

- [ ] 4. フロントエンド - ヘッダーボタンレイアウト変更
  - [ ] 4.1 PropertyListingsPageのヘッダーボタンを2行レイアウトに変更
    - 第1行: 「売主TEL」「EMAIL送信」「SMS」「公開URL」
    - 第2行: 「担当へCHAT」「事務へCHAT」
    - レスポンシブ対応（flexWrap）
    - _要件: 1.1, 1.2, 1.3, 1.4_
  
  - [ ] 4.2 「事務へCHAT」ボタンを実装
    - ボタンコンポーネントの追加
    - クリックハンドラーの実装
    - チャット送信API呼び出し
    - 確認フィールドの自動更新
    - _要件: 2.1, 2.2, 2.3, 2.4_
  
  - [ ] 4.3 「事務へCHAT」ボタンのアクセシビリティ対応
    - aria-labelの設定
    - _要件: 10.1_
  
  - [ ]* 4.4 ヘッダーボタンレイアウトのユニットテストを作成
    - 第1行と第2行のボタン配置を検証
    - レスポンシブ動作を検証
    - テストファイル: `frontend/frontend/src/__tests__/property-listing-header-layout.test.tsx`

- [ ] 5. フロントエンド - サイドバー「未完了」カテゴリ実装
  - [ ] 5.1 PropertySidebarStatusに「未完了」カテゴリを追加
    - カテゴリ定義の追加（id: 'incomplete', priority: 0）
    - カウント計算ロジックの実装
    - カテゴリクリック時のフィルタリング処理
    - _要件: 6.1, 6.2, 6.3_
  
  - [ ]* 5.1.1 未完了カテゴリのカウント表示プロパティテストを作成
    - **Property 8: 未完了カテゴリのカウント表示**
    - **検証: 要件 6.2**
    - テストファイル: `frontend/frontend/src/__tests__/property-listing-incomplete-count.property.test.ts`
  
  - [ ]* 5.1.2 未完了カテゴリのフィルタリングプロパティテストを作成
    - **Property 9: 未完了カテゴリのフィルタリング**
    - **検証: 要件 6.3**
    - テストファイル: `frontend/frontend/src/__tests__/property-listing-incomplete-filter.property.test.ts`
  
  - [ ] 5.2 「未完了」カテゴリのスタイリング
    - 高優先度スタイル（最上部表示、オレンジ色）
    - _要件: 6.5_
  
  - [ ] 5.3 「未完了」カテゴリのリアルタイム更新
    - 確認フィールド変更時のカウント更新
    - _要件: 6.4_
  
  - [ ]* 5.3.1 未完了カテゴリのリアルタイム更新プロパティテストを作成
    - **Property 10: 未完了カテゴリのリアルタイム更新**
    - **検証: 要件 6.4**
    - テストファイル: `frontend/frontend/src/__tests__/property-listing-incomplete-realtime.property.test.ts`
  
  - [ ] 5.4 「未完了」カテゴリのアクセシビリティ対応
    - aria-labelの設定（カウント含む）
    - _要件: 10.4_

- [ ] 6. チェックポイント - 基本機能の動作確認
  - すべてのテストが通ることを確認
  - ヘッダーボタンのレイアウトが正しく表示されることを確認
  - 「事務へCHAT」ボタンが動作することを確認
  - 確認フィールドトグルが動作することを確認
  - サイドバーの「未完了」カテゴリが表示されることを確認
  - 質問があればユーザーに確認

- [ ] 7. エラーハンドリングとパフォーマンス最適化
  - [ ] 7.1 チャットアプリケーション起動失敗時のエラーハンドリング
    - エラーメッセージの表示
    - エラーログの記録
    - _要件: 8.1_
  
  - [ ] 7.2 確認フィールド更新失敗時のエラーハンドリング
    - エラーメッセージの表示
    - 前の値へのロールバック
    - エラーログの記録
    - _要件: 8.2_
  
  - [ ] 7.3 スプレッドシート同期失敗時のリトライ処理
    - Exponential backoffの実装（1秒 → 2秒 → 4秒）
    - 最大3回のリトライ
    - エラーログの記録
    - _要件: 8.3_
  
  - [ ] 7.4 パフォーマンス要件の検証
    - 「事務へCHAT」ボタンクリック時の応答時間（1秒以内）
    - 確認フィールド更新時のUI更新時間（500ミリ秒以内）
    - サイドバーの「未完了」カウント計算時間（200ミリ秒以内）
    - _要件: 9.1, 9.2, 9.3_
  
  - [ ]* 7.5 エラーハンドリングのユニットテストを作成
    - チャットアプリケーション起動失敗のテスト
    - 確認フィールド更新失敗のテスト
    - スプレッドシート同期失敗のテスト
    - 無効な確認値のテスト
    - テストファイル: `backend/src/__tests__/property-listing-error-handling.test.ts`

- [ ] 8. 最終チェックポイント - 統合テストと動作確認
  - すべてのテストが通ることを確認
  - 本番環境へのデプロイ前の最終確認
  - 質問があればユーザーに確認

## 注意事項

- タスクに`*`が付いているものはオプションで、スキップ可能です
- 各タスクは要件番号を参照しており、トレーサビリティを確保しています
- チェックポイントで段階的に検証を行い、問題を早期に発見します
- プロパティテストは普遍的な正確性を検証し、ユニットテストは特定の例とエッジケースを検証します
