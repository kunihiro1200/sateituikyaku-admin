# 近隣買主候補テーブル フィールド表示バグ 修正設計

## Overview

通話モードページ（`/sellers/:id/call`）の「近隣買主候補」テーブルで、6つのフィールドが全て「-」と表示されるバグを修正する。

根本原因は `backend/src/services/BuyerService.ts` の `getBuyersByAreas()` メソッドのSQLクエリに、フロントエンドの `NearbyBuyersList.tsx` が表示に必要とするフィールドが含まれていないことである。

修正方針は最小限：SQLクエリの `select()` に6つのフィールドを追加するだけで、フロントエンドの変更は不要。

## Glossary

- **Bug_Condition (C)**: `getBuyersByAreas()` のSQLクエリに必要なフィールドが含まれておらず、APIレスポンスに該当フィールドが `undefined` として返される状態
- **Property (P)**: 修正後の正しい動作 — APIレスポンスに6つのフィールドが含まれ、フロントエンドが値を表示できる
- **Preservation**: 既存フィールド（`buyer_number`, `name`, `distribution_areas` など）の表示・フィルタリング・メール/SMS送信機能が変わらないこと
- **getBuyersByAreas()**: `backend/src/services/BuyerService.ts` の1022行目にあるメソッド。エリア番号・物件種別・価格でフィルタリングして近隣買主候補を返す
- **NearbyBuyersList**: `frontend/frontend/src/components/NearbyBuyersList.tsx` のコンポーネント。`NearbyBuyer` インターフェースで6つの欠けているフィールドを定義済み

## Bug Details

### Bug Condition

`getBuyersByAreas()` のSQLクエリが以下の6フィールドを `select()` に含めていないため、APIレスポンスに値が存在せず、フロントエンドで `undefined` → `'-'` と表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(apiResponse)
  INPUT: apiResponse — getBuyersByAreas() が返す買主オブジェクトの配列
  OUTPUT: boolean

  RETURN EXISTS buyer IN apiResponse WHERE
    buyer.inquiry_property_type IS undefined
    AND buyer.property_address IS undefined
    AND buyer.inquiry_price IS undefined
    AND buyer.inquiry_hearing IS undefined
    AND buyer.viewing_result_follow_up IS undefined
    AND buyer.latest_status IS undefined
    AND buyer.latest_viewing_date IS undefined
END FUNCTION
```

### Examples

- 買主Aが「戸建」を希望し `inquiry_property_type = '戸建'` がDBに存在する → APIレスポンスに含まれず → テーブルに「-」と表示される（バグ）
- 買主Bの `inquiry_price = 30000000`（3000万円）がDBに存在する → APIレスポンスに含まれず → テーブルに「-」と表示される（バグ）
- 買主Cの `latest_status = '追客中'` がDBに存在する → APIレスポンスに含まれず → テーブルに「-」と表示される（バグ）
- 買主Dの `inquiry_property_type` がDBで `null` → 修正後も「-」と表示される（正常動作）

## Expected Behavior

### Preservation Requirements

**変わらないべき動作:**
- `buyer_number`（買主番号）のリンク表示と買主詳細ページへの遷移
- `name`（名前）の表示
- `distribution_areas`（配布エリア）のチップ表示
- エリアフィルタリング・種別フィルタリング・価格フィルタリングのロジック（`filterBuyerCandidates()`）
- 日付・確度によるソート（`sortBuyersByDateAndConfidence()`）
- メール送信・SMS送信機能（チェックボックス選択）
- ページネーション処理（1000件ずつ取得）

**スコープ:**
SQLクエリの `select()` にフィールドを追加するだけの変更であり、フィルタリングロジック・ソートロジック・フロントエンドには一切変更を加えない。

## Hypothesized Root Cause

`getBuyersByAreas()` のSQLクエリ（`backend/src/services/BuyerService.ts` 1022行目）の `.select()` に以下の6フィールドが含まれていない：

```typescript
// 現在のselect()に含まれていないフィールド
inquiry_property_type,   // 種別
property_address,        // 問合せ住所
inquiry_price,           // 価格
inquiry_hearing,         // ヒアリング
viewing_result_follow_up // 内覧結果フォローアップ
// ※ latest_status と latest_viewing_date も含まれていない
```

フロントエンドの `NearbyBuyer` インターフェース（`NearbyBuyersList.tsx` 24行目）はこれらのフィールドを定義済みであり、フロントエンド側の問題ではない。

## Correctness Properties

Property 1: Bug Condition - 欠けているフィールドがAPIレスポンスに含まれる

_For any_ `getBuyersByAreas()` の呼び出しに対して、修正後の関数は `inquiry_property_type`、`property_address`、`inquiry_price`、`inquiry_hearing`、`viewing_result_follow_up`、`latest_status`、`latest_viewing_date` の各フィールドをAPIレスポンスに含め（値が `null` の場合も含む）、フロントエンドが「-」以外の値を表示できる状態にする。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - 既存フィールドの動作が変わらない

_For any_ `getBuyersByAreas()` の呼び出しに対して、修正後の関数は `buyer_number`、`name`、`distribution_areas`、`inquiry_confidence`、`inquiry_source`、`distribution_type`、`desired_area`、`desired_property_type`、`price_range_house`、`price_range_apartment`、`price_range_land`、`reception_date`、`email`、`phone_number` の各フィールドについて、修正前と同一の値を返し、フィルタリング・ソート・メール/SMS送信機能の動作を変えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

**Function**: `getBuyersByAreas()` （1022行目）

**Specific Changes**:

1. **SQLクエリの `select()` に6フィールドを追加**:

```typescript
// 修正前
.select(`
  buyer_id,
  buyer_number,
  name,
  latest_status,
  latest_viewing_date,
  inquiry_confidence,
  inquiry_source,
  distribution_type,
  distribution_areas,
  broker_inquiry,
  desired_area,
  desired_property_type,
  price_range_house,
  price_range_apartment,
  price_range_land,
  reception_date,
  email,
  phone_number
`)

