# バグ修正要件ドキュメント

## Introduction

売主リストサイドバーにおいて、AA13967が「⑤未査定」カテゴリに表示されているが、本来は「⑦当日TEL_未着手」カテゴリに表示されるべきである。

このバグは `isTodayCallNotStarted()` 関数（フロントエンド）および `todayCallNotStartedCount` 計算ロジック（バックエンド）において、`exclusion_date`（除外日）のチェックが欠落していることで発生している。

具体的には：
- `isTodayCallNotStarted()` のコメントには「除外日にすること = ""（空）」という条件が記載されているが、実装コードにはそのチェックが存在しない
- `exclusion_date` が設定されている売主は `isTodayCallNotStarted()` が `true` を返すべきところを返さない
- 結果として `isUnvaluated()` の除外ロジック（`if (isTodayCallNotStarted(seller)) return false`）が機能せず、「未査定」に誤って表示される

影響ファイル:
- `frontend/frontend/src/utils/sellerStatusFilters.ts`（`isTodayCallNotStarted` 関数）
- `backend/src/services/SellerSidebarCountsUpdateService.ts`（`todayCallNotStartedCount` 計算）
- `backend/src/services/SellerService.supabase.ts`（`getSidebarCountsFallback` の `todayCallNotStartedCount` 計算）

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主が「当日TEL_未着手」の全条件（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし + 不通が空欄 + 反響日付が2026/1/1以降）を満たし、かつ `exclusion_date`（除外日）が設定されている THEN システムは `isTodayCallNotStarted()` が `false` を返すべきところを `true` を返し、「⑦当日TEL_未着手」カテゴリに誤って分類しようとする

1.2 WHEN AA13967のような売主が `exclusion_date` を持ちながら「当日TEL_未着手」の他の条件を満たす THEN システムは `isUnvaluated()` の除外ロジックが正しく機能せず、「⑤未査定」カテゴリに誤って表示する

1.3 WHEN バックエンドの `todayCallNotStartedCount` を計算する際に `exclusion_date` が設定されている売主が含まれる THEN システムは `exclusion_date` チェックなしにカウントするため、サイドバーのカウント数が実際のリスト件数と一致しない

### Expected Behavior (Correct)

2.1 WHEN 売主が `exclusion_date`（除外日）を持つ THEN システムは `isTodayCallNotStarted()` が `false` を返し、「⑦当日TEL_未着手」カテゴリに含めない SHALL

2.2 WHEN AA13967のような売主が `exclusion_date` を持つ THEN システムは `isUnvaluated()` の除外ロジックが正しく機能し、「⑤未査定」カテゴリに表示しない SHALL（未査定の条件を満たす場合は未査定に、満たさない場合はどちらにも表示しない）

2.3 WHEN バックエンドの `todayCallNotStartedCount` を計算する際 THEN システムは `exclusion_date` が設定されている売主を除外してカウントし、サイドバーのカウント数とリスト件数が一致する SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主が `exclusion_date` を持たず「当日TEL_未着手」の全条件を満たす THEN システムは SHALL CONTINUE TO その売主を「⑦当日TEL_未着手」カテゴリに表示する

3.2 WHEN 売主が `exclusion_date` を持たず「未査定」の条件を満たし「当日TEL_未着手」の条件を満たさない THEN システムは SHALL CONTINUE TO その売主を「⑤未査定」カテゴリに表示する

3.3 WHEN 売主の `unreachable_status`（不通）に値が入っている THEN システムは SHALL CONTINUE TO その売主を「⑦当日TEL_未着手」カテゴリに表示しない

3.4 WHEN 売主の `confidence_level`（確度）が「ダブり」「D」「AI査定」のいずれかである THEN システムは SHALL CONTINUE TO その売主を「⑦当日TEL_未着手」カテゴリに表示しない

3.5 WHEN 売主の `inquiry_date`（反響日付）が2026/1/1より前である THEN システムは SHALL CONTINUE TO その売主を「⑦当日TEL_未着手」カテゴリに表示しない
