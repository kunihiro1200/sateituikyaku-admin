# バグ修正要件ドキュメント

## Introduction

売主リストサイドバーにおいて、AA13953が「⑤未査定」カテゴリに表示されているが、本来は「⑦当日TEL_未着手」カテゴリに表示されるべきである。

このバグは `isUnvaluated()` 関数内の除外ロジックと `isTodayCallNotStarted()` 関数の判定条件の不整合によって発生している。具体的には、`isTodayCallNotStarted()` が `true` を返すべき売主に対して、`isUnvaluated()` が `false` を返さず（除外されず）、結果として「未査定」カテゴリに誤って表示される。

影響ファイル: `frontend/frontend/src/utils/sellerStatusFilters.ts`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主が「当日TEL_未着手」の全条件（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし + 不通が空欄 + 反響日付が2026/1/1以降）を満たす THEN システムは `isTodayCallNotStarted()` が `true` を返すにもかかわらず `isUnvaluated()` も `true` を返し、「⑤未査定」カテゴリに表示する

1.2 WHEN AA13953のような売主が「当日TEL_未着手」条件を満たす THEN システムは「⑦当日TEL_未着手」ではなく「⑤未査定」カテゴリに誤って分類する

### Expected Behavior (Correct)

2.1 WHEN 売主が「当日TEL_未着手」の全条件を満たす THEN システムは `isTodayCallNotStarted()` が `true` を返す場合に `isUnvaluated()` が `false` を返し（未着手が優先）、「⑦当日TEL_未着手」カテゴリにのみ表示する SHALL

2.2 WHEN AA13953のような売主が「当日TEL_未着手」条件を満たす THEN システムは「⑦当日TEL_未着手」カテゴリに正しく表示し、「⑤未査定」カテゴリには表示しない SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主の反響日付が2026/1/1より前（例: 2025-12-10）であり「当日TEL_未着手」条件を満たさない THEN システムは SHALL CONTINUE TO その売主を「⑤未査定」カテゴリに表示する（未着手条件を満たさないため除外されない）

3.2 WHEN 売主の反響日付が基準日（2025/12/8）ちょうどであり「当日TEL_未着手」条件を満たさない THEN システムは SHALL CONTINUE TO その売主を「⑤未査定」カテゴリに表示する

3.3 WHEN 売主に営担（visitAssignee）が入力されている THEN システムは SHALL CONTINUE TO その売主を「⑤未査定」カテゴリに表示しない

3.4 WHEN 売主が「当日TEL分」の条件を満たす（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし） THEN システムは SHALL CONTINUE TO その売主を「③当日TEL分」カテゴリに表示する
