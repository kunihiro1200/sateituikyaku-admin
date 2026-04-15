# Bugfix Requirements Document

## Introduction

売主リストのサイドバーカテゴリーにおいて、同一の売主が複数のカテゴリーに重複して表示されるバグを修正する。

具体的には、「当日TEL_未着手」（`todayCallNotStarted`）カテゴリーは「当日TEL分」（`todayCall`）のサブセットとして定義されているにもかかわらず、`filterSellersByCategory` に排他制御がないため、「未着手」条件を満たす売主が「当日TEL分」カテゴリーにも同時に表示されてしまっている。

重複が発生した場合は「未着手」（`todayCallNotStarted`）を優先し、「当日TEL分」（`todayCall`）には表示しない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主が「当日TEL_未着手」（`isTodayCallNotStarted`）の条件を満たす THEN システムはその売主を「当日TEL分」カテゴリーにも表示する

1.2 WHEN 「当日TEL分」カテゴリーが選択される THEN システムは「当日TEL_未着手」に該当する売主を除外せずに返す

### Expected Behavior (Correct)

2.1 WHEN 売主が「当日TEL_未着手」（`isTodayCallNotStarted`）の条件を満たす THEN システムはその売主を「当日TEL分」カテゴリーには表示しない（「未着手」を優先）

2.2 WHEN 「当日TEL分」カテゴリーが選択される THEN システムは「当日TEL_未着手」に該当する売主を除いた結果を SHALL 返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主が「当日TEL_未着手」の条件を満たす THEN システムは SHALL CONTINUE TO その売主を「当日TEL_未着手」カテゴリーに表示する

3.2 WHEN 売主が「当日TEL分」の条件を満たし「当日TEL_未着手」の条件を満たさない THEN システムは SHALL CONTINUE TO その売主を「当日TEL分」カテゴリーに表示する

3.3 WHEN 売主が「当日TEL分」の条件を満たさない THEN システムは SHALL CONTINUE TO その売主を「当日TEL分」カテゴリーに表示しない

3.4 WHEN 「全て」カテゴリーが選択される THEN システムは SHALL CONTINUE TO 全売主を返す

3.5 WHEN 「当日TEL分」以外のカテゴリー（訪問日前日・訪問済み・未査定・査定郵送・Pinrich空欄など）が選択される THEN システムは SHALL CONTINUE TO 既存のフィルタリング結果を変えずに返す
