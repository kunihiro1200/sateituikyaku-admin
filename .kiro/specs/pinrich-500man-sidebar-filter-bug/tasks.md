# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - Pinrich500万以上登録未フィルタが0件を返すバグ
  - **重要**: このテストは修正前のコードで実行し、**必ず失敗することを確認する**
  - **失敗したときにテストやコードを修正しないこと**
  - **目的**: バグが実際に存在することを反例（counterexample）で証明する
  - **スコープ限定PBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `getBuyersByStatus('pinrich500manUnregistered')` のフィルタロジック
  - バグ条件（design.mdより）:
    - `buyer.pinrich_500man_registration === undefined`（BUYER_COLUMNSに含まれていない）
    - `buyer.inquiry_property_price === undefined`（property_listingsにpriceが含まれていない）
  - テストケース:
    1. `pinrich_500man_registration` を含まない買主データでフィルタを実行 → 0件が返ることを確認
    2. `inquiry_property_price` が `undefined` の買主データでフィルタを実行 → 0件が返ることを確認
    3. 両カラムが欠落した状態（email非空、price≤500万の条件を満たすはずの買主）でフィルタを実行 → 0件が返ることを確認
  - テストアサーション（期待される動作）: email非空 AND price≤500万 AND pinrich_500man_registration未 AND reception_date≥2026-01-01 の買主が結果に含まれること
  - 未修正コードで実行 → **失敗が期待される結果**（バグの存在を証明）
  - 反例を記録する（例: `inquiry_property_price` が `undefined` → `Number(undefined) <= 5000000` が `false` → 除外される）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 他カテゴリのフィルタリング動作が変わらない
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`pinrich500manUnregistered` 以外のカテゴリ）を観察する
  - 観察例:
    - `getBuyersByStatus('todayCall')` → 未修正コードで返る件数・内容を記録
    - `getBuyersByStatus('threeCallUnchecked')` → 未修正コードで返る件数・内容を記録
    - 担当別カテゴリ（`assigned:XX`）→ 未修正コードで返る件数・内容を記録
  - 観察した動作をプロパティベーステストとして記述:
    - 任意の `pinrich500manUnregistered` 以外のステータスカテゴリに対して、`BUYER_COLUMNS` へのカラム追加前後でフィルタ結果が同一であること
    - `BUYER_COLUMNS` へのカラム追加は読み取り専用の変更であり、既存カラムの取得に影響しないこと
  - 未修正コードでテストを実行 → **合格が期待される結果**（ベースライン動作の確認）
  - テストを作成・実行し、合格を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Pinrich500万以上登録未フィルタバグの修正

  - [x] 3.1 修正を実装する
    - `backend/src/services/BuyerService.ts` の `fetchAllBuyers()` メソッドを修正
    - **変更1**: `BUYER_COLUMNS` に `pinrich_500man_registration` を追加
      ```typescript
      // 変更前
      'day_of_week', 'pinrich', 'email_confirmed', 'email_confirmation_assignee',
      // 変更後
      'day_of_week', 'pinrich', 'pinrich_500man_registration', 'email_confirmed', 'email_confirmation_assignee',
      ```
    - **変更2**: `property_listings` クエリに `price` を追加
      ```typescript
      // 変更前
      .select('property_number, atbb_status, address, sales_assignee, property_type')
      // 変更後
      .select('property_number, atbb_status, address, sales_assignee, property_type, price')
      ```
    - **変更3**: `propertyMap` の型定義と値に `price` を追加
      ```typescript
      // 型定義に price: number | null を追加
      // propertyMap[listing.property_number] = { ..., price: listing.price ?? null }
      ```
    - **変更4**: 各買主への `inquiry_property_price` 付与を追加
      ```typescript
      // 変更前: property_type: prop?.property_type ?? null,
      // 変更後: property_type: prop?.property_type ?? null,
      //         inquiry_property_price: prop?.price ?? null,
      ```
    - _Bug_Condition: isBugCondition(buyer) where buyer.pinrich_500man_registration === undefined AND buyer.inquiry_property_price === undefined_
    - _Expected_Behavior: getBuyersByStatus('pinrich500manUnregistered') が email非空 AND price≤500万 AND pinrich_500man_registration未 AND reception_date≥2026-01-01 の4条件を満たす買主のみを返す_
    - _Preservation: fetchAllBuyers() を使用する他の全カテゴリのフィルタリング動作が変わらない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

  - [x] 3.2 バグ条件の探索テストが合格することを確認する
    - **Property 1: Expected Behavior** - Pinrich500万以上登録未フィルタが正しく機能する
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしており、修正後に合格することでバグ修正を確認する
    - バグ条件の探索テストを実行する
    - **期待される結果**: テストが**合格**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 保全テストが引き続き合格することを確認する
    - **Property 2: Preservation** - 他カテゴリのフィルタリング動作が変わらない
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - 保全プロパティテストを実行する
    - **期待される結果**: テストが**合格**する（リグレッションがないことを確認）
    - 修正後も全テストが合格することを確認する

- [x] 4. チェックポイント - 全テストの合格を確認する
  - 全テスト（バグ条件テスト・保全テスト）が合格していることを確認する
  - 疑問点があればユーザーに確認する
