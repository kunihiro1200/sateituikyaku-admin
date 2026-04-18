# Bugfix Requirements Document

## Introduction

売主リストのサイドバーカウントにおいて「訪問日前日」のカウントが **2** と表示されているのに、クリックすると **3件** が表示されるバグを修正します。

このバグは何度も再発しており、根本原因の特定と恒久的な修正が必要です。

### 調査結果（Git履歴 `b3ce2524` 参照）

コミット `b3ce2524` のメッセージ：
> `fix: remove !exclusionDate check from getSidebarCountsFallback unvaluatedCount`

このコミットは「未査定」カテゴリの修正でしたが、今回のバグは「訪問日前日」カテゴリです。

**現在のコードで発見された根本原因**：

`getSidebarCountsFallback()` と `listSellers()` の `visitDayBefore` フィルタリングロジックで、
`new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))` を使用しています。
これは**ローカルタイムゾーン依存**のコードです。

一方、`SellerSidebarCountsUpdateService` では `Date.UTC()` を使用しており、
**2つの実装間でタイムゾーン処理が異なります**。

Vercel（UTC環境）では `new Date(year, month, day)` がUTC基準で動作するため、
JST（UTC+9）との9時間差により、日付の境界付近で誤った曜日・前日計算が発生します。

具体的には：
- `getSidebarCountsFallback()` → `new Date(year, month, day)` → ローカルタイムゾーン依存
- `listSellers()` の `visitDayBefore` → `new Date(year, month, day)` → ローカルタイムゾーン依存
- `SellerSidebarCountsUpdateService` → `Date.UTC(year, month, day)` → UTC基準（正しい）

この不一致により、サイドバーカウントと一覧件数が異なる結果を返します。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 訪問日前日カテゴリのサイドバーカウントを表示する THEN `getSidebarCountsFallback()` が `new Date(year, month, day)` でローカルタイムゾーン依存の曜日計算を行い、誤ったカウント（例：2件）を返す

1.2 WHEN 訪問日前日カテゴリをクリックして一覧を表示する THEN `listSellers()` の `visitDayBefore` フィルタも同じ `new Date(year, month, day)` を使用しているが、サーバー環境（UTC）とローカル環境（JST）で異なる結果を返す場合がある

1.3 WHEN `SellerSidebarCountsUpdateService` が `seller_sidebar_counts` テーブルを更新する THEN `Date.UTC()` を使用するため正しいカウント（例：3件）を計算するが、`getSidebarCountsFallback()` は異なる値を返す

1.4 WHEN 同じバグが過去に修正されても THEN `getSidebarCountsFallback()` と `listSellers()` のタイムゾーン処理が統一されていないため、再発する

### Expected Behavior (Correct)

2.1 WHEN 訪問日前日カテゴリのサイドバーカウントを表示する THEN `getSidebarCountsFallback()` が `Date.UTC(year, month, day)` でタイムゾーン非依存の曜日計算を行い、正しいカウントを返す

2.2 WHEN 訪問日前日カテゴリをクリックして一覧を表示する THEN `listSellers()` の `visitDayBefore` フィルタも `Date.UTC(year, month, day)` を使用し、サイドバーカウントと一致する件数を返す

2.3 WHEN `SellerSidebarCountsUpdateService`、`getSidebarCountsFallback()`、`listSellers()` の3箇所すべてで訪問日前日を判定する THEN 同一のタイムゾーン安全なロジック（`Date.UTC()`）を使用し、常に同じ結果を返す

2.4 WHEN 訪問日が木曜日の場合 THEN 3箇所すべてで「2日前（火曜日）」を正しく計算する

2.5 WHEN 訪問日が木曜日以外の場合 THEN 3箇所すべてで「1日前」を正しく計算する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 訪問日前日以外のサイドバーカテゴリ（当日TEL、未査定、訪問済み等）を表示する THEN 既存のカウントと一覧件数が変わらない

3.2 WHEN `visit_reminder_assignee` に値がある売主が存在する THEN 訪問日前日カテゴリから除外される既存の動作が維持される

3.3 WHEN `visit_assignee` が空または「外す」の売主が存在する THEN 訪問日前日カテゴリから除外される既存の動作が維持される

3.4 WHEN 訪問日が空欄の売主が存在する THEN 訪問日前日カテゴリから除外される既存の動作が維持される

---

## Bug Condition（バグ条件）

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerRecord
  OUTPUT: boolean
  
  // 訪問日前日の判定でローカルタイムゾーン依存のnew Date()を使用している
  RETURN X.visit_date is not null
    AND X.visit_assignee is not null and not empty
    AND X.visit_reminder_assignee is null or empty
    AND getSidebarCountsFallback().visitDayBefore ≠ listSellers('visitDayBefore').total
END FUNCTION
```

```pascal
// Property: Fix Checking - 訪問日前日カウント一致
FOR ALL X WHERE isBugCondition(X) DO
  sidebarCount ← getSidebarCounts().visitDayBefore
  listResult ← listSellers({ statusCategory: 'visitDayBefore' })
  ASSERT sidebarCount = listResult.total
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)  // 他カテゴリのカウントは変わらない
END FOR
```

---

## 対象ファイル

- `backend/src/services/SellerService.supabase.ts`
  - `getSidebarCountsFallback()` メソッド内の `visitDayBeforeCount` 計算
  - `listSellers()` メソッド内の `case 'visitDayBefore'` フィルタリング
