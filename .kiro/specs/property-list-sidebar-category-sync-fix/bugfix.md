# Bugfix Requirements Document

## Introduction

物件リスト（売主管理システム）のサイドバーカテゴリーにおいて、カウント数とフィルタリングの整合性が取れていないバグを修正する。

具体的には以下の2つの問題が発生している：

1. **カウント0でもカテゴリーが消えない**: `general_mediation_private === '非公開予定'` の物件が0件になっても「非公開予定（確認後）」カテゴリーがサイドバーに表示され続ける
2. **クリックしてもデータなし**: カテゴリーをクリックすると「データなし」と表示される

この問題は「非公開予定（確認後）」に限らず、サイドバーカテゴリー全般で発生している。根本原因は、**サイドバーのカウント計算ロジック（`PropertySidebarStatus.tsx`）とフィルタリングロジック（`PropertyListingsPage.tsx`）が異なる判定基準を使用している**ことにある。

### 根本原因の詳細

`PropertySidebarStatus.tsx` の `statusCounts` 計算では、各物件に対して `calculatePropertyStatus()` を呼び出して動的にステータスを判定し、その結果でカウントを集計している。

一方、`PropertyListingsPage.tsx` のフィルタリングでは、`sidebarStatus` の文字列値に応じて個別の条件分岐でフィルタリングしている。

この2つのロジックが乖離しているため、以下の不整合が生じる：

- **カウント側**: `calculatePropertyStatus()` が `private_pending` を返した物件のみカウント（優先度順で判定）
- **フィルター側**: `l.general_mediation_private === '非公開予定'` で直接フィルタリング

例えば、`general_mediation_private === '非公開予定'` の物件でも、`report_date` が今日以前であれば `calculatePropertyStatus()` は `unreported` を返す。この物件はカウント側では「未報告」にカウントされるが、フィルター側では「非公開予定（確認後）」にも含まれてしまう（または逆に含まれない）。

さらに、`PropertySidebarStatus.tsx` の `statusCounts` 計算では `calculatePropertyStatus()` を使用しているが、`statusList` の `filter(([key, count]) => count > 0)` でカウント0のカテゴリーを除外している。しかし、`general_mediation_private` のカウントは `calculatePropertyStatus()` の結果ではなく、別途 `listings.filter(l => l.general_mediation_private === '非公開予定').length` で計算されている。このため、実際には `calculatePropertyStatus()` で `private_pending` と判定される物件が0件でも、`general_mediation_private === '非公開予定'` の物件が存在すればカテゴリーが表示され続ける。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `general_mediation_private === '非公開予定'` の物件が存在するが、全て `report_date` が今日以前（未報告状態）である THEN サイドバーに「非公開予定（確認後）」カテゴリーが表示され続ける（カウントは1以上）

1.2 WHEN ユーザーが「非公開予定（確認後）」カテゴリーをクリックする THEN フィルタリングが `l.general_mediation_private === '非公開予定'` で実行されるため、`calculatePropertyStatus()` で `unreported` と判定された物件も含まれてしまい、表示件数とカウントが一致しない

1.3 WHEN `calculatePropertyStatus()` が `private_pending` を返す物件が0件になる THEN `statusCounts` の `calculatePropertyStatus()` ループでは「非公開予定（確認後）」がカウントされないが、別途計算された `generalMediationPrivateCount` が1以上であればカテゴリーが表示され続ける

1.4 WHEN サイドバーカテゴリーのカウントが0になる THEN カテゴリーが非表示になるべきだが、カウント計算とフィルタリングの判定基準が異なるため、カウント0でもカテゴリーが表示されることがある

1.5 WHEN ユーザーがカウント0のカテゴリーをクリックする THEN フィルタリング結果が0件となり「データなし」と表示される

### Expected Behavior (Correct)

2.1 WHEN `calculatePropertyStatus()` が `private_pending` を返す物件が0件になる THEN 「非公開予定（確認後）」カテゴリーはサイドバーから消える

2.2 WHEN ユーザーが「非公開予定（確認後）」カテゴリーをクリックする THEN `calculatePropertyStatus()` が `private_pending` を返す物件のみが表示され、カウント数と表示件数が一致する

2.3 WHEN サイドバーのカウント計算とフィルタリングが実行される THEN 両方とも同一の判定ロジック（`calculatePropertyStatus()`）を使用するため、カウント数と実際のフィルタリング結果が常に一致する

2.4 WHEN カウントが0のカテゴリーが存在する THEN そのカテゴリーはサイドバーに表示されない

2.5 WHEN ユーザーがサイドバーカテゴリーをクリックする THEN 表示されるデータ件数がカウントバッジの数と一致する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `general_mediation_private === '非公開予定'` かつ `report_date` が未設定（null）の物件が存在する THEN 「非公開予定（確認後）」カテゴリーに正しくカウントされ、クリック時にその物件が表示される

3.2 WHEN `report_date` が今日以前の物件が存在する THEN 「未報告」カテゴリーに正しくカウントされ、クリック時にその物件が表示される

3.3 WHEN `confirmation === '未'` の物件が存在する THEN 「未完了」カテゴリーに正しくカウントされ、クリック時にその物件が表示される

3.4 WHEN 専任公開中の物件が存在する THEN 担当者別の専任公開中カテゴリー（例: Y専任公開中）に正しくカウントされ、クリック時にその物件が表示される

3.5 WHEN 「すべて」カテゴリーをクリックする THEN 全物件が表示される

3.6 WHEN `price_reduction_scheduled_date` が今日以前の物件が存在する THEN 「要値下げ」カテゴリーに正しくカウントされ、クリック時にその物件が表示される

3.7 WHEN 複数のカテゴリー条件を満たす物件が存在する THEN `calculatePropertyStatus()` の優先度順（要値下げ > 未報告 > 未完了 > 非公開予定（確認後）...）に従い、最も優先度の高いカテゴリーにのみカウントされる

---

## Bug Condition（バグ条件）

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListing
  OUTPUT: boolean

  // カウント計算とフィルタリングの判定基準が異なる場合にバグが発生する
  // 具体的には: calculatePropertyStatus(X) が private_pending を返さないが、
  //             X.general_mediation_private === '非公開予定' である場合
  RETURN calculatePropertyStatus(X).key !== 'private_pending'
         AND X.general_mediation_private === '非公開予定'
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  sidebarCounts ← calculateStatusCounts([X])
  filteredByCategory ← filterByStatus([X], '非公開予定（確認後）')
  ASSERT sidebarCounts['非公開予定（確認後）'] = 0
  ASSERT filteredByCategory.length = 0
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)  // カウントとフィルタリング結果が変わらない
END FOR
```
