# 実装計画：物件詳細ページへの買主フィルター設定機能

## 概要

物件詳細ページにフィルター設定バーUIを追加し、設定値をDBに保存・復元する。
買主候補リストと配信買主リストの両方に、物件ごとのフィルター値を自動適用する。

## タスク

- [x] 1. DBマイグレーション：property_listingsテーブルに4カラム追加
  - `backend/add-buyer-filter-columns.sql` を作成する
  - `buyer_filter_pet`・`buyer_filter_parking`・`buyer_filter_onsen`・`buyer_filter_floor` の4カラムをTEXT型・DEFAULT NULLで追加するSQLを記述する
  - SupabaseのSQLエディタで実行するためのファイルとして作成する
  - _Requirements: 2.7_

- [x] 2. BuyerService：filterByXxx を public static に変更
  - [x] 2.1 `backend/src/services/BuyerService.ts` の `filterByPet`・`filterByParking`・`filterByOnsen`・`filterByFloor` を `private` から `public static` に変更する
    - 既存の `getOtherCompanyDistributionBuyers` 内での呼び出しを `BuyerService.filterByXxx(...)` 形式に更新する
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.2 ペットフィルターのプロパティテストを書く（プロパティ8）
    - **Property 8: ペットフィルターのマッチングロジック**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - fast-check を使用し、任意の買主リストとペットフィルター値に対してマッチング条件を検証する

  - [ ]* 2.3 P台数フィルターのプロパティテストを書く（プロパティ9）
    - **Property 9: P台数フィルターのマッチングロジック**
    - **Validates: Requirements 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**
    - fast-check を使用し、全6パターンのマッチング条件を検証する

  - [ ]* 2.4 温泉フィルターのプロパティテストを書く（プロパティ10）
    - **Property 10: 温泉フィルターのマッチングロジック**
    - **Validates: Requirements 6.10, 6.11, 6.12**
    - fast-check を使用し、任意の買主リストと温泉フィルター値に対してマッチング条件を検証する

  - [ ]* 2.5 高層階フィルターのプロパティテストを書く（プロパティ11）
    - **Property 11: 高層階フィルターのマッチングロジック**
    - **Validates: Requirements 6.13, 6.14, 6.15**
    - fast-check を使用し、任意の買主リストと高層階フィルター値に対してマッチング条件を検証する

- [x] 3. BuyerCandidateService：フィルター値を取得して適用
  - [x] 3.1 `backend/src/services/BuyerCandidateService.ts` の `getCandidatesForProperty` メソッドに、`property_listings` から `buyer_filter_*` 4カラムを取得するコードを追加する
    - 取得したフィルター値を `BuyerService.filterByPet`・`filterByParking`・`filterByOnsen`・`filterByFloor` に渡して買主リストを絞り込む
    - NULL値の場合はデフォルト値（`どちらでも`/`指定なし`）として扱う
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 3.2 買主候補リストへのフィルター適用のプロパティテストを書く（プロパティ6）
    - **Property 6: 買主候補リストへのフィルター適用**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    - 任意のフィルター値が設定された物件で買主候補リストを取得すると、マッチングロジックに従って絞り込まれることを検証する

- [x] 4. EnhancedBuyerDistributionService：フィルター値を取得して適用
  - [x] 4.1 `backend/src/services/EnhancedBuyerDistributionService.ts` の `getQualifiedBuyersWithAllCriteria` メソッドに、`property_listings` から `buyer_filter_*` 4カラムを取得するコードを追加する
    - 取得したフィルター値を `BuyerService.filterByPet`・`filterByParking`・`filterByOnsen`・`filterByFloor` に渡して買主リストを絞り込む
    - NULL値の場合はデフォルト値（`どちらでも`/`指定なし`）として扱う
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.2 配信買主リストへのフィルター適用のプロパティテストを書く（プロパティ7）
    - **Property 7: 配信買主リストへのフィルター適用**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
    - 任意のフィルター値が設定された物件で配信買主リストを取得すると、マッチングロジックに従って絞り込まれることを検証する

