# 実装計画：売主リスト近隣買主PDF希望価格追加

## 概要

`nearbyBuyersPrintUtils.ts` の `NearbyBuyer` インターフェースに希望価格フィールドを追加し、`buildPrintContent` 関数に `propertyType` 引数を追加して、PDF出力の「問合せ物件情報」セルに希望価格を表示する。変更はフロントエンドのみ。

## タスク

- [x] 1. nearbyBuyersPrintUtils.ts の NearbyBuyer インターフェース拡張と buildPrintContent 更新
  - [x] 1.1 NearbyBuyer インターフェースに希望価格フィールドを追加する
    - `price_range_house?: string | null`、`price_range_apartment?: string | null`、`price_range_land?: string | null` を追加
    - _Requirements: 1.1_

  - [x] 1.2 getDesiredPriceForPrint 関数を実装する
    - `propertyType` に応じて適切な希望価格フィールドを返す純粋関数
    - 戸建て系 → `price_range_house`、マンション系 → `price_range_apartment`、土地系 → `price_range_land`
    - 種別不明・未設定の場合は house → apartment → land の順でフォールバック
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.3 Property 1 のプロパティテストを書く（fast-check）
    - **Property 1: 物件種別に応じた希望価格フィールド選択**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**

  - [x] 1.4 buildPrintContent 関数に propertyType 引数を追加する
    - シグネチャを `buildPrintContent(buyers, selectedBuyerNumbers, isNameHidden, propertyType?: string | null)` に変更
    - 後方互換性を維持（省略可能）
    - _Requirements: 1.2, 4.4_

  - [x] 1.5 問合せ物件情報セルに希望価格行を追加する
    - `getDesiredPriceForPrint` で取得した値が存在する場合、`<br><span style="font-size:11px;">希望価格：{値}</span>` を追記
    - 値が null または空文字の場合は希望価格行を表示しない
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.6 Property 2 のプロパティテストを書く（fast-check）
    - **Property 2: 希望価格あり時のHTML出力**
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ]* 1.7 Property 3 のプロパティテストを書く（fast-check）
    - **Property 3: 希望価格なし時のHTML出力**
    - **Validates: Requirements 2.2**

  - [ ]* 1.8 Property 4 のプロパティテストを書く（fast-check）
    - **Property 4: 既存列の維持**
    - **Validates: Requirements 4.1**

  - [ ]* 1.9 Property 5 のプロパティテストを書く（fast-check）
    - **Property 5: 名前非表示機能の維持**
    - **Validates: Requirements 4.2**

- [x] 2. NearbyBuyersList.tsx の handlePrint 更新
  - [x] 2.1 buildPrintContent 呼び出しに propertyType を追加する
    - `buildPrintContent(buyers, selectedBuyers, isNameHidden, propertyType)` に変更
    - `propertyType` は既存の props から取得
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応を明記
- プロパティテストは fast-check を使用（TypeScript/React プロジェクト）
- バックエンドの変更は不要（APIレスポンスには既に希望価格フィールドが含まれている）
