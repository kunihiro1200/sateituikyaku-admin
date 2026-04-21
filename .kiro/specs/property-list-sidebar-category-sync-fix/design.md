# 物件リストサイドバーカテゴリー同期バグ Bugfix Design

## Overview

物件リストのサイドバーカテゴリーにおいて、カウント計算（`PropertySidebarStatus.tsx`）とフィルタリングロジック（`PropertyListingsPage.tsx`）が異なる判定基準を使用しているため、カウントが0でもカテゴリーが消えず、クリックしてもデータなしになるバグを修正する。

修正方針は、フィルタリングロジックを `calculatePropertyStatus()` の結果を使うように統一することで、カウントと表示件数を常に一致させる。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `calculatePropertyStatus()` が `private_pending` を返さないが、`general_mediation_private === '非公開予定'` である物件が存在する場合
- **Property (P)**: 期待される正しい動作 — サイドバーのカウントとフィルタリング結果が常に一致すること
- **Preservation**: 修正によって変えてはいけない既存の動作 — 他のカテゴリー（未報告、未完了、要値下げ等）のカウントとフィルタリングが正しく動作し続けること
- **calculatePropertyStatus()**: `frontend/frontend/src/utils/propertyListingStatusUtils.ts` に定義された関数。物件の各フィールドを優先度順に評価し、最も優先度の高いステータスを返す
- **private_pending**: `calculatePropertyStatus()` が返すステータスキー。`general_mediation_private === '非公開予定'` かつ、より優先度の高い条件（要値下げ、未報告、未完了）に該当しない場合に返される
- **general_mediation_private**: 物件テーブルの「一般媒介非公開（仮）」フィールド。値が `'非公開予定'` の場合に「非公開予定（確認後）」カテゴリーに関連する
- **statusCounts**: `PropertySidebarStatus.tsx` 内で計算されるカテゴリー別カウントのオブジェクト
- **sidebarStatus**: `PropertyListingsPage.tsx` で管理される選択中のサイドバーカテゴリー文字列

## Bug Details

### Bug Condition

バグは `PropertySidebarStatus.tsx` のカウント計算と `PropertyListingsPage.tsx` のフィルタリングが異なる判定基準を使用している場合に発生する。特に「非公開予定（確認後）」カテゴリーでは、カウントが `general_mediation_private === '非公開予定'` の直接比較で計算されているが、`calculatePropertyStatus()` の優先度ロジックでは同じ物件が別のステータス（例: `unreported`）に分類される場合がある。

**Formal Specification:**
```
FUNCTION isBugCondition(listing)
  INPUT: listing of type PropertyListing
  OUTPUT: boolean

  // calculatePropertyStatus() が private_pending を返さないが、
  // general_mediation_private === '非公開予定' である場合にバグが発生する
  RETURN calculatePropertyStatus(listing).key !== 'private_pending'
         AND listing.general_mediation_private === '非公開予定'
END FUNCTION
```

### Examples

- **例1（バグ発生）**: `general_mediation_private === '非公開予定'` かつ `report_date` が今日以前の物件
  - カウント側: `general_mediation_private === '非公開予定'` の直接比較で「非公開予定（確認後）」にカウントされる（カウント: 1）
  - フィルター側: `calculatePropertyStatus()` は `unreported` を返すため、「非公開予定（確認後）」クリック時に表示されない（表示: 0件）
  - 結果: カウント1なのにクリックするとデータなし

- **例2（バグ発生）**: `general_mediation_private === '非公開予定'` かつ `confirmation === '未'` の物件
  - カウント側: 「非公開予定（確認後）」にカウントされる（カウント: 1）
  - フィルター側: `calculatePropertyStatus()` は `incomplete` を返すため、「非公開予定（確認後）」クリック時に表示されない（表示: 0件）
  - 結果: カウント1なのにクリックするとデータなし

- **例3（正常ケース）**: `general_mediation_private === '非公開予定'` かつ `report_date` が未設定（null）かつ `confirmation !== '未'` の物件
  - カウント側: 「非公開予定（確認後）」にカウントされる（カウント: 1）
  - フィルター側: `calculatePropertyStatus()` は `private_pending` を返すため、「非公開予定（確認後）」クリック時に表示される（表示: 1件）
  - 結果: カウントと表示が一致（バグなし）

- **例4（エッジケース）**: `general_mediation_private === '非公開予定'` かつ `price_reduction_scheduled_date` が今日以前の物件
  - カウント側: 「非公開予定（確認後）」にカウントされる（カウント: 1）
  - フィルター側: `calculatePropertyStatus()` は `price_reduction_due` を返すため、「非公開予定（確認後）」クリック時に表示されない（表示: 0件）
  - 結果: カウント1なのにクリックするとデータなし

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 「未完了」カテゴリーのカウントとフィルタリングは `confirmation === '未'` の判定で正しく動作し続けること
- 「未報告」カテゴリーのカウントとフィルタリングは `calculatePropertyStatus()` の `unreported` 判定で正しく動作し続けること
- 「要値下げ」カテゴリーのカウントとフィルタリングは `calculatePropertyStatus()` の `price_reduction_due` 判定で正しく動作し続けること
- 「すべて」カテゴリーをクリックすると全物件が表示されること
- 担当者別専任公開中カテゴリー（Y専任公開中等）のカウントとフィルタリングが正しく動作し続けること
- 「本日公開予定」「SUUMO URL 要登録」「レインズ登録＋SUUMO URL 要登録」の動的判定が正しく動作し続けること

