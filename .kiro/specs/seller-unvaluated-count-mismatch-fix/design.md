# 売主リスト「未査定」カテゴリのカウント不一致修正 - 設計書

## Overview

売主リストページのサイドバー「⑤未査定」カテゴリのカウント（1件）と一覧表示件数（3件）が不一致になっている問題を修正します。

**根本原因**: `getSidebarCountsFallback()`メソッドが「当日TEL_未着手」の条件を満たす売主を未査定から除外しているが、`listSellers()`メソッドは除外していない。

**解決策**: `listSellers()`の未査定カテゴリフィルターに、「当日TEL_未着手」の条件を満たす売主を除外するロジックを追加する。

---

## Glossary

- **Bug_Condition (C)**: 未査定カテゴリを選択した場合にカウント不一致が発生する条件
- **Property (P)**: サイドバーのカウント数と一覧の表示件数が一致すること
- **Preservation**: 他のカテゴリのカウント精度とパフォーマンスが維持されること
- **getSidebarCountsFallback()**: サイドバーのカウント計算メソッド（`backend/src/services/SellerService.supabase.ts`）
- **listSellers()**: 一覧のフィルタリングメソッド（`backend/src/services/SellerService.supabase.ts`）
- **当日TEL_未着手**: 当日TEL分の条件を満たし、かつ不通が空欄で反響日付が2026/1/1以降の売主

---

## Bug Details

### Bug Condition

未査定カテゴリを選択した場合、サイドバーのカウント数（1件）と一覧の表示件数（3件）が不一致になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SellerListRequest
  OUTPUT: boolean
  
  RETURN input.statusCategory = 'unvaluated'
END FUNCTION
```

### Examples

**具体例1**: 売主AA13501
- 査定額1, 2, 3: 全て空欄
- 反響日付: 2025/12/15
- 査定不要: false
- 営担: 空欄
- 状況（当社）: 「追客中」
- 次電日: 2026/4/5以前
- 不通: 空欄
- 反響日付: 2026/1/1以降

**期待される動作**:
- サイドバー: カウントに含まれない（当日TEL_未着手が優先）
- 一覧: 表示されない（当日TEL_未着手が優先）

**実際の動作**（バグ）:
- サイドバー: カウントに含まれない ✅
- 一覧: 表示される ❌

**結果**: カウント不一致（サイドバー1件 vs 一覧3件）

---

**具体例2**: 売主AA13502
- 査定額1, 2, 3: 全て空欄
- 反響日付: 2025/12/15
- 査定不要: false
- 営担: 空欄
- 状況（当社）: 「追客中」
- 次電日: 2026/4/5以前
- 不通: 「不通」（入力あり）
- 反響日付: 2026/1/1以降

**期待される動作**:
- サイドバー: カウントに含まれる（不通があるため当日TEL_未着手ではない）
- 一覧: 表示される

**実際の動作**:
- サイドバー: カウントに含まれる ✅
- 一覧: 表示される ✅

**結果**: 正常動作

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のカテゴリ（「訪問日前日」「当日TEL分」など）のカウント精度は変わらない
- パフォーマンスは修正前と同等（100ms以内）を維持する
- 既存のキャッシュ機構（60秒TTL）は引き続き動作する

**Scope:**
未査定カテゴリ以外のカテゴリは完全に影響を受けない。

---

## Hypothesized Root Cause

### 根本原因

`getSidebarCountsFallback()`メソッドと`listSellers()`メソッドで、未査定カテゴリの判定ロジックが異なる。

#### getSidebarCountsFallback()の実装（正しい）

```typescript
// 5. 未査定
const { data: unvaluatedSellers } = await this.table('sellers')
  .select('id, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, mailing_status, inquiry_date, unreachable_status, confidence_level, exclusion_date, next_call_date, phone_contact_person, preferred_contact_time, contact_method')
  .is('deleted_at', null)
  .ilike('status', '%追客中%')
  .gte('inquiry_date', cutoffDate)
  .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す');

