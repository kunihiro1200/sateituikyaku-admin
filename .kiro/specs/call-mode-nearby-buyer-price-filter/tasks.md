# 実装計画: 近隣買主リスト 価格帯フィルター機能

## 概要

`NearbyBuyersList.tsx` にクライアントサイドの価格帯フィルター機能を追加する。
バックエンド変更は不要。既存の `buyers` 配列を `inquiry_price` でフィルタリングする。

## タスク

- [x] 1. 価格帯定数・フィルタリング関数の実装
  - `PRICE_RANGES` 定数（9段階）をコンポーネント外に定義する
  - `isInPriceRange(price, min, max)` 関数を実装する（`null` / `undefined` は `false` を返す）
  - `togglePriceRange(prev, key)` 純粋関数を実装する（テスト容易性のため）
  - `filterBuyersByPrice(buyers, selectedSet)` 純粋関数を実装する（テスト容易性のため）
  - _要件: 1.2, 3.1, 3.2, 3.3_

  - [ ]* 1.1 `isInPriceRange` のプロパティテストを作成する
    - **Property 2: フィルタリングの完全性（包含と排除）**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - fast-check を使用し、任意の `inquiry_price` と任意の `selectedPriceRanges` に対して包含・排除が正確であることを検証する

  - [ ]* 1.2 `togglePriceRange` のプロパティテストを作成する
    - **Property 3: 価格帯トグルのラウンドトリップ**
    - **Validates: Requirements 2.1, 2.2**
    - 任意のキーに対して2回トグルすると元の状態に戻ることを検証する

- [x] 2. state・`useMemo` の追加とソートとの統合
  - `selectedPriceRanges` state（`Set<string>`）を追加する
  - `filteredBuyers` を `React.useMemo` で計算する（`filterBuyersByPrice` を使用）
  - 既存の `sortedBuyers` の依存を `buyers` から `filteredBuyers` に変更する
  - 件数表示（「N件の買主が見つかりました」）を `filteredBuyers.length` に変更する
  - _要件: 2.4, 3.4, 3.5_

  - [ ]* 2.1 フィルター未選択時の全件表示プロパティテストを作成する
    - **Property 1: フィルター未選択時は全件表示**
    - **Validates: Requirements 2.4**
    - `selectedPriceRanges` が空のとき `filteredBuyers` が `buyers` と同一であることを検証する

  - [ ]* 2.2 フィルターとソートの独立性プロパティテストを作成する
    - **Property 4: フィルターとソートの独立性**
    - **Validates: Requirements 3.4**
    - フィルター後にソートした結果と、ソート後にフィルターした結果が同じ要素集合を持つことを検証する

- [x] 3. 価格帯フィルターボタン行のUI実装
  - `handlePriceRangeToggle` ハンドラーを実装する
  - アクションボタン行の直下に `Box` + `Button` のフィルターボタン行を追加する
  - 未選択: `variant="outlined"`、選択済み: `variant="contained"` で表示する
  - `size="small"` / `color="primary"` を適用する
  - _要件: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

  - [ ]* 3.1 件数表示の正確性プロパティテストを作成する
    - **Property 5: 件数表示の正確性**
    - **Validates: Requirements 3.5**
    - 任意のフィルター設定に対して表示件数が `filteredBuyers.length` と等しいことを検証する

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- プロパティテストには fast-check（TypeScript向け）を使用する
- バックエンドへの変更は一切不要