**スコープ:**
「非公開予定（確認後）」カテゴリーのカウント計算ロジックのみを修正する。他のカテゴリーのロジックは変更しない。

**注意:** 期待される正しい動作（修正後の動作）は「Correctness Properties」セクションの Property 1 で定義する。

## Hypothesized Root Cause

コードベースの調査により、根本原因は以下の通り確認された：

1. **カウント計算の不整合（`PropertySidebarStatus.tsx` L207-212）**: 「非公開予定（確認後）」のカウントは `calculatePropertyStatus()` のループとは別に、`listings.filter(l => l.general_mediation_private === '非公開予定').length` で計算されている。このため、`calculatePropertyStatus()` が `private_pending` 以外のステータス（`unreported`、`incomplete`、`price_reduction_due`）を返す物件も「非公開予定（確認後）」にカウントされてしまう。

2. **フィルタリングの不整合（`PropertyListingsPage.tsx` L340-342）**: 「非公開予定（確認後）」のフィルタリングは `l.general_mediation_private === '非公開予定'` の直接比較で実装されている。これはカウント計算と同じ基準だが、`calculatePropertyStatus()` の優先度ロジックと乖離している。

3. **優先度ロジックの存在**: `calculatePropertyStatus()` では `price_reduction_due` → `unreported` → `incomplete` → `private_pending` の優先度順で判定される。`general_mediation_private === '非公開予定'` の物件でも、より優先度の高い条件に該当すれば `private_pending` は返されない。

4. **修正方針**: `PropertySidebarStatus.tsx` のカウント計算を `calculatePropertyStatus()` の結果を使うように変更し、`PropertyListingsPage.tsx` のフィルタリングも `calculatePropertyStatus().key === 'private_pending'` を使うように変更する。

## Correctness Properties

Property 1: Bug Condition - 非公開予定（確認後）カテゴリーのカウントとフィルタリングの一致

_For any_ 物件リストにおいて、`calculatePropertyStatus()` が `private_pending` を返す物件の数が、サイドバーの「非公開予定（確認後）」カウントバッジの数と一致し、かつ「非公開予定（確認後）」カテゴリーをクリックした際に表示される物件数と一致すること。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他カテゴリーの動作保全

_For any_ 「非公開予定（確認後）」以外のカテゴリー（未完了、未報告、要値下げ、すべて、担当者別専任公開中等）において、修正前と修正後でカウントバッジの数とフィルタリング結果が変わらないこと。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の変更を行う：

**File 1**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**変更箇所**: `statusCounts` の `useMemo` 内（L207-212付近）

**具体的な変更**:
1. **「非公開予定（確認後）」の別途カウント計算を削除**: `listings.filter(l => l.general_mediation_private === '非公開予定').length` による別途計算を削除する
2. **`calculatePropertyStatus()` のループに統合**: `forEach` ループ内で `computed.key === 'private_pending'` の場合に `counts['非公開予定（確認後）']` をインクリメントするよう変更する

**変更前（概要）**:
```typescript
// forEach ループ内では private_pending を処理していない
listings.forEach(listing => {
  const computed = calculatePropertyStatus(listing as any, workTaskMap);
  if (computed.key === 'price_reduction_due') { ... return; }
  if (computed.key === 'unreported') { ... return; }
  // ... private_pending の処理なし
});

// ループ外で別途計算（バグの原因）
const generalMediationPrivateCount = listings.filter(
  l => l.general_mediation_private === '非公開予定'
).length;
if (generalMediationPrivateCount > 0) {
  counts['非公開予定（確認後）'] = generalMediationPrivateCount;
}
```

**変更後（概要）**:
```typescript
listings.forEach(listing => {
  const computed = calculatePropertyStatus(listing as any, workTaskMap);
  if (computed.key === 'price_reduction_due') { ... return; }
  if (computed.key === 'unreported') { ... return; }
  // private_pending をループ内で処理（修正）
  if (computed.key === 'private_pending') {
    counts['非公開予定（確認後）'] = (counts['非公開予定（確認後）'] || 0) + 1;
    return;
  }
  // ...
});
// 別途計算のコードを削除
```

---

**File 2**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**変更箇所**: `sidebarStatus === '非公開予定（確認後）'` の分岐（L340-342付近）

