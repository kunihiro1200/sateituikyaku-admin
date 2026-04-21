# 実装計画: 通話モードページ「近隣買主」タブへの業者向けフィルタリングボタン追加

## 概要

バックエンド（`BuyerService.ts`）に `desired_property_type` フィールドを追加し、フロントエンド（`NearbyBuyersList.tsx`）に業者フィルタリングボタンとロジックを実装する。

## タスク

- [x] 1. バックエンド: `getBuyersByAreas()` に `desired_property_type` を追加
  - `backend/src/services/BuyerService.ts` の `getBuyersByAreas()` メソッドの SELECT クエリに `desired_property_type` を追加する
  - 戻り値のマッピングに `desired_type: buyer.desired_property_type ?? null` を追加する
  - `broker_inquiry` と `distribution_type` が既に SELECT に含まれていることを確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [-] 2. フロントエンド: `NearbyBuyer` インターフェースの拡張とフィルタリングロジックの実装
  - [x] 2.1 `NearbyBuyer` インターフェースに `desired_type`、`broker_inquiry`、`distribution_type` フィールドを追加する
    - `NearbyBuyersList.tsx` の `NearbyBuyer` インターフェースを拡張する
    - 型はすべて `string | null` とする
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.2 `filterBuyersByAgency` 純粋関数のプロパティテストを作成する
    - **Property 1: 業者_土地フィルターの包含条件**
    - **Validates: Requirements 2.1**
    - **Property 2: 業者_戸建フィルターの排他条件**
    - **Validates: Requirements 2.2**
    - **Property 3: 業者_マンションフィルターの完全一致条件**
    - **Validates: Requirements 2.3**
    - **Property 4: フィルター非適用時の不変性**
    - **Validates: Requirements 2.5**
    - fast-check を使用し、各プロパティ最低100回イテレーション

  - [x] 2.3 `filterBuyersByAgency` 純粋関数を実装する
    - `AgencyFilterType = '土地' | '戸建' | 'マンション' | null` 型を定義する
    - デザインドキュメントの仕様に従いフィルタリングロジックを実装する
    - `broker_inquiry !== '業者（両手）'` の場合は全フィルターで除外する
    - 「業者_土地」: `desired_type` が空欄または "土地" を含む
    - 「業者_戸建」: `desired_type === '戸建'`（完全一致）
    - 「業者_マンション」: `desired_type === 'マンション'`（完全一致）
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ]* 2.4 `filterBuyersByAgency` のユニットテストを作成する
    - `desired_type = null`、`'土地'`、`'土地、戸建'` が「業者_土地」フィルターで含まれることを確認
    - `desired_type = '土地、戸建'` が「業者_戸建」フィルターで除外されることを確認
    - `broker_inquiry` が `null` の場合に全フィルターで除外されることを確認
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. チェックポイント - テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. フロントエンド: 業者フィルターの状態管理とAND結合の実装
  - [x] 4.1 `activeAgencyFilter` state を `NearbyBuyersList` コンポーネントに追加する
    - `useState<AgencyFilterType>(null)` で初期化する
    - 既存の `selectedPriceRanges` フィルターと AND 結合する形で `filteredBuyers` を計算する
    - `filterBuyersByAgency` → 既存価格帯フィルターの順で適用する
    - _Requirements: 2.4, 2.5, 4.1, 4.2, 4.3_

  - [ ]* 4.2 AND結合のプロパティテストを作成する
    - **Property 5: 業者フィルターと価格帯フィルターのAND結合**
    - **Validates: Requirements 2.4**
    - 業者フィルターのみ・価格帯フィルターのみ・両方適用の結果が積集合と等しいことを検証

- [x] 5. フロントエンド: 業者フィルタリングボタンのUI実装
  - [x] 5.1 ボタン表示制御ロジックを実装する
    - `showLandAndHouseButtons = propertyType === '土地' || propertyType === '戸建て'` を定義する
    - `showApartmentButton = propertyType === 'マンション'` を定義する
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 業者フィルターボタンを既存の「PDF」ボタンの右隣に配置する
    - `showLandAndHouseButtons` が true の場合、「業者_土地」「業者_戸建」ボタンを表示する
    - `showApartmentButton` が true の場合、「業者_マンション」ボタンを表示する
    - アクティブなボタンは `variant="contained"`、非アクティブは `variant="outlined"` で表示する
    - ボタンクリック時にトグル動作（同じボタンで解除、別ボタンで排他切り替え）を実装する
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.3 トグル動作のプロパティテストを作成する
    - **Property 6: トグル動作の冪等性**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 7: 排他制御の正確性**
    - **Validates: Requirements 4.3**

  - [ ]* 5.4 ボタン表示制御のユニットテストを作成する
    - `propertyType = '土地'` で土地・戸建ボタンが表示、マンションボタンが非表示
    - `propertyType = 'マンション'` でマンションボタンが表示、土地・戸建ボタンが非表示
    - `propertyType = null` でボタンが非表示
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. フロントエンド: 件数表示の更新
  - フィルタリング後の件数（`filteredBuyers.length`）で「N件の買主が見つかりました」表示を更新する
  - _Requirements: 4.5_

- [x] 7. 最終チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- 日本語を含むファイルの編集は Pythonスクリプトを使用してUTF-8で書き込むこと（`file-encoding-protection.md` のルールに従う）
- バックエンドは `backend/src/` 配下のみ編集すること（`backend/api/` は触らない）
- `*` が付いたサブタスクはオプションであり、スキップ可能
- 各タスクは前のタスクの成果物を前提として積み上げる形で実装する
