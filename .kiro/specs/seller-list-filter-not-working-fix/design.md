# 売主リストフィルタ不具合修正 設計書

## Overview

売主リスト一覧画面（SellersPage）のフィルタ機能が正しく動作していない問題を修正します。具体的には、サイトフィルタ、種別フィルタ、状況（当社）フィルタの3つのフィルタが間違ったカラム名または検索方法を使用しているため、期待通りの絞り込みが行われていません。

この修正により、ユーザーは正確に売主データをフィルタリングできるようになり、業務効率が向上します。

## Glossary

- **Bug_Condition (C)**: フィルタパラメータ（inquirySite, propertyType, statusFilter）が指定された場合に発生する不具合
- **Property (P)**: 修正後、指定されたフィルタ条件に完全一致する売主のみが返される
- **Preservation**: フィルタが指定されていない場合、または他のフィルタ（確度、検索、ページネーション等）の動作は変更されない
- **listSellers**: `backend/src/services/SellerService.supabase.ts`の売主一覧取得メソッド
- **inquiry_site**: 間違ったカラム名（存在しない）
- **site**: 正しいカラム名（スプレッドシートの「サイト」列に対応）
- **property_type**: 間違ったカラム名（存在しない）
- **種別**: 正しいカラム名（日本語カラム、スプレッドシートの「種別」列に対応）
- **ilike**: 部分一致検索（`LIKE '%value%'`）
- **eq**: 完全一致検索（`= 'value'`）

## Bug Details

### Bug Condition

フィルタ機能が正しく動作しないのは、以下の3つのケースです：

1. **サイトフィルタ**: 存在しないカラム名（`inquiry_site`）を使用
2. **種別フィルタ**: 存在しないカラム名（`property_type`）を使用
3. **状況（当社）フィルタ**: 部分一致検索（`ilike`）を使用しているため、意図しないデータも含まれる

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ListSellersParams
  OUTPUT: boolean
  
  RETURN (input.inquirySite IS NOT NULL)
         OR (input.propertyType IS NOT NULL)
         OR (input.statusFilter IS NOT NULL)
END FUNCTION
```

### Examples

#### 例1: サイトフィルタ「す」を選択

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
SELECT * FROM sellers WHERE inquiry_site = 'す'
-- inquiry_siteカラムは存在しないため、フィルタが適用されず全データが返される
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers WHERE site = 'す'
-- siteカラムを使用し、サイトが「す」の売主のみが返される
```

---

#### 例2: 種別フィルタ「土地」を選択

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
SELECT * FROM sellers WHERE property_type = '土地'
-- property_typeカラムは存在しないため、フィルタが適用されず全データが返される
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers WHERE 種別 = '土地'
-- 種別カラム（日本語）を使用し、種別が「土地」の売主のみが返される
```

---

#### 例3: 状況（当社）フィルタ「追客中」を選択

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
SELECT * FROM sellers WHERE status ILIKE '%追客中%'
-- 部分一致検索のため、「追客中」「追客不要(未訪問）」「除外済追客不要」など、意図しないデータも含まれる
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers WHERE status = '追客中'
-- 完全一致検索により、状況（当社）が「追客中」の売主のみが返される
```

---

#### 例4: 複数フィルタの組み合わせ

**入力**:
```typescript
{
  page: 1,
  pageSize: 50,
  inquirySite: 'す',
  propertyType: '土地',
  statusFilter: '追客中'
}
```

**期待される動作（修正後）**:
```sql
SELECT * FROM sellers 
WHERE site = 'す' 
  AND 種別 = '土地' 
  AND status = '追客中'
-- 全ての条件を満たす売主のみが返される（AND条件）
```

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 確度フィルタは引き続き正しく動作する（`confidence_level`カラムを使用）
- 検索機能は引き続き正しく動作する（別のAPIエンドポイント`/api/sellers/search`を使用）
- ページネーション機能は引き続き正しく動作する
- ソート機能は引き続き正しく動作する
- サイドバーカテゴリフィルタは引き続き正しく動作する（`statusCategory`パラメータを使用）

**Scope:**
フィルタパラメータ（inquirySite, propertyType, statusFilter）が指定されていない場合、または他のフィルタ（確度、検索、ページネーション等）を使用する場合は、修正の影響を受けません。

