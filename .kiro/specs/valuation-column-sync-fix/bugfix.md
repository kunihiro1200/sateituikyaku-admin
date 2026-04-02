# Bugfix Requirements Document

## Introduction

通話モードページにおいて、DBの査定額1、2、3がスプレッドシートの間違った列（CB、CC、CD列：手動入力用）と同期されている問題を修正します。本来は**BC、BD、BE列（自動計算用）**と同期されるべきです。

この問題により、通話モードページで表示される査定額が、スプレッドシートの自動計算値ではなく手動入力値（または空欄）になっており、ユーザーが正しい査定額を確認できない状態になっています。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `EnhancedAutoSyncService.ts`がスプレッドシートからデータを同期する際 THEN システムは査定額1/2/3をCB/CC/CD列（手動入力用、列79-81）から取得する

1.2 WHEN `column-mapping.json`の`databaseToSpreadsheet`マッピングが参照される際 THEN システムは`valuation_amount_1/2/3`を「査定額1/2/3」（CB/CC/CD列）にマッピングする

1.3 WHEN 通話モードページでDBから査定額を取得する際 THEN システムはCB/CC/CD列から同期された値（手動入力値または空欄）を返す

### Expected Behavior (Correct)

2.1 WHEN `EnhancedAutoSyncService.ts`がスプレッドシートからデータを同期する際 THEN システムは査定額1/2/3を**BC/BD/BE列（自動計算用、列54-56）**から取得する

2.2 WHEN `column-mapping.json`の`databaseToSpreadsheet`マッピングが参照される際 THEN システムは`valuation_amount_1/2/3`を「査定額1（自動計算）v/査定額2（自動計算）v/査定額3（自動計算）v」（BC/BD/BE列）にマッピングする

2.3 WHEN 通話モードページでDBから査定額を取得する際 THEN システムはBC/BD/BE列から同期された値（自動計算値）を返す

2.4 WHEN `seller-spreadsheet-column-mapping.md`ステアリングドキュメントが参照される際 THEN システムは正しい列位置（BC/BD/BE = 列54-56）を記載する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 査定額以外のフィールド（名前、電話番号、物件住所等）を同期する際 THEN システムは既存のマッピングを使用して正しく同期を継続する

3.2 WHEN 手動入力査定額（CB/CC/CD列）が存在する場合の優先順位ロジック THEN システムは「手動入力優先、なければ自動計算」のロジックを維持する

3.3 WHEN 査定額の単位変換（万円→円）を実行する際 THEN システムは既存の変換ロジック（×10,000）を維持する

3.4 WHEN スプレッドシートの取得範囲を指定する際 THEN システムは`B:CZ`の範囲を維持する（CB/CC/CD列を含む）
