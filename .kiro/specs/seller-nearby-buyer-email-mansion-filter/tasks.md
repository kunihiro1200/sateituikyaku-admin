# 実装計画: マンション物件メール本文フィルター

## 概要

`NearbyBuyersList.tsx` の `buildEmailTemplate` 関数に `propertyType` パラメータを追加し、マンション判定ロジックを実装する。

## タスク

- [x] 1. `buildEmailTemplate` 関数の修正
  - `frontend/frontend/src/components/NearbyBuyersList.tsx` を開く
  - `buildEmailTemplate` の引数型に `propertyType: string | null | undefined` を追加する
  - 関数内で `const isMansion = params.propertyType === 'マ' || params.propertyType === 'マンション';` を定義する
  - `isMansion` が `true` の場合は「土地面積：{土地面積}㎡」行と「ぜんりんを添付しておりますのでご参考ください。」行を除外したテンプレートを返す
  - `isMansion` が `false`（null・undefined・空文字・その他）の場合は従来通り全行を含むテンプレートを返す
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1_

  - [ ]* 1.1 Property 1 のプロパティテストを作成する
    - **Property 1: マンション判定時の行除外**
    - `propertyType` が「マ」または「マンション」の場合、生成テンプレートに「土地面積：」も「ぜんりんを添付しておりますのでご参考ください。」も含まれないことを検証する
    - fast-check の `fc.constantFrom('マ', 'マンション')` を使用し、buyerName・address・landArea・buildingArea はランダム値で 100 回実行する
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 1.2 Property 2 のプロパティテストを作成する
    - **Property 2: 非マンション・未設定時の行保持**
    - `propertyType` が null・undefined・空文字・非マンション文字列の場合、生成テンプレートに「土地面積：」と「ぜんりんを添付しておりますのでご参考ください。」の両方が含まれることを検証する
    - fast-check の `fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''), fc.string().filter(...))` を使用し 100 回実行する
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2. `buildEmailTemplate` 呼び出し箇所の修正
  - 1名宛の呼び出しに `propertyType: effectivePropertyType` を追加する
  - 複数名宛の呼び出しに `propertyType: effectivePropertyType` を追加する
  - _Requirements: 3.2, 3.3_

- [x] 3. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP では省略可能
- `effectivePropertyType` は既存の `const effectivePropertyType = propertyType || apiPropertyType;` をそのまま使用する
- バックエンドの変更は不要
