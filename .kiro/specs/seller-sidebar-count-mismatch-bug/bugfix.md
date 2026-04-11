# Bugfix Requirements Document

## Introduction

売主リストのサイドバーに表示されているカテゴリーのカウント数と、そのカテゴリーをクリックしたときに実際に表示される件数が一致しないバグ。

カウント数は `seller_sidebar_counts` テーブル（`SellerSidebarCountsUpdateService` / `getSidebarCountsFallback()` で計算）から取得される。一方、カテゴリークリック時の一覧表示は `SellerService.getSellers()` の `statusCategory` スイッチ文でフィルタリングされる。この2つのロジックの条件が複数カテゴリで一致していないため、カウントと実際の件数にずれが生じている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーの「訪問日前日１」カテゴリーに「1」と表示されている状態でクリックする THEN システムは2件の売主を表示する（カウントと実際の件数が一致しない）

1.2 WHEN `todayCallAssigned`（当日TEL担当）カテゴリーのカウントを計算する THEN システムは `.ilike('status', '%追客中%')` 条件を含めてカウントするが、フィルタリング時は `追客中` チェックなしで一覧を返す

1.3 WHEN `todayCallNotStarted`（当日TEL_未着手）カテゴリーのカウントを計算する THEN システムは `他決→追客` ステータスを含めてカウントするが、フィルタリング時は `.ilike('status', '%追客中%')` のみで `他決→追客` を含まない一覧を返す

1.4 WHEN `pinrichEmpty`（Pinrich空欄）カテゴリーのカウントを計算する THEN システムは `他決→追客` ステータスを含めてカウントするが、フィルタリング時は `.ilike('status', '%追客中%')` のみで `他決→追客` を含まない一覧を返す

1.5 WHEN `exclusive`（専任）・`general`（一般）・`visitOtherDecision`（訪問後他決）・`unvisitedOtherDecision`（未訪問他決）カテゴリーのカウントを計算する THEN システムは `nextCallDate !== todayJST`（今日以外）という条件でカウントするが、フィルタリング時は Supabase の `.or('next_call_date.is.null,next_call_date.neq.${todayJST}')` を使用しており、NULL の扱いが異なる可能性がある

### Expected Behavior (Correct)

2.1 WHEN サイドバーの任意のカテゴリーに「N」と表示されている状態でクリックする THEN システムは SHALL ちょうど N 件の売主を表示する（カウントと実際の件数が一致する）

2.2 WHEN `todayCallAssigned` カテゴリーのフィルタリングを実行する THEN システムは SHALL カウント計算と同じ条件（`追客中` を含む AND `追客不要`・`専任媒介`・`一般媒介`・`他社買取` を除外）で一覧を返す

2.3 WHEN `todayCallNotStarted` カテゴリーのフィルタリングを実行する THEN システムは SHALL カウント計算と同じ条件（`追客中` を含む OR `他決→追客` と完全一致）で一覧を返す

2.4 WHEN `pinrichEmpty` カテゴリーのフィルタリングを実行する THEN システムは SHALL カウント計算と同じ条件（`追客中` を含む OR `他決→追客` と完全一致）で一覧を返す

2.5 WHEN `exclusive`・`general`・`visitOtherDecision`・`unvisitedOtherDecision` カテゴリーのフィルタリングを実行する THEN システムは SHALL カウント計算と同じ条件（`exclusive_other_decision_meeting !== '完了'` AND `next_call_date` が NULL または今日以外）で一覧を返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `visitDayBefore`（訪問日前日）カテゴリーをクリックする THEN システムは SHALL CONTINUE TO 訪問日前日に該当する売主のみを表示する（このカテゴリーは既に両ロジックが一致している）

3.2 WHEN `visitCompleted`（訪問済み）カテゴリーをクリックする THEN システムは SHALL CONTINUE TO 訪問済みの売主のみを表示する

3.3 WHEN `todayCall`（当日TEL分）カテゴリーをクリックする THEN システムは SHALL CONTINUE TO 当日TEL分の売主のみを表示する

3.4 WHEN `unvaluated`（未査定）カテゴリーをクリックする THEN システムは SHALL CONTINUE TO 未査定の売主のみを表示する

3.5 WHEN `mailingPending`（査定郵送）カテゴリーをクリックする THEN システムは SHALL CONTINUE TO 査定郵送待ちの売主のみを表示する

3.6 WHEN `visitAssigned:xxx`（担当者別）カテゴリーをクリックする THEN システムは SHALL CONTINUE TO 指定担当者の売主のみを表示する

3.7 WHEN カテゴリーを選択せず全件表示の状態でリストを表示する THEN システムは SHALL CONTINUE TO 全売主を表示する
