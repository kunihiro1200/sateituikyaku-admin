# 物件リストサイドバー修正 Bugfix Design

## Overview

物件リスト画面（PropertyListingsPage）のサイドバーに存在する2つのバグを修正する。

1. **サイドバー枠線バグ**: `PropertySidebarStatus.tsx` の `<Paper>` コンポーネントのデフォルト elevation によるbox-shadowが枠線のように見える。`sx={{ boxShadow: 'none', border: 'none' }}` を追加することで解消する。

2. **「林専任公開中」フィルターバグ**: `PropertyListingsPage.tsx` の `filteredListings` useMemo 内の `assigneeMap` に `'林専任公開中'` が含まれておらず、フィルタリング条件の配列にも含まれていないため、「林専任公開中」カテゴリーをクリックしても物件が表示されない。`assigneeMap` に `'林専任公開中': '林田'` を追加し、フィルタリング条件の配列にも `'林専任公開中'` を追加することで解消する。

## Glossary

- **Bug_Condition (C)**: バグを引き起こす条件 — (1) Paper コンポーネントに boxShadow/border が設定されていない、(2) sidebarStatus が `'林専任公開中'` である
- **Property (P)**: バグ条件が成立する入力に対する期待動作 — (1) 枠線が表示されない、(2) 担当者「林田」の物件が正しくフィルタリングされる
- **Preservation**: 修正によって変更してはならない既存の動作 — 他の専任公開中フィルター、その他カテゴリーフィルター、スクロールバー表示
- **assigneeMap**: `PropertyListingsPage.tsx` の `filteredListings` useMemo 内で、専任公開中ステータス名を担当者名にマッピングする辞書
- **ASSIGNEE_TO_SENIN_STATUS**: `PropertySidebarStatus.tsx` 内で、担当者名を専任公開中ステータス名にマッピングする辞書（`'林田': '林専任公開中'` が定義済み）
- **sidebar_status**: DBに保存されている物件のステータス文字列

## Bug Details

### Bug Condition

**バグ1: サイドバー枠線**

`PropertySidebarStatus.tsx` の `<Paper>` コンポーネントにデフォルトの elevation（= 1）が適用されており、box-shadow が枠線のように見える。

**Formal Specification:**
```
FUNCTION isBugCondition_Border(component)
  INPUT: component of type Paper (MUI)
  OUTPUT: boolean
  
  RETURN component.elevation IS NOT 0
         AND component.sx.boxShadow IS NOT 'none'
         AND component.sx.border IS NOT 'none'
END FUNCTION
```

**バグ2: 「林専任公開中」フィルター**

`filteredListings` useMemo 内のフィルタリング条件配列に `'林専任公開中'` が含まれていないため、else ブランチ（`l.sidebar_status === sidebarStatus` の単純比較）に落ちる。`sidebar_status === '専任・公開中'` かつ `sales_assignee === '林田'` の古いデータがフィルタリングされない。

**Formal Specification:**
```
FUNCTION isBugCondition_Filter(sidebarStatus, assigneeMap, filterArray)
  INPUT: sidebarStatus of type string
         assigneeMap of type Record<string, string>
         filterArray of type string[]
  OUTPUT: boolean
  
  RETURN sidebarStatus === '林専任公開中'
         AND '林専任公開中' NOT IN filterArray
         AND '林専任公開中' NOT IN assigneeMap
END FUNCTION
```

### Examples

**バグ1:**
- 物件リスト画面を開く → サイドバー全体を囲む影（box-shadow）が枠線のように表示される（バグ）
- 修正後: 影が消え、枠線のない状態になる（期待動作）

**バグ2:**
- 担当者「林田」の物件が存在する状態でサイドバーの「林専任公開中」をクリック → 「物件データが見つかりませんでした」と表示される（バグ）
- `sidebar_status === '林専任公開中'` の物件は `else` ブランチで `l.sidebar_status === '林専任公開中'` として正しくフィルタリングされるが、`sidebar_status === '専任・公開中'` かつ `sales_assignee === '林田'` の古いデータは取得されない（バグ）
- 修正後: 担当者「林田」の物件が正しく表示される（期待動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `'Y専任公開中'`、`'生・専任公開中'`、`'久・専任公開中'`、`'U専任公開中'`、`'林・専任公開中'`、`'K専任公開中'`、`'R専任公開中'`、`'I専任公開中'` の各フィルターが引き続き正しく動作すること
- `'未完了'`、`'要値下げ'`、`'未報告'` などその他カテゴリーのフィルターが引き続き正しく動作すること
- サイドバーのカテゴリーリストのスクロールバーが引き続き表示されること（`<List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>` は変更しない）

**Scope:**
`'林専任公開中'` 以外のサイドバーステータスによるフィルタリング、およびサイドバーの表示スタイル（スクロールバー）は、この修正によって一切影響を受けてはならない。

## Hypothesized Root Cause

### バグ1: サイドバー枠線

1. **MUI Paper のデフォルト elevation**: `<Paper>` コンポーネントはデフォルトで `elevation={1}` が適用され、box-shadow が表示される。明示的に `elevation={0}` または `sx={{ boxShadow: 'none', border: 'none' }}` を指定していないため、枠線のように見える影が表示されている。

### バグ2: 「林専任公開中」フィルター

1. **assigneeMap への未追加**: `filteredListings` useMemo 内の `assigneeMap` に `'林専任公開中': '林田'` が含まれていない。

2. **フィルタリング条件配列への未追加**: `['Y専任公開中', '生・専任公開中', ..., 'I専任公開中'].includes(sidebarStatus)` の配列に `'林専任公開中'` が含まれていないため、専任公開中の担当者別フィルタリングロジックが適用されない。