**具体的な変更**:
1. **フィルタリングロジックを `calculatePropertyStatus()` に統一**: `l.general_mediation_private === '非公開予定'` の直接比較を `calculatePropertyStatus(l as any, workTaskMap).key === 'private_pending'` に変更する

**変更前**:
```typescript
} else if (sidebarStatus === '非公開予定（確認後）') {
  listings = listings.filter(l => l.general_mediation_private === '非公開予定');
}
```

**変更後**:
```typescript
} else if (sidebarStatus === '非公開予定（確認後）') {
  listings = listings.filter(l => calculatePropertyStatus(l as any, workTaskMap).key === 'private_pending');
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードでバグが解消され既存動作が保全されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグが発生することを確認し、根本原因分析を検証する。

**Test Plan**: `calculatePropertyStatus()` が `private_pending` 以外を返す物件（`general_mediation_private === '非公開予定'` かつ `report_date` が今日以前など）を作成し、`PropertySidebarStatus.tsx` のカウント計算と `PropertyListingsPage.tsx` のフィルタリングが不一致になることを確認する。

**Test Cases**:
1. **未報告+非公開予定テスト**: `general_mediation_private === '非公開予定'` かつ `report_date` が今日以前の物件で、カウントが1なのにフィルタリング結果が0件になることを確認（未修正コードで失敗）
2. **未完了+非公開予定テスト**: `general_mediation_private === '非公開予定'` かつ `confirmation === '未'` の物件で、同様の不一致を確認（未修正コードで失敗）
3. **要値下げ+非公開予定テスト**: `general_mediation_private === '非公開予定'` かつ `price_reduction_scheduled_date` が今日以前の物件で、同様の不一致を確認（未修正コードで失敗）
4. **正常ケーステスト**: `general_mediation_private === '非公開予定'` かつ他の優先度高条件に該当しない物件で、カウントとフィルタリングが一致することを確認（未修正コードでも成功）

**Expected Counterexamples**:
- カウント計算では `general_mediation_private === '非公開予定'` の物件が全てカウントされるが、フィルタリングでは `calculatePropertyStatus()` の優先度ロジックにより一部の物件が除外される
- 原因: `PropertySidebarStatus.tsx` のカウント計算が `calculatePropertyStatus()` のループ外で別途実行されている

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当する全ての入力に対して期待される動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE isBugCondition(listing) DO
  sidebarCounts ← calculateStatusCounts([listing])
  filteredByCategory ← filterByStatus([listing], 'private_pending')
  ASSERT sidebarCounts['非公開予定（確認後）'] = 0
  ASSERT filteredByCategory.length = 0
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件に該当しない全ての入力に対して修正前と同じ動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE NOT isBugCondition(listing) DO
  ASSERT F(listing) = F'(listing)  // カウントとフィルタリング結果が変わらない
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な物件データを自動生成して広範な入力ドメインをカバーできる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強力に保証できる

**Test Plan**: 未修正コードで各カテゴリーの動作を確認し、修正後も同じ動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **正常な非公開予定物件の保全**: `calculatePropertyStatus()` が `private_pending` を返す物件が「非公開予定（確認後）」に正しくカウントされ、クリック時に表示されることを確認
2. **未報告カテゴリーの保全**: `report_date` が今日以前の物件が「未報告」に正しくカウントされ、クリック時に表示されることを確認
3. **未完了カテゴリーの保全**: `confirmation === '未'` の物件が「未完了」に正しくカウントされ、クリック時に表示されることを確認
4. **すべてカテゴリーの保全**: 「すべて」クリック時に全物件が表示されることを確認

### Unit Tests

- `calculatePropertyStatus()` が `private_pending` を返す物件のカウントが「非公開予定（確認後）」に正しく集計されることをテスト
- `calculatePropertyStatus()` が `unreported` を返す物件が「非公開予定（確認後）」にカウントされないことをテスト
- `PropertyListingsPage.tsx` のフィルタリングで `calculatePropertyStatus().key === 'private_pending'` の物件のみが返されることをテスト
- エッジケース: `general_mediation_private === '非公開予定'` かつ `price_reduction_scheduled_date` が今日以前の物件が「非公開予定（確認後）」に含まれないことをテスト

### Property-Based Tests

- ランダムな物件データを生成し、`PropertySidebarStatus.tsx` のカウントと `PropertyListingsPage.tsx` のフィルタリング結果が常に一致することを検証
- `calculatePropertyStatus()` が `private_pending` を返す物件のみが「非公開予定（確認後）」カテゴリーに含まれることを多数のシナリオで検証
- 修正前後で「非公開予定（確認後）」以外の全カテゴリーの動作が変わらないことを検証

### Integration Tests

- 「非公開予定（確認後）」カテゴリーをクリックした際に、カウントバッジの数と表示件数が一致することを確認
- 「未報告+非公開予定」物件が「未報告」カテゴリーに表示され、「非公開予定（確認後）」には表示されないことを確認
- カテゴリー切り替え時に表示件数が正しく更新されることを確認
