# Implementation Plan

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 物件番号登録時のCH〜CN列未反映バグ
  - **CRITICAL**: このテストは未修正コードで FAIL すること — FAIL がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグの存在を示すカウンターエグザンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `BuyerService.updateWithSync()` の `property_listings` クエリの `select()` に `pre_viewing_notes` 等7フィールドが含まれないことを静的解析で確認する（Bug Condition: `X.property_number != null AND X.property_number != ''`）
  - `allowedData` に7フィールドが追加されないことを確認する（期待動作: `allowedData.pre_viewing_notes = propertyListing.pre_viewing_notes ?? null` 等が存在すること）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト FAIL（バグの存在を証明）
  - カウンターエグザンプルを記録する（例: `select()` クエリに `pre_viewing_notes` が存在しない）
  - テストを作成・実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 物件番号を含まない更新の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで `property_number` を含まない更新リクエストを実行し、`allowedData` の内容を観察する
  - 観察: `property_number` が null の場合、`allowedData` に `pre_viewing_notes` 等CH〜CN列フィールドが追加されないことを確認
  - 観察: 既存同期フィールド（`property_address`, `display_address`, `price`, `property_assignee`）は `property_number` が存在する場合のみ設定されることを確認
  - プロパティベーステスト: `isBugCondition(X)` が false（`property_number` が null または空文字）の全入力に対して、`allowedData` にCH〜CN列フィールドが追加されないことを検証する
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASS（保全すべきベースライン動作を確認）
  - テストを作成・実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. CH〜CN列未反映バグの修正

  - [x] 3.1 `BuyerService.updateWithSync()` を修正する
    - `backend/src/services/BuyerService.ts` の `updateWithSync()` メソッドを修正する
    - `property_listings` の `select()` クエリに7フィールドを追加:
      `pre_viewing_notes, key_info, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking`
    - `allowedData` への7フィールド追加:
      ```typescript
      allowedData.pre_viewing_notes = propertyListing.pre_viewing_notes ?? null;
      allowedData.key_info = propertyListing.key_info ?? null;
      allowedData.sale_reason = propertyListing.sale_reason ?? null;
      allowedData.price_reduction_history = propertyListing.price_reduction_history ?? null;
      allowedData.viewing_notes = propertyListing.viewing_notes ?? null;
      allowedData.parking = propertyListing.parking ?? null;
      allowedData.viewing_parking = propertyListing.viewing_parking ?? null;
      ```
    - `buyer-column-mapping.json` のマッピングは既に修正済みのため変更不要
    - _Bug_Condition: `X.property_number != null AND X.property_number != ''`_
    - _Expected_Behavior: `allowedData` に7フィールドが追加され、`databaseToSpreadsheet` マッピング経由でCH〜CN列に反映される_
    - _Preservation: `property_number` を含まない更新では `allowedData` にCH〜CN列フィールドが追加されない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 物件番号登録時のCH〜CN列即時同期
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 物件番号を含まない更新の動作保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASS（リグレッションなしを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. Vercelへデプロイする
  - `sateituikyaku-admin-backend` プロジェクトにデプロイする
  - デプロイ後、実際の買主リストで物件番号を登録し、スプレッドシートのCH〜CN列に値が反映されることを確認する
  - 既存の同期フィールド（物件所在地・住居表示・価格・物件担当者）も引き続き正常に反映されることを確認する

- [x] 5. チェックポイント — 全テスト PASS を確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
