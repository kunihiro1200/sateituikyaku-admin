# 売主サイドバー「未着手」カウント・フィルタ不一致 Bugfix Design

## Overview

サイドバーの「当日TEL_未着手」カテゴリに件数が表示されているにもかかわらず、クリックすると「データなし」になるバグ。

根本原因は `getSidebarCountsFallback()` のカウント計算と `listSellers()` のフィルタリングで、「追客中」ステータスの判定ロジックが異なることにある。

- カウント計算側: `filteredTodayCallSellers` の元となるDBクエリが `.ilike('status', '%追客中%')` を使用 → 「除外後追客中」なども含まれる
- カウント計算側の `todayCallNotStartedCount`: JSで `status !== '追客中'`（完全一致）でフィルタ → 「除外後追客中」は除外される
- フィルタリング側 (`listSellers`): DBクエリで `next_call_date <= today` の全売主を取得し、JSで `status === '追客中'`（完全一致）でフィルタ

この不一致により、`filteredTodayCallSellers` に「除外後追客中」の売主が混入し、`todayCallNotStartedCount` の計算に影響を与える可能性がある。

修正方針: `getSidebarCountsFallback()` の `todayCallNotStartedCount` 計算に使用する `filteredTodayCallSellers` の元となるDBクエリを、`listSellers()` の `todayCallNotStarted` フィルタと同一条件（`status === '追客中'` 完全一致）に統一する。

## Glossary

- **Bug_Condition (C)**: 「除外後追客中」などのステータスを持つ売主が `filteredTodayCallSellers` に含まれ、`todayCallNotStartedCount` が `listSellers()` の結果と一致しない状態
- **Property (P)**: サイドバーの「当日TEL_未着手」カウントと、そのカテゴリをクリックした際のリスト件数が一致すること
- **Preservation**: 「当日TEL_未着手」以外のサイドバーカテゴリのカウント・フィルタ動作が変わらないこと
- **filteredTodayCallSellers**: `getSidebarCountsFallback()` 内で `todayCallNotStartedCount` 等の計算に使用される中間データセット
- **todayCallBaseResult1**: `filteredTodayCallSellers` の元となるDBクエリ結果（`ilike('%追客中%')` を使用）
- **isBugCondition**: ステータスが「追客中」完全一致ではないが `ilike('%追客中%')` にマッチする売主（例: 「除外後追客中」）が存在する状態

## Bug Details

### Bug Condition

`getSidebarCountsFallback()` の `todayCallNotStartedCount` 計算は `filteredTodayCallSellers` を元にしているが、この `filteredTodayCallSellers` は `todayCallBaseResult1`（`.ilike('status', '%追客中%')`）と `todayCallBaseResult2`（`.eq('status', '他決→追客')`）を合成したものである。

`ilike('%追客中%')` は「除外後追客中」「追客中（保留）」などのステータスも含むため、`filteredTodayCallSellers` にこれらの売主が混入する。その後 `todayCallNotStartedCount` の計算では `status !== '追客中'` で除外するが、`filteredTodayCallSellers` 自体が汚染されているため、`pinrichEmpty` など他のカウントにも影響する可能性がある。

一方 `listSellers()` の `todayCallNotStarted` ケースは独立したDBクエリで `next_call_date <= today` の全売主を取得し、JSで `status === '追客中'`（完全一致）のみを対象とする。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller レコード（status, next_call_date フィールドを持つ）
  OUTPUT: boolean

  RETURN seller.status MATCHES ilike('%追客中%')
         AND seller.status !== '追客中'
         AND seller.next_call_date <= todayJST