## Hypothesized Root Cause

バグの根本原因は以下の3つです：

1. **間違ったカラム名の使用（サイトフィルタ）**:
   - コード内で`inquiry_site`カラムを使用しているが、実際のデータベースには`site`カラムが存在する
   - スプレッドシートの「サイト」列は`site`カラムにマッピングされている
   - `.kiro/steering/seller-spreadsheet-column-mapping.md`に正しいマッピングが記載されている

2. **間違ったカラム名の使用（種別フィルタ）**:
   - コード内で`property_type`カラムを使用しているが、実際のデータベースには`種別`カラム（日本語）が存在する
   - スプレッドシートの「種別」列は`種別`カラムにマッピングされている
   - `.kiro/steering/seller-spreadsheet-column-mapping.md`に正しいマッピングが記載されている

3. **不適切な検索方法（状況（当社）フィルタ）**:
   - コード内で`ilike('status', '%追客中%')`を使用しているため、部分一致検索になっている
   - 「追客中」を選択した場合、「追客不要(未訪問）」「除外済追客不要」なども含まれてしまう
   - 完全一致検索（`eq('status', '追客中')`）を使用すべき

## Correctness Properties

Property 1: Bug Condition - サイトフィルタの修正

_For any_ リクエストでサイトフィルタ（inquirySite）が指定された場合、修正後のlistSellersメソッドは正しいカラム名（`site`）を使用してデータベースを検索し、指定されたサイトに完全一致する売主のみを返す。

**Validates: Requirements 2.1**

Property 2: Bug Condition - 種別フィルタの修正

_For any_ リクエストで種別フィルタ（propertyType）が指定された場合、修正後のlistSellersメソッドは正しいカラム名（`種別`）を使用してデータベースを検索し、指定された種別に完全一致する売主のみを返す。

**Validates: Requirements 2.2**

Property 3: Bug Condition - 状況（当社）フィルタの修正

_For any_ リクエストで状況（当社）フィルタ（statusFilter）が指定された場合、修正後のlistSellersメソッドは完全一致検索（`eq`）を使用してデータベースを検索し、指定された状況（当社）に完全一致する売主のみを返す。

**Validates: Requirements 2.3**

Property 4: Preservation - 他のフィルタの動作

_For any_ リクエストでフィルタパラメータ（inquirySite, propertyType, statusFilter）が指定されていない場合、または他のフィルタ（確度、検索、ページネーション等）を使用する場合、修正後のlistSellersメソッドは修正前と同じ結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

修正対象ファイル: `backend/src/services/SellerService.supabase.ts`

メソッド: `listSellers`（Line 980-1375付近）

**Specific Changes**:

1. **サイトフィルタの修正（Line 1224付近）**:
   ```typescript
   // ❌ 修正前
   if (inquirySite) {
     query = query.eq('inquiry_site', inquirySite);
   }
   
   // ✅ 修正後
   if (inquirySite) {
     query = query.eq('site', inquirySite);
   }
   ```

2. **種別フィルタの修正（Line 1227付近）**:
   ```typescript
   // ❌ 修正前
   if (propertyTypeFilter) {
     query = query.eq('property_type', propertyTypeFilter);
   }
   
   // ✅ 修正後
   if (propertyTypeFilter) {
     query = query.eq('種別', propertyTypeFilter);
   }
   ```

3. **状況（当社）フィルタの修正（Line 1230付近）**:
   ```typescript
   // ❌ 修正前
   if (statusFilter) {
     query = query.ilike('status', `%${statusFilter}%`);
   }
   
   // ✅ 修正後
   if (statusFilter) {
     query = query.eq('status', statusFilter);
   }
   ```

### 修正の影響範囲

**影響を受けるファイル**:
- `backend/src/services/SellerService.supabase.ts`（修正対象）

**影響を受けないファイル**:
- `frontend/frontend/src/pages/SellersPage.tsx`（フロントエンドは変更不要）
- `backend/src/routes/sellers.ts`（ルーティングは変更不要）
- 他のサービスファイル（変更不要）

**理由**: 
- フロントエンドは既に正しいパラメータ名（`inquirySite`, `propertyType`, `statusFilter`）を送信している
- バックエンドのカラム名のみを修正すれば、フロントエンドの変更は不要

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチを採用します：

1. **探索的バグ条件チェック**: 修正前のコードでテストを実行し、バグが再現されることを確認
2. **修正検証**: 修正後のコードでテストを実行し、フィルタが正しく動作することを確認
3. **保存検証**: 他のフィルタや機能が影響を受けていないことを確認

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する

**Test Plan**: 各フィルタ（サイト、種別、状況（当社））を個別にテストし、修正前のコードで期待通りに動作しないことを確認する

**Test Cases**:
1. **サイトフィルタテスト**: サイト「す」を指定してAPIを呼び出し、全データが返されることを確認（修正前は失敗）
2. **種別フィルタテスト**: 種別「土地」を指定してAPIを呼び出し、全データが返されることを確認（修正前は失敗）
3. **状況（当社）フィルタテスト**: 状況（当社）「追客中」を指定してAPIを呼び出し、意図しないデータ（「追客不要(未訪問）」等）も含まれることを確認（修正前は失敗）
4. **複数フィルタテスト**: サイト「す」AND種別「土地」を指定してAPIを呼び出し、フィルタが適用されないことを確認（修正前は失敗）

**Expected Counterexamples**:
- サイトフィルタ: `inquiry_site`カラムが存在しないため、フィルタが適用されない
- 種別フィルタ: `property_type`カラムが存在しないため、フィルタが適用されない
- 状況（当社）フィルタ: 部分一致検索のため、意図しないデータも含まれる

### Fix Checking

**Goal**: 修正後のコードで、フィルタ条件が指定された場合に正しく絞り込みが行われることを確認

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := listSellers_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. **サイトフィルタ修正検証**: サイト「す」を指定してAPIを呼び出し、サイトが「す」の売主のみが返されることを確認
2. **種別フィルタ修正検証**: 種別「土地」を指定してAPIを呼び出し、種別が「土地」の売主のみが返されることを確認
3. **状況（当社）フィルタ修正検証**: 状況（当社）「追客中」を指定してAPIを呼び出し、状況（当社）が「追客中」の売主のみが返されることを確認
4. **複数フィルタ修正検証**: サイト「す」AND種別「土地」AND状況（当社）「追客中」を指定してAPIを呼び出し、全ての条件を満たす売主のみが返されることを確認

### Preservation Checking

**Goal**: フィルタが指定されていない場合、または他のフィルタを使用する場合、修正前後で同じ結果が返されることを確認

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT listSellers_original(input) = listSellers_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは推奨されますが、今回の修正は単純なカラム名の変更のため、手動テストでも十分です。

**Test Plan**: 修正前のコードで各機能が正しく動作することを確認し、修正後も同じ動作を維持することを確認する

**Test Cases**:
1. **確度フィルタ保存検証**: 確度「A」を指定してAPIを呼び出し、修正前後で同じ結果が返されることを確認
2. **検索機能保存検証**: 名前「田中」で検索し、修正前後で同じ結果が返されることを確認
3. **ページネーション保存検証**: ページ2を指定してAPIを呼び出し、修正前後で同じ結果が返されることを確認
4. **ソート機能保存検証**: 反響日付の昇順でソートし、修正前後で同じ結果が返されることを確認
5. **サイドバーカテゴリ保存検証**: 「①訪問日前日」カテゴリを選択し、修正前後で同じ結果が返されることを確認

### Unit Tests

- サイトフィルタが正しいカラム名（`site`）を使用することをテスト
- 種別フィルタが正しいカラム名（`種別`）を使用することをテスト
- 状況（当社）フィルタが完全一致検索（`eq`）を使用することをテスト
- 複数フィルタのAND条件が正しく動作することをテスト

### Property-Based Tests

- ランダムなフィルタ条件を生成し、修正後のコードが正しく絞り込みを行うことを検証
- フィルタが指定されていない場合、修正前後で同じ結果が返されることを検証
- 複数フィルタの組み合わせが正しくAND条件で動作することを検証

### Integration Tests

- フロントエンドからAPIを呼び出し、フィルタが正しく動作することを確認
- 複数のフィルタを組み合わせて使用し、期待通りの結果が返されることを確認
- 他の機能（検索、ページネーション、ソート等）が影響を受けていないことを確認
