# バグ修正要件定義書

## Introduction

売主リスト一覧画面（SellersPage）のフィルタ機能が正しく動作していない問題を修正します。

**影響範囲**: 
- サイトフィルタ（「サイト＝す」など）
- 種別フィルタ（「種別＝土地」など）
- 状況（当社）フィルタ（「状況（当社）＝追客中」など）

**発生環境**: 
- フロントエンド: `frontend/frontend/src/pages/SellersPage.tsx`
- バックエンド: `backend/src/services/SellerService.supabase.ts`

**ユーザーへの影響**: 
- フィルタを選択しても絞り込みが行われず、全てのデータが表示される
- 特定の条件で売主を検索できない

---

## Bug Analysis

### Current Behavior (Defect)

#### 1.1 サイトフィルタの不具合

**WHEN** ユーザーが売主リスト一覧画面でサイトフィルタ（例：「サイト＝す」）を選択する  
**THEN** システムは間違ったカラム名（`inquiry_site`）でデータベースを検索し、フィルタが適用されずに全てのデータを返す

**技術的詳細**:
```typescript
// backend/src/services/SellerService.supabase.ts (Line 1225)
if (inquirySite) {
  query = query.eq('inquiry_site', inquirySite);  // ❌ 間違ったカラム名
}
```

**正しいカラム名**: `site`（スプレッドシートの「サイト」列に対応）

---

#### 1.2 種別フィルタの不具合

**WHEN** ユーザーが売主リスト一覧画面で種別フィルタ（例：「種別＝土地」）を選択する  
**THEN** システムは間違ったカラム名（`property_type`）でデータベースを検索し、フィルタが適用されずに全てのデータを返す

**技術的詳細**:
```typescript
// backend/src/services/SellerService.supabase.ts (Line 1228)
if (propertyTypeFilter) {
  query = query.eq('property_type', propertyTypeFilter);  // ❌ 間違ったカラム名
}
```

**正しいカラム名**: `種別`（日本語カラム名、スプレッドシートの「種別」列に対応）

---

#### 1.3 状況（当社）フィルタの部分一致問題

