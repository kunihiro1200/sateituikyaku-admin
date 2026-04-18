# Seller Sidebar Today TEL Filter Bug - Bugfix Design

## Overview

売主リストのサイドバー「当日TEL分」カテゴリーに、状況（当社）フィールドに「追客不要」を含む売主が表示されてしまうバグの修正設計。

「追客不要」「除外済追客不要」等のステータスを持つ売主は架電対象外であるため、「当日TEL分」から除外しなければならない。

バグの根本原因は `SellerSidebarCountsUpdateService.ts` のカウント計算ロジックにある。
`todayCallBaseResult1` クエリが `.ilike('status', '%追客中%')` で取得しているため、
「追客不要」「除外済追客不要」等の「追客中」を部分文字列として含むステータスも一致してしまう。
その後の `filteredTodayCallSellers` フィルタでは `visit_assignee` のチェックのみ行われており、
`status.includes('追客不要')` の除外処理が欠落している。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 状況（当社）に「追客不要」を含む売主が「当日TEL分」カテゴリーに含まれること
- **Property (P)**: 期待される正しい動作 — 「追客不要」を含む売主は「当日TEL分」カテゴリーから除外されること
- **Preservation**: 修正によって変更してはならない既存の動作 — 「追客不要」を含まない通常ステータスの売主の表示件数
- **`filteredTodayCallSellers`**: `SellerSidebarCountsUpdateService.ts` 内で「当日TEL分」カウントの基底となる配列。`todayCallBaseSellers` から `visit_assignee` が空の売主のみを抽出したもの
- **`todayCallBaseResult1`**: `ilike('status', '%追客中%')` で取得した売主データ。「追客不要」も誤って含まれる
- **`status`**: DBカラム `status`（スプレッドシート「状況（当社）」）。売主の現在の追客状況を示す文字列

## Bug Details

### Bug Condition

バグは `SellerSidebarCountsUpdateService.ts` の `filteredTodayCallSellers` 生成ロジックで発生する。
DBクエリで `.ilike('status', '%追客中%')` を使用しているため、「追客不要」「除外済追客不要」等の
「追客中」を部分文字列として含むステータスも取得対象になってしまう。
その後の JS フィルタで `visit_assignee` のチェックのみ行われ、`追客不要` の除外が行われていない。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type SellerRecord
  OUTPUT: boolean

  status = seller.status OR ''
  RETURN status.includes('追客不要')
         AND seller is included in filteredTodayCallSellers
END FUNCTION
```

### Examples

- 状況（当社）= `追客不要`、次電日 = 今日以前 → 「当日TEL分」に表示されてしまう（バグ）
- 状況（当社）= `除外済追客不要`、次電日 = 今日以前 → 「当日TEL分」に表示されてしまう（バグ）
- 状況（当社）= `追客中`、次電日 = 今日以前 → 「当日TEL分」に正しく表示される（正常）
- 状況（当社）= `追客不要`、次電日 = 今日以前 → 「当日TEL分」から除外されるべき（期待動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 状況（当社）が「追客不要」を含まない通常ステータス（「追客中」「他決→追客」等）の売主は、引き続き「当日TEL分」に表示されること
- 「当日TEL分」以外のサイドバーカテゴリー（訪問日前日、訪問済み、当日TEL（担当）、未査定等）の件数は変化しないこと
- 「追客不要」を含む売主の「当日TEL分」以外のカテゴリーへの表示には影響しないこと

**Scope:**
「追客不要」を含まない全ての売主の動作は、この修正によって一切変更されてはならない。

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **DBクエリの部分一致問題**: `todayCallBaseResult1` クエリが `.ilike('status', '%追客中%')` を使用しているため、「追客不要」「除外済追客不要」等の「追客中」を部分文字列として含むステータスも取得対象になる

2. **JSフィルタの除外条件欠落**: `filteredTodayCallSellers` の生成時に `visit_assignee` のチェックのみ行われており、`status.includes('追客不要')` の除外処理が欠落している

3. **`SellerService.supabase.ts` の `todayCall` ケースとの不整合**: `SellerService.supabase.ts` の `todayCall` ケースでは JSフィルタ内で `status.includes('追客不要')` の除外が正しく実装されているが、`SellerSidebarCountsUpdateService.ts` の `filteredTodayCallSellers` では同等の除外処理が行われていない

## Correctness Properties

Property 1: Bug Condition - 追客不要ステータスの除外

_For any_ 売主において、状況（当社）に「追客不要」が含まれる場合（isBugCondition が true を返す場合）、
修正後の `filteredTodayCallSellers` はその売主を含んではならない。
結果として「当日TEL分」「当日TEL（内容）」「当日TEL_未着手」「Pinrich空欄」のカウントにも含まれてはならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 通常ステータスの売主への影響なし

_For any_ 売主において、状況（当社）に「追客不要」が含まれない場合（isBugCondition が false を返す場合）、
修正後の `filteredTodayCallSellers` は修正前と同じ結果を返さなければならない。
「当日TEL分」カテゴリーへの表示件数は変化してはならない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerSidebarCountsUpdateService.ts`

