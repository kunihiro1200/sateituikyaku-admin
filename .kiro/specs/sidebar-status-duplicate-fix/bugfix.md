# Bugfix Requirements Document

## Introduction

売主リストのサイドバーカテゴリーに2つのバグがある。

**バグ1**: 「未査定」と「未着手（当日TEL_未着手）」の両方の条件を満たす案件が、両カテゴリーに重複表示されてしまっている。優先順位のルール上、「未着手」に表示される案件は「未査定」から除外しなければならない。

**バグ2**: サイドバーのバッジ数（件数）と、カテゴリーをクリックして展開したときに表示される実際の件数が一致していない。例えば「未着手1件」と表示されているのにクリックすると2件表示される。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 案件が「未着手（todayCallNotStarted）」の条件を満たし、かつ「未査定（unvaluated）」の条件も満たす THEN システムは当該案件を「未着手」と「未査定」の両方のカテゴリーに表示する

1.2 WHEN `isUnvaluated()` が「未着手」除外ロジックをインライン展開して評価する THEN システムは `isTodayCallBase()` の対象ステータス（「除外後追客中」「他決→追客」を含む）を考慮せず、`status === '追客中'` の完全一致のみで除外判定するため、除外が不完全になる

1.3 WHEN ユーザーがサイドバーの「当日TEL_未着手」カテゴリーをクリックして展開する THEN システムはバッジに表示されている件数と異なる件数の案件リストを表示する

1.4 WHEN `SellerStatusSidebar.tsx` の `getCount()` が `categoryCounts`（全件対象）から件数を取得し、展開リストの `filteredSellers` が `filterSellersByCategory(validSellers, category)` でローカルの `validSellers`（ページネーション表示中の件数のみ）をフィルタリングする THEN システムはバッジ数と展開リストの件数が一致しない状態になる

### Expected Behavior (Correct)

2.1 WHEN 案件が「未着手（todayCallNotStarted）」の条件を満たす THEN システムは当該案件を「未査定」カテゴリーから除外し、「未着手」カテゴリーにのみ表示する

2.2 WHEN `isUnvaluated()` が「未着手」除外判定を行う THEN システムは `isTodayCallNotStarted()` 関数を直接呼び出して除外判定し、インライン展開による不整合を排除する

2.3 WHEN ユーザーがサイドバーのカテゴリーをクリックして展開する THEN システムはバッジに表示されている件数と同じ件数の案件リストを表示する

2.4 WHEN 展開リストの件数を計算する THEN システムはバッジ数と同じデータソース（全件対象）を使用してフィルタリングする

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 案件が「未着手」の条件を満たさず「未査定」の条件のみを満たす THEN システムは当該案件を「未査定」カテゴリーに引き続き表示する

3.2 WHEN 案件が「未着手」の条件を満たす THEN システムは当該案件を「未着手」カテゴリーに引き続き表示する

3.3 WHEN 案件が「当日TEL分」の条件を満たす THEN システムは当該案件を「当日TEL分」カテゴリーに引き続き表示する

3.4 WHEN 案件が「査定（郵送）」の条件を満たす THEN システムは当該案件を「査定（郵送）」カテゴリーに引き続き表示する

3.5 WHEN `expandedCategorySellers`（APIから取得した全件データ）が存在する THEN システムは展開リストの表示に引き続きそのデータを優先使用する
