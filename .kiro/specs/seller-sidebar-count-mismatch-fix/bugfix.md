# Bugfix Requirements Document

## Introduction

売主リストのサイドバーにおいて、全カテゴリでカウント数とクリック時のリスト件数が一致しない問題、カテゴリ間の優先順位（当日TEL_未着手 > 未査定など）が守られていない問題、および同じ売主が複数カテゴリに重複してカウントされる問題を根本的に修正する。

根本原因は `SellerSidebarCountsUpdateService`（カウント計算）と `SellerService.listSellers()`（フィルタリング）の2つのロジックが独立して実装されており、条件が一致していないことにある。また、カテゴリ間の排他的優先順位（1人の売主は必ず1つのカテゴリにのみ属する）がカウント計算側では部分的に実装されているが、フィルタリング側では実装されていない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーの任意のカテゴリに「N」件と表示されている状態でクリックする THEN システムはN件と異なる件数のリストを表示する

1.2 WHEN `SellerSidebarCountsUpdateService` が「当日TEL_未着手（todayCallNotStarted）」のカウントを計算する THEN システムは `status === '追客中'`（完全一致）かつ `unreachable_status` が空かつ `confidence_level` が「ダブり」「D」「AI査定」でないかつ `inquiry_date >= '2026-01-01'` の条件でカウントするが、`listSellers()` のフィルタリングでは異なる条件（`ilike('%追客中%')` など）を使用するため件数が一致しない

1.3 WHEN `SellerSidebarCountsUpdateService` が「当日TEL分（todayCall）」のカウントを計算する THEN システムは「当日TEL_未着手」条件を満たす売主を除外してカウントするが、`listSellers()` の `statusCategory=todayCall` フィルタリングでは「当日TEL_未着手」条件の売主を除外せずに返すため件数が一致しない

1.4 WHEN `SellerSidebarCountsUpdateService` が「未査定（unvaluated）」のカウントを計算する THEN システムは「当日TEL_未着手」条件を満たす売主を除外してカウントするが、`listSellers()` の `statusCategory=unvaluated` フィルタリングでは「当日TEL_未着手」条件の売主を除外せずに返すため件数が一致しない

1.5 WHEN `SellerSidebarCountsUpdateService` が「Pinrich空欄（pinrichEmpty）」のカウントを計算する THEN システムは `filteredTodayCallSellers`（`ilike('%追客中%')` OR `status === '他決→追客'`）を基底集合としてカウントするが、`listSellers()` の `statusCategory=pinrichEmpty` フィルタリングでは異なる基底集合を使用するため件数が一致しない

1.6 WHEN 同一の売主が「当日TEL_未着手」の条件を満たしかつ「未査定」の条件も満たす THEN システムはその売主を両方のカテゴリのカウントに含める（重複カウント）

1.7 WHEN 同一の売主が「当日TEL_未着手」の条件を満たしかつ「当日TEL分」の条件も満たす THEN システムはカウント計算では「当日TEL_未着手」のみにカウントするが、フィルタリングでは「当日TEL分」にも表示する（重複表示）

### Expected Behavior (Correct)

2.1 WHEN サイドバーの任意のカテゴリに「N」件と表示されている状態でクリックする THEN システムはちょうどN件の売主リストを表示する SHALL

2.2 WHEN `listSellers()` が `statusCategory=todayCallNotStarted` でフィルタリングする THEN システムは SHALL `SellerSidebarCountsUpdateService` と完全に同一の条件（`status === '追客中'` 完全一致 + `unreachable_status` が空 + `confidence_level` が「ダブり」「D」「AI査定」でない + `inquiry_date >= '2026-01-01'` + コミュニケーション情報が全て空 + 営担なし + 次電日が今日以前）でフィルタリングする

2.3 WHEN `listSellers()` が `statusCategory=todayCall` でフィルタリングする THEN システムは SHALL カウント計算と同様に「当日TEL_未着手」条件を満たす売主を除外した上で残りの売主を返す

2.4 WHEN `listSellers()` が `statusCategory=unvaluated` でフィルタリングする THEN システムは SHALL カウント計算と同様に「当日TEL_未着手」条件を満たす売主を除外した上で残りの売主を返す

2.5 WHEN `listSellers()` が `statusCategory=pinrichEmpty` でフィルタリングする THEN システムは SHALL `SellerSidebarCountsUpdateService` と完全に同一の基底集合（`ilike('%追客中%')` OR `status === '他決→追客'`）を使用してフィルタリングする

2.6 WHEN カテゴリ優先順位が「当日TEL_未着手 > 未査定 > 当日TEL分」と定義されている THEN システムは SHALL 1人の売主を最高優先順位の1カテゴリにのみカウント・表示し、他のカテゴリには含めない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `statusCategory=visitDayBefore`（訪問日前日）でフィルタリングする THEN システムは SHALL CONTINUE TO 訪問日前日に該当する売主のみを返す

3.2 WHEN `statusCategory=visitCompleted`（訪問済み）でフィルタリングする THEN システムは SHALL CONTINUE TO 訪問済みの売主のみを返す

3.3 WHEN `statusCategory=todayCallAssigned`（当日TEL担当）でフィルタリングする THEN システムは SHALL CONTINUE TO 営担あり + 次電日が今日以前の売主のみを返す

3.4 WHEN `statusCategory=todayCallWithInfo`（当日TEL内容）でフィルタリングする THEN システムは SHALL CONTINUE TO コミュニケーション情報ありの当日TEL分売主のみを返す

3.5 WHEN `statusCategory=mailingPending`（査定郵送）でフィルタリングする THEN システムは SHALL CONTINUE TO 郵送ステータスが「未」の売主のみを返す

3.6 WHEN `statusCategory=exclusive`（専任）・`general`（一般）・`visitOtherDecision`（訪問後他決）・`unvisitedOtherDecision`（未訪問他決）でフィルタリングする THEN システムは SHALL CONTINUE TO 各カテゴリの条件に合致する売主のみを返す

3.7 WHEN カテゴリを選択せず全件表示の状態でリストを表示する THEN システムは SHALL CONTINUE TO 全売主を表示する

3.8 WHEN `visitAssigned:xxx`（担当者別）カテゴリをクリックする THEN システムは SHALL CONTINUE TO 指定担当者の売主のみを表示する