END FUNCTION
```

### Examples

- ステータス「除外後追客中」、次電日が今日以前の売主:
  - カウント計算: `filteredTodayCallSellers` に含まれる（`ilike('%追客中%')` にマッチ）→ `todayCallNotStartedCount` では `status !== '追客中'` で除外されるが、`filteredTodayCallSellers` の総数に影響
  - フィルタリング: `status === '追客中'` 完全一致で除外 → リストに表示されない
  - 結果: カウントと表示件数が一致しない可能性がある

- ステータス「追客中」、次電日が今日以前の売主:
  - カウント計算: `filteredTodayCallSellers` に含まれ、`todayCallNotStartedCount` にもカウントされる
  - フィルタリング: `status === '追客中'` でリストに表示される
  - 結果: 正常（一致する）

- ステータス「他決→追客」、次電日が今日以前の売主:
  - カウント計算: `todayCallBaseResult2`（`.eq('status', '他決→追客')`）経由で `filteredTodayCallSellers` に含まれるが、`todayCallNotStartedCount` では `status !== '追客中'` で除外される
  - フィルタリング: `status === '追客中'` 完全一致で除外 → リストに表示されない
  - 結果: 正常（どちらもカウントしない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `statusCategory=todayCall`（当日TEL分）のフィルタリング結果は変わらない
- `statusCategory=todayCallWithInfo`（当日TEL（内容））のフィルタリング結果は変わらない
- `statusCategory=unvaluated`（未査定）のフィルタリング結果は変わらない
- `statusCategory=pinrichEmpty`（Pinrich空欄）のカウント・フィルタリング結果は変わらない
- サイドバーの「当日TEL_未着手」以外の全カテゴリのカウントは変わらない

**Scope:**
`todayCallNotStartedCount` の計算ロジックのみを修正する。`filteredTodayCallSellers` を使用する他のカウント（`todayCallNoInfoCount`、`todayCallWithInfoCount`、`pinrichEmptyCount`）には影響を与えない。

## Hypothesized Root Cause

1. **`filteredTodayCallSellers` の元クエリが `ilike('%追客中%')` を使用**: `todayCallBaseResult1` のDBクエリが部分一致で「除外後追客中」などを含む。`todayCallNotStartedCount` の計算では `status !== '追客中'` で除外しているが、`filteredTodayCallSellers` 自体には混入している。

2. **`todayCallNotStartedCount` の計算が `filteredTodayCallSellers` に依存**: `todayCallNotStartedCount` は `filteredTodayCallSellers` をベースにしているため、元データの汚染が計算結果に影響する。具体的には、`filteredTodayCallSellers` に「除外後追客中」の売主が含まれると、`todayCallNotStartedCount` の計算で `status !== '追客中'` で除外されるが、`filteredTodayCallSellers` の件数自体は増えている。

3. **`listSellers()` の `todayCallNotStarted` は独立したクエリを使用**: `listSellers()` は `filteredTodayCallSellers` を使わず、独立したDBクエリ（`next_call_date <= today` の全件取得）からJSで `status === '追客中'` 完全一致でフィルタする。このため、両者の対象売主が異なる。

4. **`exclusion_date` チェックの有無**: `getSidebarCountsFallback()` の `todayCallNotStartedCount` は `exclusion_date` が空であることをチェックしているが、`listSellers()` の `todayCallNotStarted` も同様にチェックしている。この部分は一致しているが、念のため確認が必要。

## Correctness Properties

Property 1: Bug Condition - 当日TEL_未着手カウントとリスト件数の一致

_For any_ 売主データセットにおいて、`getSidebarCountsFallback()` が返す `todayCallNotStarted` カウントは、`listSellers({ statusCategory: 'todayCallNotStarted' })` が返す売主リストの件数と完全に一致する SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他カテゴリへの非影響

_For any_ 売主データセットにおいて、修正後の `getSidebarCountsFallback()` は `todayCallNotStarted` 以外の全カテゴリ（`todayCall`、`todayCallWithInfo`、`unvaluated`、`mailingPending`、`pinrichEmpty`、`exclusive` 等）のカウントを修正前と同一の値で返す SHALL。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSidebarCountsFallback()`

**Specific Changes**:

1. **`todayCallNotStartedCount` の計算を `filteredTodayCallSellers` から独立させる**:
   - 現在: `filteredTodayCallSellers.filter(s => status !== '追客中' ...)` で計算
   - 修正後: `todayCallBaseResult1` の元クエリを `eq('status', '追客中')` に変更するか、または `filteredTodayCallSellers` とは別に `status === '追客中'` 完全一致でフィルタした専用データセットを使用する

2. **修正アプローチ（推奨）**: `todayCallNotStartedCount` の計算を `filteredTodayCallSellers` から切り離し、`filteredTodayCallSellers` を `status === '追客中'` でさらにフィルタした `notStartedBaseSellers` を使用する:
   ```typescript
   // filteredTodayCallSellers から status === '追客中' のみを抽出
   const notStartedBaseSellers = filteredTodayCallSellers.filter(s => s.status === '追客中');
   
   const todayCallNotStartedCount = notStartedBaseSellers.filter(s => {
     // 既存の条件（hasInfo, unreachable, confidence, exclusionDate, inquiryDate）
     ...
   }).length;
   ```

