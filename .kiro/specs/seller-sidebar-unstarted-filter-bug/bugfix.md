# Bugfix Requirements Document

## Introduction

売主リストのサイドバーで「当日TEL_未着手」カテゴリに件数（例：「未着手１」）が表示されているにもかかわらず、クリックすると「データなし」になるバグ。

根本原因はサイドバーのカウント計算（`getSidebarCountsFallback`）とフィルタリング（`listSellers` の `statusCategory=todayCallNotStarted`）で「追客中」の判定ロジックが異なることにある。

- **カウント計算**：DBクエリで `ilike('%追客中%')` を使用 → 「除外後追客中」「他決→追客」なども対象に含まれる可能性がある
- **フィルタリング**：JSで `status !== '追客中'`（完全一致）を使用 → 「除外後追客中」などは除外される

この不一致により、カウントに含まれる売主がフィルタリング結果に現れない状態が発生する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーの「当日TEL_未着手」カテゴリに1件以上のカウントが表示されている状態でクリックする THEN システムは「データなし」（0件）を表示する

1.2 WHEN `getSidebarCountsFallback()` が「当日TEL_未着手」のカウントを計算する THEN システムは `ilike('%追客中%')` でDBから取得した `filteredTodayCallSellers` を元に `status === '追客中'`（完全一致）でフィルタするが、DBクエリの `ilike('%追客中%')` には「除外後追客中」なども含まれるため、実際のカウントが `listSellers()` のフィルタ結果と一致しない

1.3 WHEN `listSellers()` が `statusCategory=todayCallNotStarted` でフィルタリングする THEN システムは `next_call_date <= todayJST` の全売主を取得してJSで `status !== '追客中'`（完全一致）でフィルタするが、カウント計算で使用した `filteredTodayCallSellers`（`ilike('%追客中%')` ベース）と対象売主が異なる

### Expected Behavior (Correct)

2.1 WHEN サイドバーの「当日TEL_未着手」カテゴリに1件以上のカウントが表示されている状態でクリックする THEN システムはカウントと同数の売主リストを表示する SHALL

2.2 WHEN `getSidebarCountsFallback()` が「当日TEL_未着手」のカウントを計算する THEN システムは `listSellers()` の `statusCategory=todayCallNotStarted` フィルタリングと完全に同一の条件（`status === '追客中'` 完全一致）を使用してカウントを計算する SHALL

2.3 WHEN `listSellers()` が `statusCategory=todayCallNotStarted` でフィルタリングする THEN システムはカウント計算と同一の条件でフィルタリングし、カウントと一致する件数の売主を返す SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `statusCategory=todayCall`（当日TEL分）でフィルタリングする THEN システムは SHALL CONTINUE TO 「追客中 OR 他決→追客」かつ「営担なし」かつ「コミュニケーション情報なし」の売主を正しく返す

3.2 WHEN `statusCategory=unvaluated`（未査定）でフィルタリングする THEN システムは SHALL CONTINUE TO 「追客中」かつ「査定額なし」かつ「反響日付が基準日以降」の売主を正しく返す

3.3 WHEN `statusCategory=pinrichEmpty`（Pinrich空欄）でフィルタリングする THEN システムは SHALL CONTINUE TO 「当日TEL分の条件」かつ「Pinrichが空欄」の売主を正しく返す

3.4 WHEN サイドバーの「当日TEL_未着手」以外のカテゴリをクリックする THEN システムは SHALL CONTINUE TO そのカテゴリのカウントと一致する売主リストを表示する
