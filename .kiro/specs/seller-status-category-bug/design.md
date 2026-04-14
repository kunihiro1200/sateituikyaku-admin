# seller-status-category-bug バグ修正デザイン

## Overview

売主リストサイドバーにおいて、`exclusion_date`（除外日）が設定されている売主（例: AA13967）が「⑦当日TEL_未着手」ではなく「⑤未査定」に誤って表示されるバグを修正する。

根本原因は `isTodayCallNotStarted()` 関数（フロントエンド）および `todayCallNotStartedCount` 計算ロジック（バックエンド2箇所）において、`exclusion_date` のチェックが欠落していることである。修正は最小限の条件追加で対応する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `exclusion_date` が設定されているにもかかわらず `isTodayCallNotStarted()` が `true` を返す状態
- **Property (P)**: 期待される正しい動作 — `exclusion_date` が設定されている売主は `isTodayCallNotStarted()` が `false` を返し、「⑦当日TEL_未着手」に含まれない
- **Preservation**: 修正によって変更してはならない既存の動作 — `exclusion_date` を持たない売主の各カテゴリ分類が変わらないこと
- **isTodayCallNotStarted**: `frontend/frontend/src/utils/sellerStatusFilters.ts` 内の関数。売主が「⑦当日TEL_未着手」カテゴリに該当するかを判定する
- **todayCallNotStartedCount**: バックエンドで計算される「⑦当日TEL_未着手」カテゴリのカウント値
- **exclusion_date**: 売主テーブルの `exclusion_date` カラム。除外日が設定されている売主はカテゴリ判定から除外される
- **isUnvaluated**: `sellerStatusFilters.ts` 内の関数。`isTodayCallNotStarted()` が `true` の場合に `false` を返す除外ロジックを持つ

## Bug Details

### Bug Condition

`exclusion_date` が設定されている売主が「⑦当日TEL_未着手」の他の条件（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし + 不通が空欄 + 反響日付が2026/1/1以降）を満たす場合、`isTodayCallNotStarted()` が誤って `true` を返す。その結果、`isUnvaluated()` の除外ロジック（`if (isTodayCallNotStarted(seller)) return false`）が機能せず、「⑤未査定」に誤って表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  RETURN seller.exclusion_date IS NOT NULL
         AND seller.exclusion_date != ""
         AND isTodayCallBase(seller) == true
         AND seller.status == "追客中"
         AND seller.unreachable_status == ""
         AND seller.confidence_level NOT IN ["ダブり", "D", "AI査定"]
         AND seller.inquiry_date >= "2026-01-01"
END FUNCTION
```

### Examples

- **AA13967（バグ再現例）**: `exclusion_date` が設定されており、「当日TEL_未着手」の他の条件を全て満たす → 現状は「⑤未査定」に表示されるが、本来はどちらにも表示されないべき
- **exclusion_date あり + 未査定条件を満たす**: 「⑤未査定」にも「⑦当日TEL_未着手」にも表示されないべき
- **exclusion_date あり + 未査定条件を満たさない**: どのカテゴリにも表示されないべき
- **exclusion_date なし + 当日TEL_未着手の全条件を満たす**: 「⑦当日TEL_未着手」に正しく表示される（変更なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `exclusion_date` を持たない売主の「⑦当日TEL_未着手」カテゴリへの表示は変わらない
- `exclusion_date` を持たない売主の「⑤未査定」カテゴリへの表示は変わらない
- `unreachable_status`（不通）に値がある売主は「⑦当日TEL_未着手」に表示されない（変更なし）
- `confidence_level` が「ダブり」「D」「AI査定」の売主は「⑦当日TEL_未着手」に表示されない（変更なし）
- `inquiry_date` が2026/1/1より前の売主は「⑦当日TEL_未着手」に表示されない（変更なし）
- マウスクリックによるボタン操作など、カテゴリ判定以外の動作は一切変わらない

**Scope:**
`exclusion_date` が空または未設定の売主に対しては、この修正は完全に無影響である。

## Hypothesized Root Cause

コードのコメントには「除外日にすること = ""（空）」という条件が記載されているが、実装コードにはそのチェックが存在しない。

1. **フロントエンド `isTodayCallNotStarted()` の欠落**: `sellerStatusFilters.ts` の `isTodayCallNotStarted()` 関数に `exclusion_date` チェックが実装されていない。コメントには条件として記載されているが、コードに反映されていない。

2. **バックエンド `SellerSidebarCountsUpdateService.ts` の欠落**: `todayCallNotStartedCount` 計算ロジックに `exclusion_date` チェックが存在しない。フロントエンドと同じ条件で計算すべきところ、この条件が抜けている。

3. **バックエンド `SellerService.supabase.ts` の欠落**: `getSidebarCountsFallback` の `todayCallNotStartedCount` 計算にも同様に `exclusion_date` チェックが存在しない（ただし、このファイルには既に `exclusionDate` 変数の宣言はあるが、チェックが欠落している）。

## Correctness Properties

Property 1: Bug Condition - exclusion_date を持つ売主は当日TEL_未着手から除外される

_For any_ 売主において `exclusion_date` が設定されている（空でない）場合、修正後の `isTodayCallNotStarted()` 関数は `false` を返し、その売主は「⑦当日TEL_未着手」カテゴリに含まれない。また、`isUnvaluated()` の除外ロジックが正しく機能し、「⑤未査定」への誤表示も発生しない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - exclusion_date を持たない売主の動作は変わらない

_For any_ 売主において `exclusion_date` が空または未設定の場合、修正後のコードは修正前のコードと全く同じ結果を返し、「⑦当日TEL_未着手」「⑤未査定」を含む全カテゴリの分類が変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

修正は3箇所に対して、それぞれ `exclusion_date` チェックを1行追加するだけである。

---

**File 1**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `isTodayCallNotStarted()`

**Specific Changes**:
1. **exclusion_date チェックを追加**: 不通チェックの直後に以下を追加する
   ```typescript
   // 除外日が設定されている場合は除外
   const exclusionDate = seller.exclusionDate || seller.exclusion_date || '';
   if (exclusionDate && exclusionDate.trim() !== '') {
     return false;
   }
   ```

---

**File 2**: `backend/src/services/SellerSidebarCountsUpdateService.ts`

**Function**: `updateSellerSidebarCounts()` 内の `todayCallNotStartedCount` 計算

**Specific Changes**:
1. **exclusion_date チェックを追加**: `inquiryDate` チェックの前に以下を追加する
   ```typescript
   const exclusionDate = (s as any).exclusion_date || '';
   if (exclusionDate && exclusionDate.trim() !== '') return false;
   ```

---

**File 3**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSidebarCountsFallback()` 内の `todayCallNotStartedCount` 計算

