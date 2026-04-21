# 実装計画: 近隣買主テーブルへの法人名列追加

## 概要

`BuyerService.getBuyersByAreas` の `.select()` に `corporate_name` を追加し、`NearbyBuyersList` コンポーネントのインターフェースとテーブル表示を更新する。変更対象は2ファイルのみで、データベーススキーマの変更は不要。

## タスク

- [x] 1. バックエンド: BuyerService に corporate_name を追加
  - [x] 1.1 `backend/src/services/BuyerService.ts` の `getBuyersByAreas` メソッドの `.select()` ブロックに `corporate_name` を追加する
    - 既存フィールド一覧の末尾（`viewing_result_follow_up` の後）に `corporate_name` を追記
    - _Requirements: 2.1, 2.2_
  - [x] 1.2 同メソッド末尾の `return sortedBuyers.map(buyer => ({ ... }))` に `corporate_name: buyer.corporate_name ?? null` を追加する
    - _Requirements: 2.2, 2.3_
  - [ ]* 1.3 Property 2 のプロパティテストを作成する: getBuyersByAreas の戻り値に corporate_name が含まれる
    - **Property 2: getBuyersByAreas の戻り値に corporate_name が含まれる**
    - **Validates: Requirements 2.2, 2.3**
    - 任意のエリア番号リストに対して戻り値の全オブジェクトに `corporate_name` フィールドが含まれることを検証
    - `fast-check` を使用、最小100回イテレーション

- [x] 2. チェックポイント - バックエンド変更の確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. フロントエンド: NearbyBuyer インターフェースに corporate_name を追加
  - [x] 3.1 `frontend/frontend/src/components/NearbyBuyersList.tsx` の `NearbyBuyer` インターフェースに `corporate_name?: string | null` フィールドを追加する
    - _Requirements: 1.1_
  - [ ]* 3.2 Property 1 のプロパティテストを作成する: APIレスポンスの全買主オブジェクトに corporate_name が含まれる
    - **Property 1: APIレスポンスの全買主オブジェクトに corporate_name が含まれる**
    - **Validates: Requirements 1.2, 1.3**
    - 任意の売主IDに対してレスポンスの `buyers` 配列の全オブジェクトに `corporate_name` フィールドが含まれることを検証

- [x] 4. フロントエンド: テーブルに法人名列を追加
  - [x] 4.1 `NearbyBuyersList.tsx` のテーブルヘッダーで「名前」列の直後に `<TableCell>法人名</TableCell>` を追加する
    - _Requirements: 3.1, 3.4_
  - [x] 4.2 テーブル行の「名前」セルの直後に `<TableCell>{buyer.corporate_name || '-'}</TableCell>` を追加する
    - `corporate_name` が null または空文字の場合は「-」を表示
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 4.3 Property 3 のプロパティテストを作成する: 法人名列のレンダリング（値あり）
    - **Property 3: 法人名列のレンダリング（値あり）**
    - **Validates: Requirements 3.1, 3.2**
    - 任意の非空文字列 `corporate_name` を持つ買主データに対してその値がテーブルセルに表示されることを検証
    - `fast-check` の `fc.string({ minLength: 1 })` を使用
  - [ ]* 4.4 Property 4 のプロパティテストを作成する: 法人名列のレンダリング（null または空文字）
    - **Property 4: 法人名列のレンダリング（null または空文字）**
    - **Validates: Requirements 3.3**
    - `corporate_name` が null または空文字の場合に「-」が表示されることを検証
    - `fc.oneof(fc.constant(null), fc.constant(''))` を使用

- [x] 5. 既存機能の保全確認
  - [x] 5.1 業者フィルタートグル動作が変わっていないことを確認するユニットテストを追加・実行する
    - 同じボタンで解除（null に戻る）、別ボタンで排他切り替えの動作を確認
    - _Requirements: 4.1_
  - [ ]* 5.2 Property 6 のプロパティテストを作成する: 業者フィルタートグル動作の保全
    - **Property 6: 業者フィルタートグル動作の保全**
    - **Validates: Requirements 4.1**
    - 任意のフィルタータイプ（`'土地'` | `'戸建'` | `'マンション'`）に対してトグル動作が正しいことを検証
  - [ ]* 5.3 Property 7 のプロパティテストを作成する: 業者フィルターと価格帯フィルターのAND結合保全
    - **Property 7: 業者フィルターと価格帯フィルターのAND結合保全**
    - **Validates: Requirements 4.2**
    - 任意の買主データリスト・業者フィルター・価格帯フィルターに対してAND結合が正しいことを検証
  - [ ]* 5.4 Property 5 のプロパティテストを作成する: 既存列の保全
    - **Property 5: 既存列の保全**
    - **Validates: Requirements 4.3**
    - 任意の買主データリストに対して既存の全列ヘッダーが存在することを検証

- [x] 6. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 日本語を含むファイル（`NearbyBuyersList.tsx`）の編集は Pythonスクリプトを使用すること（file-encoding-protection.md のルール）
- データベーススキーマの変更は不要（`corporate_name` カラムは既存）
- `property-search-app`、`chuukaigyosha` プロジェクトには触れないこと
