# タスクリスト

## 実装タスク

- [x] 1. column-mapping.jsonにBY列「郵送」マッピングを追加
  - [x] 1.1 `spreadsheetToDatabase`に `"郵送": "mailing_status"` を追加
  - [x] 1.2 `databaseToSpreadsheet`に `"mailing_status": "郵送"` を追加

- [x] 2. EnhancedAutoSyncServiceにmailing_status同期処理を追加
  - [x] 2.1 `detectUpdatedSellers`のSELECTクエリに`mailing_status`を追加
  - [x] 2.2 `detectUpdatedSellers`の比較ロジックにmailing_statusの比較を追加（スプレッドシートが空欄の場合は同期対象外）
  - [x] 2.3 `updateSingleSeller`メソッドにmailing_statusの更新処理を追加
  - [x] 2.4 `syncSingleSeller`メソッドにmailing_statusの設定処理を追加

- [x] 3. CallModePageに郵送フィールドUIを追加
  - [x] 3.1 `mailingStatus`と`savingMailingStatus`の状態変数を追加
  - [x] 3.2 売主データロード時の`mailingStatus`初期化処理を追加（seller.mailingStatus || (valuationMethod === '郵送' ? '未' : '')）
  - [x] 3.3 `handleMailingStatusChange`ハンドラー関数を追加（PATCH /api/sellers/:id を呼び出し）
  - [x] 3.4 査定方法変更ハンドラーに「郵送」選択時のデフォルト「未」設定ロジックを追加
  - [x] 3.5 査定計算セクション内に郵送フィールドUI（「未」/「済」ボタン）を追加（editedValuationMethod === '郵送'の場合のみ表示）
  - [x] 3.6 郵送フィールドに査定方法変更日時の表示を追加

- [x] 4. 動作確認
  - [x] 4.1 査定方法を「郵送」に変更した際に郵送フィールドが表示されることを確認
  - [x] 4.2 査定方法を「郵送」以外に変更した際に郵送フィールドが非表示になることを確認
  - [x] 4.3 「未」/「済」ボタンのクリックでDBが更新されることを確認
  - [x] 4.4 mailing_statusが「未」の売主がサイドバーのmailingPendingカテゴリーにカウントされることを確認
  - [x] 4.5 column-mapping.jsonの変更後、DB→スプレッドシート同期でBY列「郵送」に値が書き込まれることを確認
