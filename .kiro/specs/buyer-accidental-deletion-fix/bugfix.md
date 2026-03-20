# バグ修正要件ドキュメント

## はじめに

自動同期処理（`EnhancedAutoSyncService.syncBuyers()`）が、スプレッドシートに存在する買主を誤って削除（ソフトデリート）してしまうバグ。

根本原因は2つある：

1. `initializeBuyer()` に危険なフォールバックロジックが存在し、`GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が無効な場合に `PROPERTY_LISTING_SPREADSHEET_ID`（業務リスト）を使用してしまう
2. `.env.local` の `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` に末尾 `\r\n` が含まれており、Google Sheets API 認証が失敗する

この2つが組み合わさることで、業務リストスプレッドシートを買主リストとして読み込み、「買主番号」列が存在しないため買主数が0件と判定され、DB上の全アクティブ買主が誤削除される。

確認済みの被害として、買主6935が `deleted_at = 2026-02-08` でソフトデリートされており、他にも複数の買主が誤削除されている可能性がある。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` 環境変数に末尾 `\r\n` などの不正な文字が含まれている THEN システムは Google Sheets API 認証に失敗し、`PROPERTY_LISTING_SPREADSHEET_ID`（業務リスト）にフォールバックする

1.2 WHEN `initializeBuyer()` が業務リストスプレッドシートを使用して初期化される THEN システムは買主番号列が存在しないスプレッドシートを買主リストとして扱い、スプレッドシート上の買主数を0件と判定する

1.3 WHEN `detectDeletedBuyers()` がスプレッドシートから0件の買主番号を取得する THEN システムはDB上の全アクティブ買主を「スプレッドシートに存在しない = 削除された」と誤判定する

1.4 WHEN `syncDeletedBuyers()` が大量の削除対象を受け取る THEN システムはDB上の全アクティブ買主に `deleted_at` を設定してソフトデリートする

1.5 WHEN スプレッドシートから取得した買主番号がDB上のアクティブ買主数の50%未満である THEN システムは安全チェックなしに削除処理を続行する

### 期待される動作（正常）

2.1 WHEN `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が未設定または無効な値の場合 THEN システムは SHALL エラーをスローして処理を中断し、`PROPERTY_LISTING_SPREADSHEET_ID` へのフォールバックを行わない

2.2 WHEN `detectDeletedBuyers()` がスプレッドシートから取得した買主番号が0件の場合 THEN システムは SHALL 削除処理をスキップして警告ログを出力する

2.3 WHEN スプレッドシートから取得した買主番号がDB上のアクティブ買主数の50%未満の場合 THEN システムは SHALL 削除処理をスキップして異常検知アラートを出力する

2.4 WHEN `syncBuyers()` が検出した削除対象がアクティブ買主数の10%以上の場合 THEN システムは SHALL 削除処理をスキップして管理者向けアラートを出力する

2.5 WHEN 誤削除された買主（`deleted_at` が設定されているがスプレッドシートに存在する買主）が検出される THEN システムは SHALL 一括復元スクリプトによって `deleted_at` を NULL に戻して復元できる

### 変更されない動作（リグレッション防止）

3.1 WHEN スプレッドシートから正常に買主番号が取得でき、かつ削除対象がアクティブ買主数の10%未満の場合 THEN システムは SHALL CONTINUE TO 通常の削除同期処理を実行する

3.2 WHEN `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が正しく設定されている場合 THEN システムは SHALL CONTINUE TO 買主スプレッドシートを正常に初期化して同期処理を実行する

3.3 WHEN スプレッドシートに存在しない買主がDBに存在し、削除対象が安全閾値以内の場合 THEN システムは SHALL CONTINUE TO その買主をソフトデリートする

3.4 WHEN 新規買主がスプレッドシートに追加された場合 THEN システムは SHALL CONTINUE TO その買主をDBに追加する同期処理を実行する

3.5 WHEN 既存買主のデータがスプレッドシートで更新された場合 THEN システムは SHALL CONTINUE TO その買主のDBデータを更新する同期処理を実行する
