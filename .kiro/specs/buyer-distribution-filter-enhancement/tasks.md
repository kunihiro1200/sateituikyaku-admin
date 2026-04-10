# 実装計画：買主リスト「他社物件新着配信」フィルター追加

## 概要

「他社物件新着配信」ページのフィルターバーに「ペット」「P台数」「温泉」「高層階」の4つのフィルターを追加する。
バックエンドでマッチングロジックを実装し、フロントエンドからフィルター値をAPIに渡す構成。

## タスク

- [-] 1. バックエンド：BuyerServiceのフィルタリングロジック実装
  - [x] 1.1 `backend/src/services/BuyerService.ts` の `getBuyersByRadiusSearch` メソッドシグネチャを拡張する
    - `pet`、`parking`、`onsen`、`floor` の4パラメーターをオプションで追加
    - デフォルト値: `pet='どちらでも'`、`parking='指定なし'`、`onsen='どちらでも'`、`floor='どちらでも'`
    - Supabaseクエリの `select` に `pet_allowed_required`、`parking_spaces`、`hot_spring_required`、`high_floor_required` を追加
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 1.2 ペットフィルター（`filterByPet`）のマッチングロジックを実装する
    - `可`: `pet_allowed_required !== '不可'`（null・空欄含む）
    - `不可`: `pet_allowed_required === '不可'` のみ
    - `どちらでも`: 全件
    - _Requirements: 1.5, 1.6, 1.7_

  - [ ]* 1.3 プロパティテスト：ペットフィルターのマッチングロジック（プロパティ3）
    - **Property 3: ペットフィルターのマッチングロジック**
    - **Validates: Requirements 1.5, 1.6, 1.7**
    - fast-check で `fc.array(buyerArbitrary)` × `fc.constantFrom('可', '不可', 'どちらでも')` を使用

  - [x] 1.4 P台数フィルター（`filterByParking`）のマッチングロジックを実装する
    - `不要`: null・空欄・`1台`・`2台`・`不要`
    - `1台`: null・空欄・`不要`・`1台`
    - `2台以上`: `2台以上`・`3台以上`・`10台以上`
    - `3台以上`: `3台以上`・`10台以上`
    - `10台以上`: `10台以上` のみ
    - `指定なし`: 全件
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 1.5 プロパティテスト：P台数フィルターのマッチングロジック（プロパティ4）
    - **Property 4: P台数フィルターのマッチングロジック**
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**
    - fast-check で全フィルター値の組み合わせを検証

  - [x] 1.6 温泉フィルター（`filterByOnsen`）のマッチングロジックを実装する
    - `あり`: `hot_spring_required === 'あり'` のみ
    - `なし`: null・空欄・`なし`
    - `どちらでも`: 全件
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ]* 1.7 プロパティテスト：温泉フィルターのマッチングロジック（プロパティ5）
    - **Property 5: 温泉フィルターのマッチングロジック**
    - **Validates: Requirements 3.4, 3.5, 3.6**

  - [x] 1.8 高層階フィルター（`filterByFloor`）のマッチングロジックを実装する
    - `高層階`: null・空欄・`高層階`・`どちらでも`
    - `低層階`: null・空欄・`低層階`・`どちらでも`
    - `どちらでも`: 全件
    - _Requirements: 4.5, 4.6, 4.7_

  - [ ]* 1.9 プロパティテスト：高層階フィルターのマッチングロジック（プロパティ6）
    - **Property 6: 高層階フィルターのマッチングロジック**
    - **Validates: Requirements 4.5, 4.6, 4.7**

  - [x] 1.10 4つのフィルターをAND条件で順次適用する処理を `getBuyersByRadiusSearch` に組み込む
    - 既存フィルター（半径・ステータス・物件種別・価格帯）の後に適用
    - キャッシュキーに `pet`・`parking`・`onsen`・`floor` を追加
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 1.11 プロパティテスト：複数フィルターのAND結合（プロパティ7）
    - **Property 7: 複数フィルターのAND結合**
    - **Validates: Requirements 6.1, 6.2**
    - 各フィルターを個別適用した積集合と複合適用結果が一致することを検証

