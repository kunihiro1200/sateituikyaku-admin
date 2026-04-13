# seller-sidebar-count-mismatch-fix バグ修正デザイン

## Overview

売主リストのサイドバーにおいて、カウント数とクリック時のリスト件数が一致しない問題を修正する。

根本原因は `SellerSidebarCountsUpdateService`（カウント計算）と `SellerService.listSellers()`（フィルタリング）の2つのロジックが独立して実装されており、以下の3点で条件が一致していないことにある：

1. `todayCallNotStarted`（当日TEL_未着手）の判定条件の差異（`exclusion_date` チェックの有無）
2. `todayCall`（当日TEL分）での未着手売主の除外漏れ（`unreachable_status`, `confidence_level`, `inquiry_date` チェックなし）
3. `unvaluated`（未査定）での `isTodayCallNotStarted` 判定条件の差異（`exclusion_date` チェックの有無）

修正方針は、`listSellers()` のフィルタリング条件を `SellerSidebarCountsUpdateService` のカウント計算条件と完全に一致させることで、カウントとリスト件数を常に同一にする。

## Glossary

- **Bug_Condition (C)**: カウント計算とフィルタリングの条件が一致しない状態 — 同一の売主に対して2つのロジックが異なる判定を下す
- **Property (P)**: 任意のカテゴリでカウントN件と表示されているとき、クリック後のリストもちょうどN件であること
- **Preservation**: 修正対象外カテゴリ（`visitDayBefore`, `visitCompleted`, `todayCallAssigned`, `todayCallWithInfo`, `mailingPending`, `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`, `visitAssigned:xxx`）の動作が変わらないこと
- **filteredTodayCallSellers**: `SellerSidebarCountsUpdateService` 内で `hasValidVisitAssignee=false` の売主を抽出した中間集合（`todayCall`, `todayCallNotStarted`, `pinrichEmpty` の基底集合）
- **isTodayCallNotStarted**: 当日TEL_未着手の判定条件（`status === '追客中'` + `next_call_date <= today` + コミュニケーション情報なし + `unreachable_status` 空 + `confidence_level` が「ダブり」「D」「AI査定」でない + `inquiry_date >= '2026-01-01'`）
- **todayJST**: JST基準の今日の日付文字列（`YYYY-MM-DD`形式）

## Bug Details

### Bug Condition

カウント計算（`SellerSidebarCountsUpdateService.updateSellerSidebarCounts()`）とフィルタリング（`SellerService.listSellers()`）の条件が一致しないとき、バグが発現する。

**Formal Specification:**
```
FUNCTION isBugCondition(seller, category)
  INPUT: seller（売主データ）, category（サイドバーカテゴリ）
  OUTPUT: boolean

  countResult := countCategory(seller, category)   // カウント計算での判定
  filterResult := filterCategory(seller, category) // フィルタリングでの判定

  RETURN countResult != filterResult
END FUNCTION
```

### 具体的な差異

#### 差異1: `todayCallNotStarted` の `exclusion_date` チェック

| | カウント計算 | フィルタリング |
|---|---|---|
| `exclusion_date` チェック | **なし** | `!exclusionDate` を追加チェック |

カウント計算の `todayCallNotStartedCount` では `exclusion_date` を確認しない。フィルタリングの `todayCallNotStarted` ケースでは `exclusion_date` が空であることを追加条件としている。

#### 差異2: `todayCall` での未着手売主の除外

| | カウント計算 | フィルタリング |
|---|---|---|
| `unreachable_status` チェック | **あり** | **なし** |
| `confidence_level` チェック | **あり** | **なし** |
| `inquiry_date >= '2026-01-01'` チェック | **あり** | **なし** |

カウント計算の `todayCallNoInfoCount` では `isNotStarted` 条件を満たす売主を除外する。フィルタリングの `todayCall` ケースでは `unreachable_status`, `confidence_level`, `inquiry_date` を確認せず、未着手売主が除外されない。

#### 差異3: `unvaluated` の `isTodayCallNotStarted` 判定

| | カウント計算 | フィルタリング |
|---|---|---|
| `exclusion_date` チェック | **なし** | `!exclusionDate` を追加チェック |

カウント計算の `unvaluatedCount` では `isTodayCallNotStarted` 判定に `exclusion_date` を含まない。フィルタリングの `unvaluated` ケースでは `!exclusionDate` を追加チェックしている。

### Examples

