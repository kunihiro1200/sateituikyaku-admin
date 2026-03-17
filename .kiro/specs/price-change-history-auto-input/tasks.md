# 実装計画：物件価格変更時の値下げ履歴自動入力

## 概要

`PropertyListingDetailPage.tsx` の `handleSavePrice` 関数に、売買価格変更時の値下げ履歴自動追記ロジックを追加する。実装はフロントエンドのみで完結し、バックエンドの変更は不要。

## タスク

- [x] 1. 純粋関数の抽出とテストファイルの作成
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` から以下の純粋関数を抽出してエクスポートする
    - `toMan(price: number): number` — 円単位を万円単位（切り捨て）に変換
    - `generatePriceHistoryEntry(oldPrice, newPrice, initials, dateStr): string` — 履歴エントリ文字列を生成
    - `buildUpdatedHistory(oldPrice, newPrice, initials, existingHistory, dateStr): string` — 先頭追記後の履歴全体を返す
  - テストファイル `frontend/frontend/src/__tests__/priceHistoryUtils.test.ts` を作成する
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 3.1, 3.2, 3.3_

  - [x] 1.1 ユニットテストを実装する
    - 基本ケース: `18,500,000円 → 13,500,000円` で `K3/17　1850万→1350万` が生成される
    - 既存履歴あり: 先頭に新エントリが追加され、既存履歴が後続に保持される
    - 価格未変更: `oldPrice === newPrice` の場合、履歴が変化しない
    - null → 有価格: 変更前が `null` の場合、`0万` として記録される（要件1.6）
    - 有価格 → null: 変更後が `null` の場合、追記しない（要件1.7）
    - イニシャルなし: `initials` が空文字の場合、`3/17　1850万→1350万` になる（要件1.4）
    - 9,999円以下: 変換後が `0万` になる（要件3.2）
    - _Requirements: 1.2, 1.4, 1.5, 1.6, 1.7, 3.1, 3.2, 3.3_

  - [ ]* 1.2 プロパティテストを実装する（Property 1: 価格変更時のみ履歴エントリが先頭に追加される）
    - **Property 1: 価格変更時のみ履歴エントリが先頭に追加される**
    - **Validates: Requirements 1.1, 1.3, 1.5, 2.2, 5.1, 5.3**
    - fast-check を使用、`numRuns: 100`
    - `// Feature: price-change-history-auto-input, Property 1: 価格変更時のみ履歴エントリが先頭に追加される` タグコメントを付与

  - [ ]* 1.3 プロパティテストを実装する（Property 2: 生成される履歴エントリのフォーマットが正しい）
    - **Property 2: 生成される履歴エントリのフォーマットが正しい**
    - **Validates: Requirements 1.2, 1.4, 4.2**
    - fast-check を使用、`numRuns: 100`
    - 正規表現 `/^\S*\d+\/\d+　\d+万→\d+万$/` にマッチすることを検証
    - `// Feature: price-change-history-auto-input, Property 2: 生成される履歴エントリのフォーマットが正しい` タグコメントを付与

  - [ ]* 1.4 プロパティテストを実装する（Property 3: 万円変換は常に切り捨て整数）
    - **Property 3: 万円変換は常に切り捨て整数**
    - **Validates: Requirements 3.1, 3.3**
    - fast-check を使用、`numRuns: 100`
    - `toMan(price) === Math.floor(price / 10000)` かつ整数であることを検証
    - `// Feature: price-change-history-auto-input, Property 3: 万円変換は常に切り捨て整数` タグコメントを付与

- [x] 2. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 3. `PropertyListingDetailPage.tsx` に自動追記ロジックを組み込む
  - `useAuthStore` のインポートを追加する
  - `const { employee } = useAuthStore()` を追加する
  - `handleSavePrice` 関数内で、API呼び出し前に以下を実装する
    - `editedData.sales_price` と `propertyData?.sales_price` を比較して価格変更を検出
    - 変更がある場合、`buildUpdatedHistory` を呼び出して `editedData.price_reduction_history` を更新
    - 変更後が `null` の場合は追記しない（要件1.7）
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 5.2_

- [x] 4. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- タスク `*` はオプションであり、スキップ可能（MVP優先の場合）
- 各タスクは要件の特定の箇所を参照しており、トレーサビリティを確保している
- プロパティテストは `fast-check` を使用（`frontend/frontend` ディレクトリで `npm install fast-check --save-dev` が必要な場合がある）
- ファイルエンコーディングは UTF-8 を維持すること
- `backend/api/` は絶対に触らないこと