**Specific Changes**:

1. **`filteredTodayCallSellers` フィルタに「追客不要」除外条件を追加**:
   ```typescript
   const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
     // 追客不要を含むステータスを除外（架電対象外）
     const status = s.status || '';
     if (status.includes('追客不要')) return false;
     return !hasValidVisitAssignee(s.visit_assignee);
   });
   ```

   これにより、`todayCallWithInfoSellers`、`todayCallNoInfoCount`、`todayCallNotStartedCount`、`pinrichEmptyCount` の全てに除外が波及する。

**参考**: `SellerService.supabase.ts` の `todayCall` ケース（行 1299-1303）では既に同様の除外処理が実装されている：
```typescript
// 追客不要、専任媒介、一般媒介を除外
if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) {
  return false;
}
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず修正前のコードでバグを再現するテストを実行し、次に修正後のコードで正しい動作を確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 「追客不要」ステータスの売主データを用意し、`filteredTodayCallSellers` に含まれることを確認する。修正前のコードで実行してバグを観察する。

**Test Cases**:
1. **追客不要の除外テスト**: 状況（当社）= `追客不要`、次電日 = 今日以前の売主が `filteredTodayCallSellers` に含まれることを確認（修正前は FAIL）
2. **除外済追客不要の除外テスト**: 状況（当社）= `除外済追客不要`、次電日 = 今日以前の売主が `filteredTodayCallSellers` に含まれることを確認（修正前は FAIL）
3. **通常ステータスの保全テスト**: 状況（当社）= `追客中`、次電日 = 今日以前の売主が `filteredTodayCallSellers` に含まれることを確認（修正前後ともに PASS）

**Expected Counterexamples**:
- 「追客不要」ステータスの売主が `filteredTodayCallSellers` に含まれる
- 原因: `filteredTodayCallSellers` フィルタに `status.includes('追客不要')` の除外処理が欠落

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して期待動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := filteredTodayCallSellers_fixed
  ASSERT seller NOT IN result
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない全ての入力に対して動作が変化しないことを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT filteredTodayCallSellers_original(seller) = filteredTodayCallSellers_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様なステータス値を自動生成し、「追客不要」を含まない全ての売主に対して動作が変化しないことを検証できる。

**Test Cases**:
1. **通常ステータス保全**: `追客中`、`他決→追客`、`除外後追客中` 等のステータスを持つ売主の件数が変化しないことを確認
2. **カテゴリー件数保全**: 「当日TEL分」以外のカテゴリー（訪問日前日、訪問済み等）の件数が変化しないことを確認
3. **他カテゴリーへの影響なし**: 「追客不要」ステータスの売主が他のカテゴリーに影響しないことを確認

### Unit Tests

- `filteredTodayCallSellers` フィルタが「追客不要」を含む売主を除外することを確認
- 「除外済追客不要」等の部分一致ケースも除外されることを確認
- 「追客中」「他決→追客」等の通常ステータスは除外されないことを確認

### Property-Based Tests

- ランダムなステータス値を生成し、「追客不要」を含む場合は必ず除外されることを確認
- 「追客不要」を含まないステータスでは修正前後で同じ結果になることを確認
- 多様な売主データセットで `filteredTodayCallSellers` の件数が正しいことを確認

### Integration Tests

- 実際のDBデータを使用して「当日TEL分」カウントが正しいことを確認
- 「追客不要」ステータスの売主が「当日TEL分」サイドバーに表示されないことを確認
- 修正後も「追客中」ステータスの売主が正しく「当日TEL分」に表示されることを確認