3. **ASSIGNEE_TO_SENIN_STATUS との不整合**: `PropertySidebarStatus.tsx` の `ASSIGNEE_TO_SENIN_STATUS` には `'林田': '林専任公開中'` が定義されており、サイドバーには「林専任公開中」カテゴリーが表示されるが、`PropertyListingsPage.tsx` 側のフィルタリングロジックが対応していない。

## Correctness Properties

Property 1: Bug Condition - 「林専任公開中」フィルタリングの正常動作

_For any_ 物件リストにおいて sidebarStatus が `'林専任公開中'` である場合、修正後の filteredListings は `sidebar_status === '林専任公開中'` の物件、または `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林田'` の物件を正しく返す。

**Validates: Requirements 2.2**

Property 2: Preservation - 既存の専任公開中フィルターの動作維持

_For any_ sidebarStatus が `'林専任公開中'` 以外の専任公開中ステータス（`'Y専任公開中'`、`'生・専任公開中'`、`'久・専任公開中'`、`'U専任公開中'`、`'林・専任公開中'`、`'K専任公開中'`、`'R専任公開中'`、`'I専任公開中'`）である場合、修正後の filteredListings は修正前と同一の結果を返す。

**Validates: Requirements 3.1**

## Fix Implementation

### Changes Required

**バグ1: サイドバー枠線**

**File**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**Specific Changes:**
1. **Paper コンポーネントの sx プロパティ修正**: `<Paper sx={{ width: 210, flexShrink: 0 }}>` を `<Paper sx={{ width: 210, flexShrink: 0, boxShadow: 'none', border: 'none' }}>` に変更する

---

**バグ2: 「林専任公開中」フィルター**

**File**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Specific Changes:**
1. **フィルタリング条件配列への追加**: `['Y専任公開中', '生・専任公開中', '久・専任公開中', 'U専任公開中', '林・専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中'].includes(sidebarStatus)` の配列に `'林専任公開中'` を追加する

2. **assigneeMap への追加**: `assigneeMap` に `'林専任公開中': '林田'` を追加する

## Testing Strategy

### Validation Approach

2つのバグに対して、それぞれ修正前にバグを確認し、修正後に正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 
- バグ1: Paper コンポーネントのスタイルを確認し、box-shadow が適用されていることを確認する
- バグ2: `sidebarStatus === '林専任公開中'` の場合に filteredListings が空になることを確認する

**Test Cases:**
1. **枠線確認テスト**: PropertySidebarStatus をレンダリングし、Paper コンポーネントに box-shadow が適用されていることを確認（修正前は失敗）
2. **林専任公開中フィルターテスト**: `sidebar_status === '林専任公開中'` の物件を含むリストで `sidebarStatus === '林専任公開中'` を設定し、filteredListings が空でないことを確認（修正前は失敗）
3. **古いデータフィルターテスト**: `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林田'` の物件を含むリストで `sidebarStatus === '林専任公開中'` を設定し、filteredListings に含まれることを確認（修正前は失敗）

**Expected Counterexamples:**
- 修正前: `sidebarStatus === '林専任公開中'` の場合、filteredListings が空になる
- 原因: assigneeMap に `'林専任公開中'` が含まれていない、フィルタリング条件配列に `'林専任公開中'` が含まれていない

### Fix Checking

**Goal**: 修正後のコードで全てのバグ条件が解消されていることを確認する。

**Pseudocode:**
```
FOR ALL listing WHERE listing.sidebar_status === '林専任公開中'
                   OR (listing.sidebar_status === '専任・公開中' AND listing.sales_assignee === '林田') DO
  result := filteredListings_fixed(listings, '林専任公開中')
  ASSERT listing IN result
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで既存の動作が変わっていないことを確認する。

**Pseudocode:**
```
FOR ALL sidebarStatus WHERE sidebarStatus NOT IN ['林専任公開中'] DO
  ASSERT filteredListings_original(listings, sidebarStatus) 
       = filteredListings_fixed(listings, sidebarStatus)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様な物件データと sidebarStatus の組み合わせを自動生成し、修正前後の結果が一致することを確認する。

**Test Cases:**
1. **既存専任公開中フィルター保持テスト**: `'Y専任公開中'`〜`'I専任公開中'` の各ステータスで修正前後の filteredListings が一致することを確認
2. **その他カテゴリーフィルター保持テスト**: `'未完了'`、`'要値下げ'` などで修正前後の filteredListings が一致することを確認
3. **スクロールバー保持テスト**: List コンポーネントの sx に `maxHeight` と `overflow: 'auto'` が維持されていることを確認

### Unit Tests

- `sidebarStatus === '林専任公開中'` の場合に `sidebar_status === '林専任公開中'` の物件がフィルタリングされることを確認
- `sidebarStatus === '林専任公開中'` の場合に `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林田'` の物件がフィルタリングされることを確認
- Paper コンポーネントに `boxShadow: 'none'` と `border: 'none'` が適用されていることを確認

### Property-Based Tests

- ランダムな物件リストと sidebarStatus を生成し、`'林専任公開中'` 以外のステータスで修正前後の filteredListings が一致することを確認
- `sidebar_status === '林専任公開中'` または `(sidebar_status === '専任・公開中' AND sales_assignee === '林田')` の物件が `sidebarStatus === '林専任公開中'` のフィルターで常に含まれることを確認

### Integration Tests

- 物件リスト画面を開き、サイドバーに枠線が表示されないことを確認
- 「林専任公開中」カテゴリーをクリックし、担当者「林田」の物件が表示されることを確認
- 他の専任公開中カテゴリーをクリックし、引き続き正しくフィルタリングされることを確認