- [x] 5. チェックポイント - バックエンドのテストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 6. フロントエンド：フィルター状態とデータ読み込みの追加
  - [x] 6.1 `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` に4つのフィルター状態（`buyerFilterPet`・`buyerFilterParking`・`buyerFilterOnsen`・`buyerFilterFloor`）を `useState` で追加する
    - 選択肢定数（`PET_OPTIONS`・`PARKING_OPTIONS`・`ONSEN_OPTIONS`・`FLOOR_OPTIONS`）を定義する
    - `fetchPropertyData` 内でAPIレスポンスからフィルター値を読み込んで各 `setState` を呼ぶ
    - NULL値の場合はデフォルト値（`どちらでも`/`指定なし`）を使用する
    - 日本語を含むファイルのためPythonスクリプトでUTF-8書き込みを行う
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 6.2 フィルター値復元のプロパティテストを書く（プロパティ4）
    - **Property 4: 保存済みフィルター値がFilter_Barに復元される**
    - **Validates: Requirements 2.2**
    - 任意の保存済みフィルター値を持つ物件でページ読み込み時に各フィルターが正しく反映されることを検証する

- [x] 7. フロントエンド：フィルター値の保存ハンドラーと物件種別変更時リセット処理の追加
  - [x] 7.1 `handleBuyerFilterChange` 関数を追加する
    - ローカル状態を更新し、`PUT /api/property-listings/:propertyNumber` に変更後の値を即座に保存する
    - 保存失敗時はスナックバーでエラーメッセージを表示する
    - 日本語を含むファイルのためPythonスクリプトでUTF-8書き込みを行う
    - _Requirements: 2.1_

  - [x] 7.2 `handleFieldChange` 内に物件種別変更時のリセット処理を追加する
    - 物件種別が「マンション」以外に変更された場合、`buyerFilterPet` と `buyerFilterFloor` を「どちらでも」にリセットする
    - リセット後の値を `PUT /api/property-listings/:propertyNumber` でDBにも保存する
    - 日本語を含むファイルのためPythonスクリプトでUTF-8書き込みを行う
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 7.3 フィルター値変更時の保存プロパティテストを書く（プロパティ3）
    - **Property 3: フィルター値変更時にDBへ保存される**
    - **Validates: Requirements 2.1**
    - 任意のフィルター値変更に対してPUT APIが変更後の値で呼ばれることを検証する

  - [ ]* 7.4 物件種別変更時リセットのプロパティテストを書く（プロパティ5）
    - **Property 5: マンション以外への変更でPet_FilterとFloor_Filterがリセットされる**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Pet_FilterとFloor_Filterが設定された状態で物件種別がマンション以外に変更されると「どちらでも」にリセットされDBにも保存されることを検証する

- [x] 8. フロントエンド：フィルター設定バーUIの追加
  - [x] 8.1 物件番号の右隣にフィルター設定バーを配置するJSXを追加する
    - `FilterButtonGroup` パターン（ボタン選択UI）をインラインで実装する（新規コンポーネントは作成しない）
    - `Parking_Filter`・`Onsen_Filter` は物件種別に関わらず常時表示する
    - `Pet_Filter`・`Floor_Filter` は物件種別が「マンション」の場合のみ表示する
    - 各ボタンの `onChange` に `handleBuyerFilterChange` を接続する
    - 日本語を含むファイルのためPythonスクリプトでUTF-8書き込みを行う
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [ ]* 8.2 マンション以外でPet_FilterとFloor_Filterが非表示になるプロパティテストを書く（プロパティ1）
    - **Property 1: マンション以外の物件種別でPet_FilterとFloor_Filterが非表示になる**
    - **Validates: Requirements 1.4**
    - 任意のマンション以外の物件種別においてPet_FilterとFloor_Filterが表示されないことを検証する

  - [ ]* 8.3 Parking_FilterとOnsen_Filterが常時表示されるプロパティテストを書く（プロパティ2）
    - **Property 2: 物件種別に関わらずParking_FilterとOnsen_Filterが常時表示される**
    - **Validates: Requirements 1.5**
    - 任意の物件種別においてParking_FilterとOnsen_Filterが常に表示されることを検証する

- [x] 9. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- タスクに `*` が付いているサブタスクはオプションであり、MVPとして省略可能
- 日本語を含むファイル（`.tsx`）の編集はPythonスクリプトを使用してUTF-8で書き込む
- バックエンドは `backend/src/` のみ編集（`backend/api/` は触らない）
- DBマイグレーションはSupabaseのSQLエディタで実行するSQLファイルを作成する
- デプロイはgit pushで自動デプロイ（vercel CLIは使わない）
- 各タスクは前のタスクの成果物を前提として積み上げる
