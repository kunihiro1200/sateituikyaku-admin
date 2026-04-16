# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 路線価nullで査定額1が著しく低い値になるバグ
  - **CRITICAL**: このテストは修正前のコードで必ずFAILすること — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `fixedAssetTaxRoadPrice = null` かつ `landArea = 220` かつ `buildingArea = 100` かつ木造1983年築
  - `ValuationCalculatorService.calculateValuationAmount1()` に `fixedAssetTaxRoadPrice = null` の売主データを渡す
  - テストアサーション: 返り値が `¥1,200,000` ではなく `¥13,800,000` 相当であること（Bug Conditionの期待動作）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストがFAILする（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録する（例: `calculateValuationAmount1({fixedAssetTaxRoadPrice: null, landArea: 220, ...})` が `¥1,200,000` を返す）
  - タスク完了条件: テストが作成され、実行され、FAILが記録されたとき
  - _Requirements: 1.1_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 路線価0または土地面積0の場合の既存動作維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`fixedAssetTaxRoadPrice > 0` または `landArea = 0`）の動作を観察する
  - 観察: `calculateValuationAmount1({fixedAssetTaxRoadPrice: 0, landArea: 220, ...})` → 土地価格=0で計算される
  - 観察: `calculateValuationAmount1({fixedAssetTaxRoadPrice: 21700, landArea: 0, ...})` → 土地価格=0で計算される
  - 観察: 木造築33年以上の場合、建物価格が基準価格の10%になる
  - 観察: 査定額1が1,000万円未満の場合、査定額2に+200万円、査定額3に+400万円が加算される
  - プロパティベーステスト: 任意の `fixedAssetTaxRoadPrice = 0` または `landArea = 0` に対して、土地価格が0になること（Preservation Requirementsより）
  - プロパティベーステスト: 任意の建物情報（築年、構造、面積）に対して、建物価格計算が変わらないこと
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストがPASSする（これが保全すべきベースライン動作を確認する）
  - タスク完了条件: テストが作成され、実行され、修正前コードでPASSが確認されたとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 査定額自動計算バグの修正

  - [x] 3.1 フロントエンド修正: `autoCalculateValuations` に `fixedAssetTaxRoadPrice` を追加
    - `frontend/frontend/src/pages/CallModePage.tsx` の `autoCalculateValuations` 関数を修正
    - `calculate-valuation-amount1` のリクエストボディに `fixedAssetTaxRoadPrice: parseFloat(roadPrice)` を追加
    - DBへの保存と計算の間の競合状態を排除する
    - _Bug_Condition: isBugCondition(input) where input.fixedAssetTaxRoadPrice IS NULL (DBに保存前に計算が実行される場合)_
    - _Expected_Behavior: fixedAssetTaxRoadPriceがリクエストボディで渡され、土地価格が正しく計算される_
    - _Preservation: fixedAssetTaxRoadPrice > 0 の場合の既存の計算結果は変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 バックエンド修正: `calculate-valuation-amount1` エンドポイントにバリデーション追加
    - `backend/src/routes/valuations.ts` の `POST /:sellerId/calculate-valuation-amount1` を修正
    - `effectiveRoadPrice = fixedAssetTaxRoadPrice ?? seller.fixedAssetTaxRoadPrice` でリクエストボディの値を優先
    - `effectiveRoadPrice` が null または 0 以下の場合、400エラーを返す
    - エラーメッセージ: `固定資産税路線価が設定されていません。路線価を入力してから査定額を計算してください。`
    - `seller.fixedAssetTaxRoadPrice = effectiveRoadPrice` で有効な路線価をセットしてから計算を実行
    - _Bug_Condition: isBugCondition(input) where seller.fixedAssetTaxRoadPrice IS NULL AND req.body.fixedAssetTaxRoadPrice IS NULL_
    - _Expected_Behavior: 路線価が有効な場合のみ計算を実行し、無効な場合は明確なエラーを返す_
    - _Preservation: fixedAssetTaxRoadPrice > 0 の場合の既存の計算フローは変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.3 バックエンド修正: `ValuationCalculatorService` に警告ログを追加
    - `backend/src/services/ValuationCalculatorService.ts` の `calculateValuationAmount1` を修正
    - `fixedAssetTaxRoadPrice === 0` の場合に `console.warn` でデバッグログを出力
    - 既存の計算ロジックは変更しない（デバッグ用のログ追加のみ）
    - _Requirements: 2.3_

  - [x] 3.4 バグ条件の探索テストが修正後にPASSすることを確認
    - **Property 1: Expected Behavior** - 路線価が正しく計算に反映される
    - **IMPORTANT**: タスク1で作成したテストをそのまま再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすることで、期待される動作が満たされていることを確認する
    - バグ条件の探索テスト（タスク1）を実行する
    - **EXPECTED OUTCOME**: テストがPASSする（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 保全テストが修正後もPASSすることを確認
    - **Property 2: Preservation** - 路線価0または土地面積0の場合の既存動作維持
    - **IMPORTANT**: タスク2で作成したテストをそのまま再実行する — 新しいテストを書かない
    - 保全プロパティテスト（タスク2）を実行する
    - **EXPECTED OUTCOME**: テストがPASSする（リグレッションがないことを確認）
    - 修正後も全ての保全テストがPASSすることを確認する

- [x] 4. チェックポイント — 全テストのPASSを確認
  - 全テスト（バグ条件テスト・保全テスト）がPASSすることを確認する
  - 疑問点があればユーザーに確認する