- **例1（差異2）**: `status='追客中'`, `next_call_date='2026-01-15'`, `unreachable_status='不通'`, `inquiry_date='2026-02-01'` の売主 → カウント計算では `isNotStarted=false`（`unreachable_status` あり）なので `todayCall` にカウントされる。フィルタリングでも `todayCall` に含まれる（一致）。しかし `unreachable_status` チェックがないため、別の売主で `unreachable_status` が空の場合に `isNotStarted=true` となりカウントから除外されるが、フィルタには残る（不一致）。
- **例2（差異1）**: `status='追客中'`, `next_call_date='2026-01-15'`, `exclusion_date='2026-03-01'`, `inquiry_date='2026-02-01'` の売主 → カウント計算では `todayCallNotStarted` にカウントされる（`exclusion_date` チェックなし）。フィルタリングでは `exclusionDate` があるため除外される（不一致）。
- **例3（差異3）**: `status='追客中'`, `inquiry_date='2026-02-01'`, `exclusion_date='2026-03-01'`, 査定額なし, 営担なし の売主 → カウント計算では `isTodayCallNotStarted=false`（`exclusion_date` チェックなし）なので `unvaluated` にカウントされる。フィルタリングでは `!exclusionDate` が false なので `isTodayCallNotStarted=true` と判定され除外される（不一致）。

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `visitDayBefore`（訪問日前日）のフィルタリング動作
- `visitCompleted`（訪問済み）のフィルタリング動作
- `todayCallAssigned`（当日TEL担当）のフィルタリング動作
- `todayCallWithInfo`（当日TEL内容）のフィルタリング動作
- `mailingPending`（査定郵送）のフィルタリング動作
- `exclusive`（専任）・`general`（一般）・`visitOtherDecision`・`unvisitedOtherDecision` のフィルタリング動作
- `visitAssigned:xxx`（担当者別）のフィルタリング動作
- カテゴリなし（全件表示）の動作

**スコープ:**
修正対象は `todayCall`, `todayCallNotStarted`, `unvaluated` の3カテゴリのみ。それ以外のカテゴリは一切変更しない。

## Hypothesized Root Cause

1. **独立した実装**: `SellerSidebarCountsUpdateService` と `SellerService.listSellers()` が独立して実装されており、共通のロジックを共有していない。一方を修正しても他方に反映されない構造になっている。

2. **`todayCall` での除外ロジック未実装**: `listSellers()` の `todayCall` ケースは、カウント計算で行われている `isNotStarted` 判定（`unreachable_status`, `confidence_level`, `inquiry_date` チェック）を実装していない。コメントには「未着手を除外する」旨の記述がないため、意図的な省略か実装漏れかが不明。

3. **`exclusion_date` チェックの非対称性**: `todayCallNotStarted` と `unvaluated` のフィルタリングでは `exclusion_date` チェックが追加されているが、カウント計算側にはない。どちらが正しい仕様かを確認する必要がある。

4. **段階的な修正の積み重ね**: コードコメントに「🔧 修正: カウント計算と条件を一致させる」という記述が複数あり、過去に部分的な修正が行われてきたことがわかる。その過程で `exclusion_date` チェックが片方にのみ追加された可能性がある。

## Correctness Properties

Property 1: Bug Condition - カウントとリスト件数の一致

_For any_ サイドバーカテゴリ（`todayCall`, `todayCallNotStarted`, `unvaluated`）において、`SellerSidebarCountsUpdateService` がカウントNを計算した場合、`listSellers({ statusCategory })` が返す売主リストもちょうどN件であること。すなわち、カウント計算でそのカテゴリに含まれる売主の集合と、フィルタリングで返される売主の集合が完全に一致すること。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 修正対象外カテゴリの動作維持

_For any_ 修正対象外カテゴリ（`visitDayBefore`, `visitCompleted`, `todayCallAssigned`, `todayCallWithInfo`, `mailingPending`, `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`, `visitAssigned:xxx`）において、修正前後で `listSellers()` が返す売主リストが完全に同一であること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

Property 3: Preservation - 排他的カテゴリ所属

_For any_ 売主において、`todayCallNotStarted`, `todayCall`, `unvaluated` の3カテゴリのうち、最大1つのカテゴリにのみ属すること（重複カウント・重複表示なし）。優先順位は `todayCallNotStarted > unvaluated > todayCall`。

**Validates: Requirements 2.6**

## Fix Implementation

### 修正方針

`SellerSidebarCountsUpdateService` のカウント計算を「正」として、`listSellers()` のフィルタリング条件をそれに合わせる。

**ファイル**: `backend/src/services/SellerService.supabase.ts`

### 修正1: `todayCall` ケースへの未着手除外ロジック追加

**現状**: `unreachable_status`, `confidence_level`, `inquiry_date` をチェックせず、未着手売主が除外されない。

**修正内容**: JSフィルタ内の `isNotStarted` 判定を追加し、未着手条件を満たす売主を除外する。

```typescript
// 修正前（todayCallIds フィルタ内）
const hasInfo = ...;
return !hasInfo;

// 修正後
const hasInfo = ...;
if (hasInfo) return false;

// 未着手条件を満たす売主は todayCallNotStarted に分類されるため除外
const unreachable = s.unreachable_status || '';
const confidence = s.confidence_level || '';
const inquiryDate = s.inquiry_date || '';
const isNotStarted = status === '追客中' &&
  !unreachable &&
  confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
  inquiryDate >= '2026-01-01';
return !isNotStarted;
```

ただし、`todayCall` のクエリで `unreachable_status`, `confidence_level`, `inquiry_date` を SELECT に追加する必要がある。

### 修正2: `todayCallNotStarted` の `exclusion_date` チェック削除

**現状**: フィルタリングでは `exclusion_date` が空であることを追加条件としているが、カウント計算にはない。

