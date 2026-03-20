# 実装計画

- [x] 1. バグ条件探索テストの作成
  - **Property 1: Bug Condition** - 無効な環境変数・0件・50%未満での誤削除バグ
  - **CRITICAL**: このテストは修正前のコードで**FAIL**することが期待される — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にパスすることでバグ修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テストファイル: `backend/src/services/__tests__/buyer-accidental-deletion-fix.exploration.test.ts`
  - テストケース1（フォールバック発動）: `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` を空文字列に設定して `initializeBuyer()` を呼び出す → 修正前は `PROPERTY_LISTING_SPREADSHEET_ID` にフォールバックして処理が続行される（エラーをスローしない）
  - テストケース2（0件削除）: スプレッドシートから0件を返すモックで `detectDeletedBuyers()` を呼び出す → 修正前はDB上の全アクティブ買主が削除対象として返される
  - テストケース3（50%未満削除）: DBに100件・スプレッドシートに40件のシナリオで `detectDeletedBuyers()` を呼び出す → 修正前は60件が削除対象として返される
  - テストケース4（10%超過削除）: DBに100件・削除対象15件のシナリオで `syncBuyers()` を呼び出す → 修正前は15件が削除される
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが**FAIL**する（これが正しい — バグの存在を証明する）
  - 発見されたカウンターサンプルを記録して根本原因を理解する
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 保持プロパティテストの作成（修正前に実施）
  - **Property 2: Preservation** - 正常ケースでの買主同期動作の保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - テストファイル: `backend/src/services/__tests__/buyer-accidental-deletion-fix.preservation.test.ts`
  - 観察1: スプレッドシート比率80%・削除対象5%のシナリオで `syncBuyers()` が削除同期を正常実行することを確認
  - 観察2: `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が正しく設定されている場合、`initializeBuyer()` が正常に初期化することを確認
  - 観察3: 削除比率9.9%（スキップしない）と10.0%（スキップする）の境界値を確認
  - プロパティベーステスト: ランダムな買主数（1〜1000件）とスプレッドシート比率（50%以上）を生成し、削除対象10%未満の場合は削除同期が実行されることを確認
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが**PASS**する（これが正しい — 保持すべきベースライン動作を確認する）
  - 修正前のコードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. buyer-accidental-deletion-fix の修正

  - [x] 3.1 `initializeBuyer()` のフォールバックロジック削除と `.trim()` 追加
    - `backend/src/services/EnhancedAutoSyncService.ts` を修正
    - `process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim()` で末尾の不正な文字（`\r\n` など）を除去
    - 空文字列・未設定の場合は `Error` をスローしてフォールバックを完全に排除
    - `|| process.env.PROPERTY_LISTING_SPREADSHEET_ID!` のフォールバック部分を削除
    - _Bug_Condition: isBugCondition(input) where input.buyerSpreadsheetId が空または末尾に不正な文字を含む_
    - _Expected_Behavior: エラーをスローして処理を中断し、PROPERTY_LISTING_SPREADSHEET_ID へのフォールバックを行わない_
    - _Preservation: GOOGLE_SHEETS_BUYER_SPREADSHEET_ID が正しく設定されている場合は修正前と同じ初期化処理を実行_
    - _Requirements: 2.1, 3.2_

  - [x] 3.2 `detectDeletedBuyers()` に安全ガード1・2を追加
    - `backend/src/services/EnhancedAutoSyncService.ts` を修正
    - 安全ガード1: `sheetBuyerNumbers.size === 0` の場合は空配列を返して警告ログを出力
    - 安全ガード2: スプレッドシートの買主数がDBの50%未満の場合は空配列を返して異常検知アラートを出力
    - _Bug_Condition: isBugCondition(input) where input.sheetBuyerCount === 0 OR input.sheetBuyerCount / input.dbActiveBuyerCount < 0.5_
    - _Expected_Behavior: 削除処理をスキップして空配列を返し、警告/アラートログを出力_
    - _Preservation: スプレッドシート比率50%以上の場合は修正前と同じ削除対象リストを返す_
    - _Requirements: 2.2, 2.3, 3.1, 3.3_

  - [x] 3.3 `syncBuyers()` に安全ガード3を追加
    - `backend/src/services/EnhancedAutoSyncService.ts` を修正
    - 安全ガード3: 削除対象がアクティブ買主数の10%以上の場合は削除処理をスキップして管理者向けアラートを出力
    - 削除処理をスキップした場合は `deletionSyncResult` を `null` のままにする
    - _Bug_Condition: isBugCondition(input) where deletedBuyers.length / activeBuyerCount >= 0.1_
    - _Expected_Behavior: 削除処理をスキップして管理者向けアラートを出力_
    - _Preservation: 削除比率10%未満の場合は修正前と同じ削除同期処理を実行_
    - _Requirements: 2.4, 3.1, 3.3_

  - [x] 3.4 誤削除された買主の一括復元スクリプト作成
    - `backend/restore-accidentally-deleted-buyers.ts` を新規作成
    - スプレッドシートに存在するが `deleted_at` が設定されている買主を検出する
    - `recoverDeletedBuyer()` を使用して `deleted_at` を NULL に戻す
    - 復元対象の買主番号リストをログ出力する
    - 実行前に確認プロンプトを表示する（誤実行防止）
    - _Requirements: 2.5_

  - [x] 3.5 バグ条件探索テストが修正後にパスすることを確認
    - **Property 1: Expected Behavior** - 無効な環境変数・0件・50%未満での処理中断
    - **IMPORTANT**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - タスク1の探索テストを実行する
    - **EXPECTED OUTCOME**: テストが**PASS**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 保持テストが修正後もパスすることを確認
    - **Property 2: Preservation** - 正常ケースでの買主同期動作の保持
    - **IMPORTANT**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - タスク2の保持テストを実行する
    - **EXPECTED OUTCOME**: テストが**PASS**する（リグレッションがないことを確認）
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. チェックポイント — 全テストのパスを確認
  - 全テストが通過していることを確認する
  - 探索テスト（タスク1）: PASS（修正後）
  - 保持テスト（タスク2）: PASS（修正前後ともに）
  - 疑問点があればユーザーに確認する
