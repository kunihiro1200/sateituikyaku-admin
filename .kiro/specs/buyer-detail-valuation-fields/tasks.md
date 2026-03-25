# 実装計画: buyer-detail-valuation-fields

## 概要

`BuyerDetailPage.tsx` の「問合せ内容」セクションに対して2つの変更を行う。
1. `owned_home_hearing` フィールドを削除し、`next_call_date` をその位置に移動する
2. `valuation_required === '要'` のとき、査定関連13フィールドを条件付きで表示する

## タスク

- [x] 1. VALUATION_FIELDS 定数の追加
  - `BUYER_FIELD_SECTIONS` の近くに `VALUATION_FIELDS` 定数を追加する
  - 13フィールド（`property_type`, `location`, `current_status`, `land_area`, `building_area`, `floor_plan`, `build_year`, `renovation_history`, `other_valuation_done`, `owner_name`, `loan_balance`, `visit_desk`, `seller_list_copy`）を定義する
  - _Requirements: 2.1, 2.5_

- [x] 2. BUYER_FIELD_SECTIONS の問合せ内容セクションを変更
  - [x] 2.1 `owned_home_hearing` エントリを削除する
    - `BUYER_FIELD_SECTIONS` の問合せ内容セクションから `owned_home_hearing` を削除する
    - _Requirements: 1.1_
  - [ ]* 2.2 Property test: 問合せ内容セクションの静的構造を検証する
    - **Property 1: 問合せ内容セクションの静的構造**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [x] 2.3 `next_call_date` を `distribution_type` の直後に移動する
    - `next_call_date` を `owned_home_hearing` があった位置（`distribution_type` の直後）に移動する
    - `next_call_date` の末尾エントリを削除する
    - 変更後の順序: `distribution_type` → `next_call_date` → `owned_home_hearing_inquiry` → `owned_home_hearing_result` → `valuation_required`
    - _Requirements: 1.2, 1.3_

- [x] 3. チェックポイント - セクション構造の確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. valuation_required 特別処理ブロックに査定フィールドを追加
  - [x] 4.1 `if (field.key === 'valuation_required')` ブロックの return 文内、ボタン UI の直後に条件付きレンダリングを追加する
    - `buyer.valuation_required === '要'` のとき `VALUATION_FIELDS` の13フィールドを `InlineEditableField` でレンダリングする
    - 各フィールドは `fieldType="text"`、`onSave` で `handleInlineFieldSave` を呼び出す
    - `buyer[vField.key] || ''` でフォールバックする
    - _Requirements: 2.1, 2.4, 2.5, 2.6_
  - [ ]* 4.2 Property test: 要査定=要のとき13フィールドが表示される
    - **Property 2: 要査定=要のとき13フィールドが表示される**
    - **Validates: Requirements 2.1, 2.4**
  - [ ]* 4.3 Property test: 要査定=要以外のとき13フィールドが非表示になる
    - **Property 3: 要査定=要以外のとき13フィールドが非表示になる**
    - **Validates: Requirements 2.2, 2.3**
  - [ ]* 4.4 Property test: 査定フィールドは InlineEditableField として描画される
    - **Property 4: 査定フィールドは InlineEditableField として描画される**
    - **Validates: Requirements 2.5**
  - [ ]* 4.5 Property test: 査定フィールド保存時に handleInlineFieldSave が呼ばれる
    - **Property 5: 査定フィールド保存時に handleInlineFieldSave が呼ばれる**
    - **Validates: Requirements 2.6**

- [x] 5. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、MVP向けにスキップ可能
- 変更対象ファイルは `frontend/frontend/src/pages/BuyerDetailPage.tsx` のみ
- バックエンド変更は不要
- 日本語ファイルを編集する際は Pythonスクリプトを使用し、UTF-8エンコーディングを維持すること