**修正内容**: カウント計算に合わせて `exclusion_date` チェックを削除する。

```typescript
// 修正前
const isTodayCallNotStarted = (
  status === '追客中' &&
  nextCallDate && nextCallDate <= todayJST &&
  !hasInfo &&
  !unreachable &&
  confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
  !exclusionDate &&  // ← 削除
  inquiryDate >= '2026-01-01'
);

// 修正後
const isTodayCallNotStarted = (
  status === '追客中' &&
  nextCallDate && nextCallDate <= todayJST &&
  !hasInfo &&
  !unreachable &&
  confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
  inquiryDate >= '2026-01-01'
);
```

### 修正3: `unvaluated` の `isTodayCallNotStarted` 判定の `exclusion_date` チェック削除

**現状**: フィルタリングでは `!exclusionDate` を追加チェックしているが、カウント計算にはない。

**修正内容**: カウント計算に合わせて `!exclusionDate` チェックを削除する。

```typescript
// 修正前
const isTodayCallNotStarted = (
  status === '追客中' &&
  nextCallDate && nextCallDate <= todayJST &&
  !hasInfo &&
  !unreachable &&
  confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
  !exclusionDate &&  // ← 削除
  inquiryDate >= '2026-01-01'
);

// 修正後
const isTodayCallNotStarted = (
  status === '追客中' &&
  nextCallDate && nextCallDate <= todayJST &&
  !hasInfo &&
  !unreachable &&
  confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
  inquiryDate >= '2026-01-01'
);
```

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで全条件が一致することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでカウント計算とフィルタリングの条件差異を具体的に確認する。

**Test Plan**: 各差異を再現する売主データを用意し、カウント計算とフィルタリングの結果が異なることを確認する。

**Test Cases**:
1. **差異2の再現**: `status='追客中'`, `next_call_date=today`, `unreachable_status=''`, `confidence_level=''`, `inquiry_date='2026-02-01'`, コミュニケーション情報なし, 営担なし の売主 → カウント計算では `todayCallNotStarted` にカウントされ `todayCall` から除外されるが、フィルタリングでは `todayCall` に含まれる（不一致）
2. **差異1の再現**: `status='追客中'`, `next_call_date=today`, `exclusion_date='2026-03-01'`, `inquiry_date='2026-02-01'`, コミュニケーション情報なし, 営担なし の売主 → カウント計算では `todayCallNotStarted` にカウントされるが、フィルタリングでは除外される（不一致）
3. **差異3の再現**: `status='追客中'`, `inquiry_date='2026-02-01'`, `exclusion_date='2026-03-01'`, 査定額なし, 営担なし の売主 → カウント計算では `unvaluated` にカウントされるが、フィルタリングでは除外される（不一致）

**Expected Counterexamples**:
- `todayCall` フィルタが未着手売主を含んでしまう
- `todayCallNotStarted` フィルタが `exclusion_date` ありの売主を除外してしまう
- `unvaluated` フィルタが `exclusion_date` ありの売主を除外してしまう

### Fix Checking

**Goal**: 修正後、カウント計算とフィルタリングが同一の売主集合を返すことを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller, category) DO
  countResult := countCategory(seller, category)
  filterResult := filterCategory(seller, category)
  ASSERT countResult == filterResult
END FOR
```

### Preservation Checking

**Goal**: 修正対象外カテゴリのフィルタリング動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL seller, category WHERE category NOT IN ['todayCall', 'todayCallNotStarted', 'unvaluated'] DO
  ASSERT listSellers_original(category) == listSellers_fixed(category)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様な売主データを自動生成し、修正対象外カテゴリで結果が変わらないことを確認する。

**Test Cases**:
1. **visitDayBefore の保持**: 修正前後で同じ売主が返ることを確認
2. **visitCompleted の保持**: 修正前後で同じ売主が返ることを確認
3. **todayCallAssigned の保持**: 修正前後で同じ売主が返ることを確認
4. **exclusive/general/visitOtherDecision/unvisitedOtherDecision の保持**: 修正前後で同じ売主が返ることを確認

### Unit Tests

- `todayCall` フィルタが未着手売主を除外することを確認
- `todayCallNotStarted` フィルタが `exclusion_date` ありの売主を含むことを確認（カウント計算と一致）
- `unvaluated` フィルタが `exclusion_date` ありの売主を含むことを確認（カウント計算と一致）
- 境界値テスト（`inquiry_date='2025-12-31'` vs `'2026-01-01'`）

### Property-Based Tests

- ランダムな売主データを生成し、カウント計算とフィルタリングの結果が一致することを検証
- ランダムな売主データを生成し、1人の売主が `todayCallNotStarted`, `todayCall`, `unvaluated` のうち最大1つにのみ属することを検証
- 修正対象外カテゴリで、多様な売主データに対して修正前後の結果が同一であることを検証

### Integration Tests

- 実際のDBデータを使用して、各カテゴリのカウントとリスト件数が一致することを確認
- 売主データを更新後、カウントとリスト件数が引き続き一致することを確認