const unvaluatedCount = (unvaluatedSellers || []).filter(s => {
  const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
  const isNotRequired = s.mailing_status === '不要';
  if (!hasNoValuation || isNotRequired) return false;
  
  // 🚨 重要: 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
  const status = (s as any).status || '';
  const nextCallDate = (s as any).next_call_date || '';
  const hasInfo = ((s as any).phone_contact_person?.trim()) ||
                  ((s as any).preferred_contact_time?.trim()) ||
                  ((s as any).contact_method?.trim());
  const unreachable = (s as any).unreachable_status || '';
  const confidence = (s as any).confidence_level || '';
  const exclusionDate = (s as any).exclusion_date || '';
  const inquiryDate = (s as any).inquiry_date || '';
  
  const isTodayCallNotStarted = (
    status === '追客中' &&
    nextCallDate && nextCallDate <= todayJST &&
    !hasInfo &&
    !unreachable &&
    confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
    !exclusionDate &&
    inquiryDate >= '2026-01-01'
  );
  
  return !isTodayCallNotStarted;  // ← 当日TEL_未着手の場合は除外
}).length;
```

**ポイント**: 当日TEL_未着手の条件を満たす売主は未査定から除外される。

---

#### listSellers()の実装（間違い）

```typescript
case 'unvaluated':
  // 未査定（追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空（「外す」含む））
  query = query
    .ilike('status', '%追客中%')
    .gte('inquiry_date', cutoffDate)
    .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
    .is('valuation_amount_1', null)
    .is('valuation_amount_2', null)
    .is('valuation_amount_3', null)
    .or('mailing_status.is.null,mailing_status.neq.不要');
  break;
```

**問題**: 当日TEL_未着手の条件を満たす売主を除外していない。

---

### なぜこの違いが生まれたか

1. **getSidebarCountsFallback()**: 全フィールドを取得してJavaScriptで複雑な条件判定を行う
2. **listSellers()**: SQLクエリのみで条件を表現しようとしている

**当日TEL_未着手の条件**は複雑で、SQLクエリだけでは表現できない：
- `status === '追客中'`（完全一致）
- `nextCallDate <= todayJST`
- `!hasInfo`（3つのフィールドが全て空）
- `!unreachable`（空欄）
- `confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定'`
- `!exclusionDate`（空欄）
- `inquiryDate >= '2026-01-01'`

---

## Correctness Properties

Property 1: Bug Condition - 未査定カウント一致

_For any_ 売主リストリクエストで未査定カテゴリを選択した場合、サイドバーのカウント数と一覧の表示件数が完全に一致すること。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他のカテゴリの精度維持

_For any_ 未査定カテゴリ以外のカテゴリを選択した場合、サイドバーのカウント数と一覧の表示件数は修正前と同じであること。

**Validates: Requirements 3.1, 3.2, 3.3**

---

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerService.supabase.ts`

**Method**: `listSellers()`

**Specific Changes**:

#### 変更1: 未査定カテゴリのクエリを修正

**変更前**:
```typescript
case 'unvaluated':
  // 未査定（追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空（「外す」含む））
  query = query
    .ilike('status', '%追客中%')
    .gte('inquiry_date', cutoffDate)
    .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
    .is('valuation_amount_1', null)
    .is('valuation_amount_2', null)
    .is('valuation_amount_3', null)
    .or('mailing_status.is.null,mailing_status.neq.不要');
  break;
