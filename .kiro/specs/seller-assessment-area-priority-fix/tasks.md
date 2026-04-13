# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 「当社調べ」フィールド優先使用バグ
  - **重要**: このテストは修正前のコードで必ず**失敗**する — 失敗がバグの存在を証明する
  - **修正前にテストが失敗しても、テストやコードを修正しないこと**
  - **注意**: このテストは期待される動作をエンコードしており、実装後にパスすることでバグ修正を検証する
  - **目標**: バグが存在することを示すカウンター例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - ケース1: `seller.property = null`, `landAreaVerified = 165.3`, `landArea = 150.0`, `buildingAreaVerified = null` → `landAreaVerified` が使われることを確認（修正前は失敗）
    - ケース2: `seller.property = null`, `buildingAreaVerified = 99.2`, `buildingArea = 90.0`, `landAreaVerified = null` → `buildingAreaVerified` が使われることを確認（修正前は失敗）
    - ケース3: `seller.property = null`, `landAreaVerified = 165.3`, `buildingAreaVerified = 99.2` → 両方が使われることを確認（修正前は失敗）
    - ケース4（AA13965相当）: `landAreaVerified = 165.3`, `buildingAreaVerified = 99.2`, `landArea = 150.0`, `buildingArea = 90.0` → 「当社調べ」値で計算されることを確認
  - テストアサーション: `calculateValuationAmount1` に渡される `PropertyInfo` に `landAreaVerified` / `buildingAreaVerified` が含まれていることを確認
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**失敗**する（これが正しい — バグの存在を証明する）
  - 発見したカウンター例を記録して根本原因を理解する
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 「当社調べ」フィールドがない場合の動作保持
  - **重要**: 観察優先メソドロジーに従う
  - 修正前のコードで、バグ条件に該当しない入力（`landAreaVerified = null`, `buildingAreaVerified = null`）の動作を観察する
  - 観察: `seller.property = null`, `landAreaVerified = null`, `buildingAreaVerified = null`, `landArea = 150.0`, `buildingArea = 90.0` の場合、通常フィールドで計算される
  - 観察: `seller.property` が存在する場合、フォールバック処理を通らないため影響なし
  - プロパティベーステスト: 「当社調べ」フィールドが両方nullの場合、修正前後で同じ査定額が返されることを検証
  - プロパティベーステスト: ランダムな `landArea` / `buildingArea` の値を生成し、「当社調べ」フィールドがnullの場合に通常フィールドが使われることを検証
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**パス**する（これが正しい — 保持すべきベースライン動作を確認する）
  - テストを作成し、実行し、修正前コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2_

- [x] 3. 「当社調べ」フィールド優先度バグの修正

  - [x] 3.1 修正を実装する
    - `backend/src/routes/valuations.ts` の `calculate-valuation-amount1` エンドポイントを修正する
    - `seller.property` がnullの場合のフォールバック処理（約140行目）に `landAreaVerified` と `buildingAreaVerified` を追加する
    - 修正前: `PropertyInfo` に `landAreaVerified` / `buildingAreaVerified` が含まれていない
    - 修正後: `landAreaVerified: (seller as any).landAreaVerified || undefined` を追加
    - 修正後: `buildingAreaVerified: (seller as any).buildingAreaVerified || undefined` を追加
    - `ValuationCalculatorService.calculateValuationAmount1` 内の優先順位ロジック（`buildingAreaVerified || buildingArea`）は変更不要
    - _Bug_Condition: isBugCondition(seller) — seller.property IS NULL AND (seller.landAreaVerified IS NOT NULL OR seller.buildingAreaVerified IS NOT NULL)_
    - _Expected_Behavior: PropertyInfo に landAreaVerified / buildingAreaVerified が含まれ、calculateValuationAmount1 が「当社調べ」値を優先して計算する_
    - _Preservation: 「当社調べ」フィールドが両方nullの場合、通常の landArea / buildingArea を使った計算は変わらない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

  - [x] 3.2 バグ条件探索テストが今度はパスすることを確認する
    - **Property 1: Expected Behavior** - 「当社調べ」フィールド優先使用
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**パス**する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保持テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 「当社調べ」フィールドがない場合の動作保持
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テストが**パス**する（リグレッションがないことを確認する）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストのパスを確認する
  - 全テストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。