**Specific Changes**:
1. **exclusion_date チェックを追加**: 既存の `exclusionDate` 変数宣言の後に実際のチェックを追加する
   ```typescript
   const exclusionDate = (s as any).exclusion_date || '';
   if (exclusionDate && exclusionDate.trim() !== '') return false;
   ```
   （注: このファイルには既に `exclusionDate` 変数の宣言があるが、`if` チェックが欠落している）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず修正前のコードでバグを再現するテストを実行し、根本原因を確認する。次に修正後のコードでバグが解消され、既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `exclusion_date` が設定された売主データを用意し、`isTodayCallNotStarted()` が `true` を返すことを確認する。また `isUnvaluated()` が `true` を返すことも確認する。

**Test Cases**:
1. **exclusion_date あり + 当日TEL_未着手の全条件を満たす**: `isTodayCallNotStarted()` が `true` を返す（修正前は失敗するべき動作）
2. **AA13967相当のデータ**: 「⑤未査定」に誤って分類されることを確認
3. **exclusion_date あり + 不通あり**: `isTodayCallNotStarted()` が `false` を返す（不通チェックで除外される）
4. **exclusion_date なし + 当日TEL_未着手の全条件を満たす**: `isTodayCallNotStarted()` が `true` を返す（正常動作）

**Expected Counterexamples**:
- `exclusion_date` が設定されているにもかかわらず `isTodayCallNotStarted()` が `true` を返す
- 原因: `isTodayCallNotStarted()` に `exclusion_date` チェックが存在しない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全入力に対して期待される動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := isTodayCallNotStarted_fixed(seller)
  ASSERT result == false
  
  unvaluatedResult := isUnvaluated_fixed(seller)
  ASSERT unvaluatedResult == false  // 未査定条件を満たさない場合
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない全入力に対して修正前と同じ結果が得られることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT isTodayCallNotStarted_original(seller) == isTodayCallNotStarted_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由:
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- `exclusion_date` が空/null/未設定の全パターンを網羅できる

**Test Cases**:
1. **exclusion_date なし + 当日TEL_未着手の全条件を満たす**: 修正後も `isTodayCallNotStarted()` が `true` を返す
2. **exclusion_date なし + 不通あり**: 修正後も `isTodayCallNotStarted()` が `false` を返す
3. **exclusion_date なし + 未査定条件を満たす**: 修正後も `isUnvaluated()` が `true` を返す
4. **exclusion_date なし + 確度が「ダブり」**: 修正後も `isTodayCallNotStarted()` が `false` を返す

### Unit Tests

- `isTodayCallNotStarted()` に `exclusion_date` が設定された売主を渡し、`false` が返ることを確認
- `isTodayCallNotStarted()` に `exclusion_date` が空の売主を渡し、既存の動作が変わらないことを確認
- `isUnvaluated()` が `exclusion_date` あり売主に対して正しく動作することを確認
- バックエンドの `todayCallNotStartedCount` 計算が `exclusion_date` を正しく除外することを確認

### Property-Based Tests

- ランダムな売主データを生成し、`exclusion_date` が設定されている場合は常に `isTodayCallNotStarted()` が `false` を返すことを検証
- ランダムな売主データを生成し、`exclusion_date` が空の場合は修正前後で `isTodayCallNotStarted()` の結果が変わらないことを検証
- 多数のシナリオにわたって、各カテゴリのカウントが一致することを検証

### Integration Tests

- AA13967相当のデータを使用して、サイドバーの表示が「⑦当日TEL_未着手」でも「⑤未査定」でもないことを確認
- `exclusion_date` を持たない売主が引き続き正しいカテゴリに表示されることを確認
- フロントエンドとバックエンドのカウントが一致することを確認