```

**変更後**:
```typescript
case 'unvaluated': {
  // 未査定（追客中 AND 査定額が全て空 AND 反響日付が基準日以降 AND 営担が空（「外す」含む））
  // 🚨 重要: 当日TEL_未着手の条件を満たす売主は除外する（getSidebarCountsFallback()と同じロジック）
  
  // まず全件取得（ページネーション対応）
  let unvaluatedCandidates: any[] = [];
  let uvPage = 0;
  const uvPageSize = 1000;
  
  while (true) {
    const { data, error } = await this.table('sellers')
      .select('id, status, valuation_amount_1, valuation_amount_2, valuation_amount_3, visit_assignee, mailing_status, inquiry_date, unreachable_status, confidence_level, exclusion_date, next_call_date, phone_contact_person, preferred_contact_time, contact_method')
      .is('deleted_at', null)
      .ilike('status', '%追客中%')
      .gte('inquiry_date', cutoffDate)
      .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
      .is('valuation_amount_1', null)
      .is('valuation_amount_2', null)
      .is('valuation_amount_3', null)
      .or('mailing_status.is.null,mailing_status.neq.不要')
      .range(uvPage * uvPageSize, (uvPage + 1) * uvPageSize - 1);
    
    if (error) {
      console.error('❌ unvaluatedCandidates取得エラー:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    unvaluatedCandidates = unvaluatedCandidates.concat(data);
    
    if (data.length < uvPageSize) break;
    uvPage++;
  }
  
  // JavaScriptで当日TEL_未着手の条件を満たす売主を除外
  const unvaluatedIds = unvaluatedCandidates.filter(s => {
    const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
    const isNotRequired = s.mailing_status === '不要';
    if (!hasNoValuation || isNotRequired) return false;
    
    // 当日TEL_未着手の条件を満たす場合は除外（未着手が優先）
    const status = s.status || '';
    const nextCallDate = s.next_call_date || '';
    const hasInfo = (s.phone_contact_person?.trim()) ||
                    (s.preferred_contact_time?.trim()) ||
                    (s.contact_method?.trim());
    const unreachable = s.unreachable_status || '';
    const confidence = s.confidence_level || '';
    const exclusionDate = s.exclusion_date || '';
    const inquiryDate = s.inquiry_date || '';
    
    const isTodayCallNotStarted = (
      status === '追客中' &&
      nextCallDate && nextCallDate <= todayJST &&
      !hasInfo &&
      !unreachable &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      !exclusionDate &&
      inquiryDate >= '2026-01-01'
    );
    
    return !isTodayCallNotStarted;
  }).map(s => s.id);
  
  console.log(`[unvaluated] matched IDs: ${unvaluatedIds.length}`);
  
  if (unvaluatedIds.length === 0) {
    query = query.in('id', ['__no_match__']);
  } else {
    query = query.in('id', unvaluatedIds);
  }
  break;
}
```

**変更のポイント**:
1. 全件取得してJavaScriptで条件判定（`getSidebarCountsFallback()`と同じアプローチ）
2. 当日TEL_未着手の条件を満たす売主を除外
3. 該当するIDのみをクエリに渡す

---

## Testing Strategy

### Validation Approach

修正後、サイドバーのカウント数と一覧の表示件数が一致することを確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで未査定カテゴリのカウント不一致を確認する。

**Test Plan**: 
1. 修正前のコードで売主リストページを開く
2. サイドバーの「⑤未査定」カテゴリのカウントを確認（1件）
3. 未査定カテゴリを選択して一覧を確認（3件表示）
4. カウント不一致を確認

**Expected Counterexamples**:
- サイドバー: 1件
- 一覧: 3件
- 不一致: 2件の差

---

### Fix Checking

**Goal**: 修正後のコードで未査定カテゴリのカウントが一致することを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  sidebarCount ← getSidebarCounts().unvaluated
  listResult ← listSellers(X)
  ASSERT sidebarCount = listResult.total
END FOR
```

**Test Plan**:
1. 修正後のコードで売主リストページを開く
2. サイドバーの「⑤未査定」カテゴリのカウントを確認
3. 未査定カテゴリを選択して一覧を確認
4. カウント数と表示件数が一致することを確認

**Expected Result**:
- サイドバー: 1件
- 一覧: 1件
- 一致: ✅

---

### Preservation Checking

**Goal**: 他のカテゴリのカウント精度が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Test Plan**:
1. 修正後のコードで売主リストページを開く
2. 他のカテゴリ（「訪問日前日」「当日TEL分」など）のカウントを確認
3. 各カテゴリを選択して一覧を確認
4. カウント数と表示件数が一致することを確認

**Test Cases**:
1. **訪問日前日**: サイドバーのカウント = 一覧の表示件数
2. **当日TEL分**: サイドバーのカウント = 一覧の表示件数
3. **当日TEL_未着手**: サイドバーのカウント = 一覧の表示件数

---

### Unit Tests

- 未査定カテゴリのフィルタリングロジックをテスト
- 当日TEL_未着手の条件を満たす売主が除外されることをテスト
- 当日TEL_未着手の条件を満たさない売主が含まれることをテスト

---

### Property-Based Tests

- ランダムな売主データを生成して、サイドバーのカウント数と一覧の表示件数が一致することをテスト
- 当日TEL_未着手の条件を満たす売主が正しく除外されることをテスト

---

### Integration Tests

- 売主リストページを開いて、未査定カテゴリのカウント数と一覧の表示件数が一致することをテスト
- 他のカテゴリのカウント精度が変わらないことをテスト

---

**作成日**: 2026年4月5日  
**作成者**: Kiro AI  
**ステータス**: Draft