3. **`listSellers()` の `todayCallNotStarted` との条件一致確認**:
   - `exclusion_date` チェック: 両方で `!exclusionDate` を確認 ✓
   - `confidence_level` チェック: 両方で「ダブり」「D」「AI査定」を除外 ✓
   - `unreachable_status` チェック: 両方で空欄チェック ✓
   - `inquiry_date >= '2026-01-01'` チェック: 両方で確認 ✓
   - `visit_assignee` チェック: `listSellers()` 側で「外す」を除外しているか確認が必要

4. **影響範囲の限定**: `filteredTodayCallSellers` 自体は変更しない（`todayCall`、`todayCallWithInfo`、`pinrichEmpty` の計算に使用されているため）

## Testing Strategy

### Validation Approach

二段階アプローチ: まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 「除外後追客中」ステータスの売主が存在する場合に、カウントとフィルタ結果が一致しないことを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Plan**: `getSidebarCountsFallback()` と `listSellers({ statusCategory: 'todayCallNotStarted' })` を同じデータセットで実行し、結果を比較する。

**Test Cases**:
1. **除外後追客中テスト**: ステータス「除外後追客中」、次電日が今日以前の売主を含むデータセットで、カウントとリスト件数が一致しないことを確認（未修正コードで失敗）
2. **追客中のみテスト**: ステータス「追客中」のみの売主データセットで、カウントとリスト件数が一致することを確認（未修正コードでも成功するはず）
3. **混在テスト**: 「追客中」と「除外後追客中」が混在するデータセットで不一致を確認（未修正コードで失敗）

**Expected Counterexamples**:
- 「除外後追客中」の売主が `filteredTodayCallSellers` に含まれ、`todayCallNotStartedCount` が `listSellers()` の結果より多くなる
- 原因: `ilike('%追客中%')` が「除外後追客中」にマッチするが、`listSellers()` の `status === '追客中'` 完全一致では除外される

### Fix Checking

**Goal**: 修正後、全ての入力でカウントとリスト件数が一致することを確認する。

**Pseudocode:**
```
FOR ALL sellerDataset WHERE isBugCondition(sellerDataset) DO
  count := getSidebarCountsFallback(sellerDataset).todayCallNotStarted
  listCount := listSellers({ statusCategory: 'todayCallNotStarted' }, sellerDataset).total
  ASSERT count === listCount
END FOR
```

### Preservation Checking

**Goal**: 修正が他のカテゴリのカウントに影響を与えないことを確認する。

**Pseudocode:**
```
FOR ALL sellerDataset WHERE NOT isBugCondition(sellerDataset) DO
  original := getSidebarCountsFallback_original(sellerDataset)
  fixed := getSidebarCountsFallback_fixed(sellerDataset)
  ASSERT original.todayCall === fixed.todayCall
  ASSERT original.todayCallWithInfo === fixed.todayCallWithInfo
  ASSERT original.pinrichEmpty === fixed.pinrichEmpty
  ASSERT original.unvaluated === fixed.unvaluated
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。様々なステータスの組み合わせを自動生成して、修正前後の他カテゴリカウントが変わらないことを検証する。

**Test Cases**:
1. **todayCall保持テスト**: 「追客中」「他決→追客」の売主で `todayCall` カウントが変わらないことを確認
2. **pinrichEmpty保持テスト**: `pinrichEmpty` カウントが修正前後で変わらないことを確認
3. **unvaluated保持テスト**: `unvaluated` カウントが修正前後で変わらないことを確認

### Unit Tests

- `filteredTodayCallSellers` に「除外後追客中」が含まれる場合の `todayCallNotStartedCount` 計算テスト
- `status === '追客中'` 完全一致フィルタの動作確認テスト
- `listSellers()` の `todayCallNotStarted` ケースで「除外後追客中」が除外されることの確認テスト

### Property-Based Tests

- ランダムなステータス値（「追客中」「除外後追客中」「他決→追客」等の組み合わせ）を生成し、修正後の `todayCallNotStartedCount` が `listSellers()` の結果と常に一致することを検証
- 修正が `todayCall`、`todayCallWithInfo`、`pinrichEmpty` カウントに影響を与えないことを多数のシナリオで検証

### Integration Tests

- 実際のDBデータを使用して、サイドバーカウントとフィルタ結果の一致を確認
- 「除外後追客中」ステータスの売主が存在する環境での動作確認
- サイドバーカテゴリをクリックした際のエンドツーエンドの動作確認