// 修正後（追加フィールドを末尾に追記）
.select(`
  buyer_id,
  buyer_number,
  name,
  latest_status,
  latest_viewing_date,
  inquiry_confidence,
  inquiry_source,
  distribution_type,
  distribution_areas,
  broker_inquiry,
  desired_area,
  desired_property_type,
  price_range_house,
  price_range_apartment,
  price_range_land,
  reception_date,
  email,
  phone_number,
  inquiry_property_type,
  property_address,
  inquiry_price,
  inquiry_hearing,
  viewing_result_follow_up
`)
```

**注意**: `latest_status` と `latest_viewing_date` は既にクエリに含まれているため追加不要。

**変更ファイル数**: 1ファイルのみ  
**変更行数**: 約5行追加

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `getBuyersByAreas()` のレスポンスに6フィールドが含まれないことを確認し、根本原因を実証する。

**Test Plan**: `getBuyersByAreas()` を直接呼び出し、レスポンスオブジェクトに各フィールドが存在するかチェックする。未修正コードでは `undefined` が返ることを確認する。

**Test Cases**:
1. **フィールド存在確認テスト**: `getBuyersByAreas()` のレスポンスに `inquiry_property_type` が含まれないことを確認（未修正コードで失敗）
2. **価格フィールドテスト**: `inquiry_price` が `undefined` であることを確認（未修正コードで失敗）
3. **最新状況テスト**: `latest_status` が `undefined` であることを確認（未修正コードで失敗）
4. **全6フィールド一括テスト**: 6フィールド全てが `undefined` であることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `buyer.inquiry_property_type === undefined`（DBに値があっても `undefined`）
- `buyer.property_address === undefined`
- `buyer.inquiry_price === undefined`
- 原因: SQLクエリの `select()` にフィールドが含まれていないため、Supabaseがそのカラムを返さない

### Fix Checking

**Goal**: 修正後、6フィールドがAPIレスポンスに含まれることを検証する。

**Pseudocode:**
```
FOR ALL buyer IN getBuyersByAreas_fixed(areaNumbers) DO
  ASSERT 'inquiry_property_type' IN buyer  // undefined ではなく null or 値
  ASSERT 'property_address' IN buyer
  ASSERT 'inquiry_price' IN buyer
  ASSERT 'inquiry_hearing' IN buyer
  ASSERT 'viewing_result_follow_up' IN buyer
  ASSERT 'latest_status' IN buyer
  ASSERT 'latest_viewing_date' IN buyer
END FOR
```

### Preservation Checking

**Goal**: 修正前後で既存フィールドの値が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL buyer IN getBuyersByAreas_fixed(areaNumbers) DO
  ASSERT getBuyersByAreas_original(areaNumbers)[buyer].buyer_number
       = getBuyersByAreas_fixed(areaNumbers)[buyer].buyer_number
  ASSERT getBuyersByAreas_original(areaNumbers)[buyer].name
       = getBuyersByAreas_fixed(areaNumbers)[buyer].name
  // ... 全既存フィールドについて同様
END FOR
```

**Testing Approach**: SQLクエリへの追記のみの変更であり、既存フィールドへの影響はゼロのはず。ただし、ページネーション処理やフィルタリングロジックが引き続き正常動作することを統合テストで確認する。

**Test Cases**:
1. **既存フィールド保持テスト**: `buyer_number`、`name`、`distribution_areas` が修正前後で同一値を返すことを確認
2. **フィルタリング保持テスト**: エリア・種別・価格フィルタリングが修正後も正常動作することを確認
3. **ページネーション保持テスト**: 1000件超のデータで複数ページ取得が正常動作することを確認

### Unit Tests

- `getBuyersByAreas()` のレスポンスに6フィールドが含まれることを確認
- 各フィールドが `null` の場合でも `undefined` ではなく `null` が返ることを確認
- 既存フィールド（`buyer_number`, `name` など）が引き続き返ることを確認

### Property-Based Tests

- ランダムなエリア番号・物件種別・価格の組み合わせで `getBuyersByAreas()` を呼び出し、全レスポンスに6フィールドが含まれることを検証
- 修正前後でフィルタリング結果の件数が変わらないことを検証（追加フィールドはフィルタリングに影響しない）

### Integration Tests

- 通話モードページ（`/sellers/:id/call`）を開き、近隣買主候補テーブルで「種別」「問合せ住所」「価格」「ヒアリング/内覧結果」「最新状況」「内覧日」が「-」以外の値で表示されることを確認
- DBに値が存在する買主で各フィールドが正しく表示されることを確認
- メール送信・SMS送信機能が引き続き正常動作することを確認