**WHEN** ユーザーが売主リスト一覧画面で状況（当社）フィルタ（例：「状況（当社）＝追客中」）を選択する  
**THEN** システムは部分一致検索（`ILIKE '%追客中%'`）を使用するため、「追客中」「追客不要(未訪問）」「除外済追客不要」など、意図しないデータも含まれる

**技術的詳細**:
```typescript
// backend/src/services/SellerService.supabase.ts (Line 1231)
if (statusFilter) {
  query = query.ilike('status', `%${statusFilter}%`);  // ❌ 部分一致のため意図しないデータも含まれる
}
```

**期待される動作**: 完全一致検索（`eq('status', statusFilter)`）

---

### Expected Behavior (Correct)

#### 2.1 サイトフィルタの正しい動作

**WHEN** ユーザーが売主リスト一覧画面でサイトフィルタ（例：「サイト＝す」）を選択する  
**THEN** システムは正しいカラム名（`site`）でデータベースを検索し、サイトが「す」の売主のみを返す

**修正後のコード**:
```typescript
if (inquirySite) {
  query = query.eq('site', inquirySite);  // ✅ 正しいカラム名
}
```

---

#### 2.2 種別フィルタの正しい動作

**WHEN** ユーザーが売主リスト一覧画面で種別フィルタ（例：「種別＝土地」）を選択する  
**THEN** システムは正しいカラム名（`種別`）でデータベースを検索し、種別が「土地」の売主のみを返す

**修正後のコード**:
```typescript
if (propertyTypeFilter) {
  query = query.eq('種別', propertyTypeFilter);  // ✅ 正しいカラム名（日本語）
}
```

---

#### 2.3 状況（当社）フィルタの正しい動作

**WHEN** ユーザーが売主リスト一覧画面で状況（当社）フィルタ（例：「状況（当社）＝追客中」）を選択する  
**THEN** システムは完全一致検索（`eq('status', statusFilter)`）を使用し、状況（当社）が「追客中」の売主のみを返す

**修正後のコード**:
```typescript
if (statusFilter) {
  query = query.eq('status', statusFilter);  // ✅ 完全一致検索
}
```

---

#### 2.4 複数フィルタのAND条件

**WHEN** ユーザーが複数のフィルタ（例：「サイト＝す」AND「種別＝土地」）を選択する  
**THEN** システムは全てのフィルタ条件をAND条件で適用し、全ての条件を満たす売主のみを返す

**技術的詳細**:
- Supabaseのクエリビルダーは、複数の`.eq()`を連鎖させることでAND条件を実現
- 既存のコードは正しくAND条件を実装しているため、カラム名を修正するだけで動作する

---

### Unchanged Behavior (Regression Prevention)

#### 3.1 確度フィルタの動作

**WHEN** ユーザーが確度フィルタ（例：「確度＝A」）を選択する  
**THEN** システムは引き続き正しく動作し、確度が「A」の売主のみを返す

**理由**: 確度フィルタは正しいカラム名（`confidence_level`）を使用しているため、修正の影響を受けない

---

#### 3.2 検索機能の動作

**WHEN** ユーザーが検索ボックスに名前・住所・電話番号を入力して検索する  
**THEN** システムは引き続き正しく動作し、検索条件に一致する売主を返す

**理由**: 検索機能は別のAPIエンドポイント（`/api/sellers/search`）を使用しているため、修正の影響を受けない

---

#### 3.3 ページネーションの動作

**WHEN** ユーザーがページを切り替える（例：1ページ目 → 2ページ目）  
**THEN** システムは引き続き正しく動作し、指定されたページの売主を返す

**理由**: ページネーション機能は修正の影響を受けない

---

#### 3.4 ソート機能の動作

**WHEN** ユーザーがソート順を変更する（例：反響日付の降順 → 昇順）  
**THEN** システムは引き続き正しく動作し、指定されたソート順で売主を返す

**理由**: ソート機能は修正の影響を受けない

---

#### 3.5 サイドバーカテゴリフィルタの動作

**WHEN** ユーザーがサイドバーのカテゴリ（例：「①訪問日前日」）を選択する  
**THEN** システムは引き続き正しく動作し、選択されたカテゴリに該当する売主を返す

**理由**: サイドバーカテゴリフィルタは別のロジック（`statusCategory`パラメータ）を使用しているため、修正の影響を受けない

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type FilterRequest
  OUTPUT: boolean
  
  // サイトフィルタまたは種別フィルタが指定されている場合にバグが発生
  RETURN (X.inquirySite IS NOT NULL) OR (X.propertyType IS NOT NULL) OR (X.statusFilter IS NOT NULL)
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - サイトフィルタの修正
FOR ALL X WHERE X.inquirySite IS NOT NULL DO
  result ← getSellers'(X)
  ASSERT ALL seller IN result SATISFY seller.site = X.inquirySite
END FOR

// Property: Fix Checking - 種別フィルタの修正
FOR ALL X WHERE X.propertyType IS NOT NULL DO
  result ← getSellers'(X)
  ASSERT ALL seller IN result SATISFY seller.種別 = X.propertyType
END FOR

// Property: Fix Checking - 状況（当社）フィルタの修正
FOR ALL X WHERE X.statusFilter IS NOT NULL DO
  result ← getSellers'(X)
  ASSERT ALL seller IN result SATISFY seller.status = X.statusFilter
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT getSellers(X) = getSellers'(X)
END FOR
```

**説明**:
- `getSellers`: 修正前の関数（間違ったカラム名を使用）
- `getSellers'`: 修正後の関数（正しいカラム名を使用）
- フィルタが指定されていない場合、修正前後で同じ結果を返すことを保証

---

## Counterexample

### 例1: サイトフィルタ「す」を選択

**入力**:
```typescript
{
  page: 1,
  pageSize: 50,
  inquirySite: 'す'
}
```

**現在の動作（バグ）**:
```sql
SELECT * FROM sellers WHERE inquiry_site = 'す'  -- inquiry_siteカラムは存在しない
-- 結果: 全てのデータが返される（フィルタが適用されない）
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers WHERE site = 'す'  -- siteカラムを使用
-- 結果: サイトが「す」の売主のみが返される
```

---

### 例2: 種別フィルタ「土地」を選択

**入力**:
```typescript
{
  page: 1,
  pageSize: 50,
  propertyType: '土地'
}
```

**現在の動作（バグ）**:
```sql
SELECT * FROM sellers WHERE property_type = '土地'  -- property_typeカラムは存在しない
-- 結果: 全てのデータが返される（フィルタが適用されない）
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers WHERE 種別 = '土地'  -- 種別カラム（日本語）を使用
-- 結果: 種別が「土地」の売主のみが返される
```

---

### 例3: 状況（当社）フィルタ「追客中」を選択

**入力**:
```typescript
{
  page: 1,
  pageSize: 50,
  statusFilter: '追客中'
}
```

**現在の動作（バグ）**:
```sql
SELECT * FROM sellers WHERE status ILIKE '%追客中%'  -- 部分一致検索
-- 結果: 「追客中」「追客不要(未訪問）」「除外済追客不要」など、意図しないデータも含まれる
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers WHERE status = '追客中'  -- 完全一致検索
-- 結果: 状況（当社）が「追客中」の売主のみが返される
```

---

## 修正対象ファイル

### バックエンド

**ファイル**: `backend/src/services/SellerService.supabase.ts`

**修正箇所**: `getSellers()` メソッド（Line 1224-1232付近）

**修正内容**:
1. `inquiry_site` → `site` に変更
2. `property_type` → `種別` に変更
3. `ilike('status', ...)` → `eq('status', ...)` に変更

---

## 関連ドキュメント

- `.kiro/steering/seller-table-column-definition.md` - 売主テーブルのカラム定義
- `.kiro/steering/seller-spreadsheet-column-mapping.md` - 売主スプレッドシートのカラムマッピング

---

**作成日**: 2026年3月25日  
**作成者**: Kiro AI  
**バグ報告者**: ユーザー
