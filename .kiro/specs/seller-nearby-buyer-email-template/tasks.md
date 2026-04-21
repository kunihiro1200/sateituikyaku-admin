# 実装計画: 売主リスト近隣買主メール本文テンプレート変更

## 概要

バックエンドAPIに `propertyDetails` オブジェクトを追加し、フロントエンドで面積優先ロジックと新しいメール本文テンプレート生成ロジックを実装する。

## タスク

- [x] 1. バックエンドAPIの `propertyDetails` レスポンス拡張
  - `backend/src/routes/sellers.ts` の `GET /api/sellers/:id/nearby-buyers` エンドポイントを修正する
  - `seller.property` から `address`・`landArea`・`buildingArea`・`landAreaVerified`・`buildingAreaVerified`・`buildYear`・`floorPlan` を取得して `propertyDetails` オブジェクトとしてレスポンスに追加する
  - `seller.property` が存在しない場合は `propertyDetails: null` を返す
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. フロントエンドの `PropertyDetails` 型拡張と状態管理
  - [x] 2.1 `NearbyBuyersList.tsx` の `PropertyDetails` インターフェースに `landAreaVerified: number | null` と `buildingAreaVerified: number | null` フィールドを追加する
    - _Requirements: 4.1, 4.2_
  - [x] 2.2 APIレスポンスから `propertyDetails.landAreaVerified` と `propertyDetails.buildingAreaVerified` を `propertyDetails` ステートに保存するよう修正する
    - _Requirements: 4.3_

- [x] 3. 面積優先ロジック関数の実装
  - [x] 3.1 `NearbyBuyersList.tsx` に `resolveArea(verified, normal)` 関数を実装する
    - `verified` が null でない場合は `verified` を返す
    - `verified` が null で `normal` が null でない場合は `normal` を返す
    - 両方 null の場合は null を返す
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 3.2 `resolveArea` 関数のプロパティテストを書く
    - **Property 5（統合）: 面積優先ロジック**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. メール本文テンプレート生成ロジックの実装
  - [x] 4.1 `NearbyBuyersList.tsx` に `buildEmailTemplate(params)` 関数を実装する
    - 新テンプレート形式（物件住所・土地面積・建物面積を本文に直接埋め込む）を生成する
    - `buyerName` が null でない場合は `{氏名}` を氏名に置換し、null の場合は `{氏名}` プレースホルダーのままにする
    - `address` が null の場合は空文字列で置換する
    - `landArea`・`buildingArea` が null の場合は空文字列で置換する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_
  - [ ]* 4.2 `buildEmailTemplate` 関数の物件住所埋め込みプロパティテストを書く
    - **Property 1: 物件住所のテンプレート埋め込み**
    - **Validates: Requirements 1.2**
  - [ ]* 4.3 `buildEmailTemplate` 関数の土地面積埋め込みプロパティテストを書く
    - **Property 2: 土地面積のテンプレート埋め込み**
    - **Validates: Requirements 1.3**
  - [ ]* 4.4 `buildEmailTemplate` 関数の建物面積埋め込みプロパティテストを書く
    - **Property 3: 建物面積のテンプレート埋め込み**
    - **Validates: Requirements 1.4**
  - [ ]* 4.5 `buildEmailTemplate` 関数の1名宛氏名置換プロパティテストを書く
    - **Property 4: 1名宛の氏名置換**
    - **Validates: Requirements 1.5**

- [x] 5. メール送信ボタン押下時のテンプレート生成処理を接続する
  - `NearbyBuyersList.tsx` のメール送信ボタン押下ハンドラーを修正する
  - `resolveArea` で土地面積・建物面積を決定し、`buildEmailTemplate` でテンプレートを生成して `setEmailBody` に渡す
  - 宛先が1名の場合は氏名を渡し、複数名の場合は `null` を渡して `{氏名}` プレースホルダーを残す
  - _Requirements: 1.1, 1.5, 1.6_

- [x] 6. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応が明示されている
- プロパティテストには `fast-check` ライブラリを使用する（既存プロジェクトで使用済み）
- バックエンドは `backend/src/routes/sellers.ts`（売主管理システム用、ポート3000）を編集する
- フロントエンドは `frontend/frontend/src/components/NearbyBuyersList.tsx` を編集する
