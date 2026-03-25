# 要件定義書

## はじめに

買主詳細画面（`BuyerDetailPage.tsx`）の「問合せ内容」セクションに対して2つの変更を行う。

1. `owned_home_hearing`（持家ヒアリング）フィールドを削除し、`next_call_date`（次電日）をその位置に移動する
2. `valuation_required`（要査定）が「要」の場合に、査定関連の13フィールドを条件付きで表示する

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **BUYER_FIELD_SECTIONS**: 画面のフィールドをセクションごとに定義する定数配列
- **問合せ内容セクション**: `BUYER_FIELD_SECTIONS` の最初のセクション（`title: '問合せ内容'`）
- **owned_home_hearing**: 持家ヒアリングフィールド（DBカラム名）
- **next_call_date**: 次電日フィールド（DBカラム名）
- **valuation_required**: 要査定フィールド（DBカラム名）。値は「要」または「不要」
- **査定フィールド群**: `valuation_required` が「要」の場合に表示される13フィールド
- **InlineEditableField**: インライン編集可能なフィールドコンポーネント

## 要件

### 要件1: 持家ヒアリングフィールドの削除と次電日の移動

**ユーザーストーリー:** 担当者として、問合せ内容セクションから不要な持家ヒアリングフィールドを削除し、次電日を適切な位置に表示したい。そうすることで、画面のレイアウトをより使いやすくできる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL NOT display the `owned_home_hearing` field in the 問合せ内容 section.
2. WHEN the 問合せ内容 section is rendered, THE BuyerDetailPage SHALL display the `next_call_date` field at the position where `owned_home_hearing` previously appeared (directly after `distribution_type`).
3. THE BuyerDetailPage SHALL continue to display `owned_home_hearing_inquiry`（問合時持家ヒアリング）and `owned_home_hearing_result`（持家ヒアリング結果）fields in their existing positions.

---

### 要件2: 要査定=要の場合の条件付きフィールド表示

**ユーザーストーリー:** 担当者として、要査定が「要」に設定された買主に対して、査定に必要な13項目を画面上で確認・編集したい。そうすることで、査定に必要な情報を一箇所で管理できる。

#### 受け入れ基準

1. WHEN `valuation_required` is set to「要」, THE BuyerDetailPage SHALL display the following 13 fields in the 問合せ内容 section, immediately after the `valuation_required` field:
   - `property_type`（種別）
   - `location`（所在地）
   - `current_status`（現況）
   - `land_area`（土地面積（不明の場合は空欄））
   - `building_area`（建物面積（不明の場合は空欄））
   - `floor_plan`（間取り）
   - `build_year`（築年（西暦））
   - `renovation_history`（リフォーム履歴（その他太陽光等も））
   - `other_valuation_done`（他に査定したことある？）
   - `owner_name`（名義人）
   - `loan_balance`（ローン残）
   - `visit_desk`（訪問/机上）
   - `seller_list_copy`（売主リストコピー）

2. WHEN `valuation_required` is NOT set to「要」（空欄または「不要」）, THE BuyerDetailPage SHALL NOT display the 13 valuation fields listed in criterion 1.

3. WHEN `valuation_required` changes from「要」to another value, THE BuyerDetailPage SHALL immediately hide the 13 valuation fields without requiring a page reload.

4. WHEN `valuation_required` changes from another value to「要」, THE BuyerDetailPage SHALL immediately display the 13 valuation fields without requiring a page reload.

5. THE BuyerDetailPage SHALL render each of the 13 valuation fields as an InlineEditableField with `fieldType="text"`, allowing inline editing and saving.

6. WHEN a valuation field value is saved, THE BuyerDetailPage SHALL call `handleInlineFieldSave` with the corresponding DB column name and new value.