- [x] 2. チェックポイント - バックエンドのテストが全て通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. バックエンド：APIルートの拡張
  - [x] 3.1 `backend/src/routes/buyers.ts` の `/radius-search` エンドポイントで新規パラメーターを受け取るよう修正する
    - `req.body` から `pet`、`parking`、`onsen`、`floor` を取得
    - 省略時のデフォルト値を設定して `getBuyersByRadiusSearch` に渡す
    - _Requirements: 7.1, 7.6_

  - [ ]* 3.2 ユニットテスト：パラメーター省略時の全件返却確認
    - フィルターパラメーター省略時にデフォルト値が適用され全件返却されることを確認
    - _Requirements: 7.6_

- [-] 4. フロントエンド：フィルター状態と選択肢定数の追加
  - [x] 4.1 `frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx` に4つのフィルター状態を追加する
    - `selectedPet`（デフォルト: `'どちらでも'`）
    - `selectedParking`（デフォルト: `'指定なし'`）
    - `selectedOnsen`（デフォルト: `'どちらでも'`）
    - `selectedFloor`（デフォルト: `'どちらでも'`）
    - 選択肢定数 `PET_OPTIONS`、`PARKING_OPTIONS`、`ONSEN_OPTIONS`、`FLOOR_OPTIONS` を定義
    - _Requirements: 1.3, 1.4, 2.2, 2.3, 3.2, 3.3, 4.3, 4.4_

  - [x] 4.2 `togglePropertyType` 関数にマンション非選択時のリセット処理を追加する
    - 物件種別からマンションが除外された場合、`selectedPet` と `selectedFloor` を `'どちらでも'` にリセット
    - _Requirements: 1.8, 4.8, 5.2, 5.4_

  - [ ]* 4.3 プロパティテスト：マンション選択状態と条件付きフィルター表示の対応（プロパティ1）
    - **Property 1: マンション選択状態と条件付きフィルター表示の対応**
    - **Validates: Requirements 1.1, 1.2, 4.1, 4.2, 5.1, 5.2**

  - [ ]* 4.4 プロパティテスト：マンション非選択時の条件付きフィルターリセット（プロパティ2）
    - **Property 2: マンション非選択時の条件付きフィルターリセット**
    - **Validates: Requirements 1.8, 4.8, 5.4**

- [x] 5. フロントエンド：フィルターUIの実装
  - [x] 5.1 ペットフィルターUIを実装する（マンション選択時のみ表示）
    - `selectedPropertyTypes.includes('マンション')` の条件付きレンダリング
    - `PET_OPTIONS` のボタン選択UI
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2_

  - [x] 5.2 P台数フィルターUIを実装する（常時表示）
    - `PARKING_OPTIONS` のボタン選択UI
    - _Requirements: 2.1, 2.2_

  - [x] 5.3 温泉フィルターUIを実装する（常時表示）
    - `ONSEN_OPTIONS` のボタン選択UI
    - _Requirements: 3.1, 3.2_

  - [x] 5.4 高層階フィルターUIを実装する（マンション選択時のみ表示）
    - `selectedPropertyTypes.includes('マンション')` の条件付きレンダリング
    - `FLOOR_OPTIONS` のボタン選択UI
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_

- [-] 6. フロントエンド：APIリクエストへのフィルター値の組み込み
  - [x] 6.1 `/api/buyers/radius-search` へのPOSTリクエストに4つのフィルター値を追加する
    - `pet: selectedPet`、`parking: selectedParking`、`onsen: selectedOnsen`、`floor: selectedFloor`
    - `useEffect` の依存配列に4つの状態を追加
    - _Requirements: 6.1, 6.2, 6.3, 7.1_

- [x] 7. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- 日本語を含むファイルの編集はPythonスクリプトを使用してUTF-8で書き込む
- バックエンドは `backend/src/` のみ編集（`backend/api/` は触らない）
- `*` 付きのサブタスクはオプションであり、MVPとして省略可能
- プロパティテストには fast-check（TypeScript向け）を使用し、最低100回実行する
