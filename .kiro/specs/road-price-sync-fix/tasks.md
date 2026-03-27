# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 固定資産税路線価のスプシ→DB同期欠落
  - **重要**: このテストは修正前のコードで**必ず失敗する** — 失敗がバグの存在を証明する
  - **修正前にテストを実行しても失敗しても修正しないこと**
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ限定PBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（デザインのBug Conditionより）:
    - `row['固定資産税路線価']` に値（例: `50000`）が入っているスプシ行データを用意する
    - 未修正の `syncSingleSeller` を呼び出す
    - DBの `fixed_asset_tax_road_price` が `null` のままであることを確認する（期待値: `50000`）
    - 未修正の `updateSingleSeller` を呼び出す
    - DBの `fixed_asset_tax_road_price` が変わらないことを確認する（期待値: `80000`）
  - テストを未修正コードで実行する
  - **期待される結果**: テスト失敗（バグの存在を確認）
  - 反例を記録する（例: `syncSingleSeller({固定資産税路線価: 50000, ...})` → `fixed_asset_tax_road_price = null`）
  - テストを作成・実行・失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存フィールドの同期動作維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`row['固定資産税路線価']` が存在しない行）を観察する
  - 観察内容（デザインのPreservation Requirementsより）:
    - `valuation_amount_1/2/3`（査定額）が正しく同期されることを確認
    - `status`（状況）、`next_call_date`（次電日）、`comments`（コメント）が正しく同期されることを確認
    - 暗号化フィールド（`name`, `phone_number`, `email`, `address`）の同期が変わらないことを確認
    - `column-mapping.json` の既存マッピングが変更されていないことを確認
  - プロパティベーステスト: `fixed_asset_tax_road_price` 以外のフィールドをランダムに変化させ、修正前後で同一の結果になることを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト通過（ベースライン動作を確認）
  - テストを作成・実行・通過を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 固定資産税路線価の同期バグを修正する

  - [x] 3.1 `column-mapping.json` にマッピングを追加する
    - `spreadsheetToDatabase` セクションに `"固定資産税路線価": "fixed_asset_tax_road_price"` を追加
    - `databaseToSpreadsheet` セクションに `"fixed_asset_tax_road_price": "固定資産税路線価"` を追加
    - `typeConversions` セクションに `"fixed_asset_tax_road_price": "number"` を追加
    - 既存のマッピングは一切変更・削除しない（追加のみ）
    - _Bug_Condition: isBugCondition(input) where NOT '固定資産税路線価' IN spreadsheetToDatabase.keys_
    - _Expected_Behavior: column-mapping.json に双方向マッピングが存在する_
    - _Preservation: 既存の全マッピング定義は変更なし_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 `EnhancedAutoSyncService.ts` の `syncSingleSeller` に処理を追加する
    - 査定額処理ブロックの近傍に以下を追加:
      ```typescript
      // 固定資産税路線価を追加
      const fixedAssetTaxRoadPriceNew = row['固定資産税路線価'];
      const parsedFixedAssetTaxRoadPriceNew = this.parseNumeric(fixedAssetTaxRoadPriceNew);
      if (parsedFixedAssetTaxRoadPriceNew !== null) {
        encryptedData.fixed_asset_tax_road_price = parsedFixedAssetTaxRoadPriceNew;
      }
      ```
    - `fixed_asset_tax_road_price` は `NUMERIC` 型（円/㎡）。万円→円変換は不要
    - _Bug_Condition: NOT 'fixed_asset_tax_road_price' IN syncSingleSeller.processedFields_
    - _Expected_Behavior: row['固定資産税路線価'] の値が DB に保存される_
    - _Requirements: 2.1_

  - [x] 3.3 `EnhancedAutoSyncService.ts` の `updateSingleSeller` に処理を追加する
    - 査定額処理ブロックの近傍に以下を追加:
      ```typescript
      // 固定資産税路線価を追加
      const fixedAssetTaxRoadPrice = row['固定資産税路線価'];
      const parsedFixedAssetTaxRoadPrice = this.parseNumeric(fixedAssetTaxRoadPrice);
      if (parsedFixedAssetTaxRoadPrice !== null) {
        updateData.fixed_asset_tax_road_price = parsedFixedAssetTaxRoadPrice;
      } else if (fixedAssetTaxRoadPrice === '' || fixedAssetTaxRoadPrice === null || fixedAssetTaxRoadPrice === undefined) {
        updateData.fixed_asset_tax_road_price = null;
      }
      ```
    - 空欄時は `null` でクリアする（要件 3.3 対応）
    - _Bug_Condition: NOT 'fixed_asset_tax_road_price' IN updateSingleSeller.processedFields_
    - _Expected_Behavior: row['固定資産税路線価'] の値が DB に更新・クリアされる_
    - _Preservation: 他の全フィールドの更新ロジックは変更なし_
    - _Requirements: 2.2, 3.3_

  - [x] 3.4 バグ条件の探索テストが通過することを確認する
    - **Property 1: Expected Behavior** - 固定資産税路線価のスプシ→DB同期
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが通過すれば、バグが修正されたことを確認できる
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テスト通過（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2)_

  - [x] 3.5 保全テストが引き続き通過することを確認する
    - **Property 2: Preservation** - 既存フィールドの同期動作維持
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テスト通過（リグレッションなし）
    - 修正後も全テストが通過することを確認する

- [x] 4. デプロイする
  - 全テストが通過していることを確認する
  - 以下のコマンドでデプロイまで実施する:
    ```bash
    git add .
    git commit -m "fix: 固定資産税路線価フィールドのスプレッドシート同期を追加"
    git push origin main
    ```
  - 疑問点があればユーザーに確認する
