# Bugfix Requirements Document

## Introduction

売主リストのサイドバーで「当日TEL（担当）」カテゴリの件数が正しく表示されていないバグ。
ステアリングドキュメントの定義では「営担あり + 次電日が今日以前」の売主が対象だが、
サイドバーUIに「当日TEL（担当）」の合計カテゴリボタン自体が存在しないため、
件数が表示されない（または著しく少なく見える）状態になっている。

また、「訪問予定」「訪問済み」カテゴリも同様にサイドバーに表示されていない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーが表示される THEN `renderAllCategories()` に「当日TEL（担当）」の合計カテゴリボタンが存在しないため、`todayCallAssigned` の件数が表示されない

1.2 WHEN 担当者別サブカテゴリ（`当日TEL(Y)` など）が表示される THEN `assigneeInitials` propが空の場合、`sellers` データから `visitAssigneeInitials` を動的取得するが、このフィールドが存在しない売主では件数が0になりボタン自体が非表示になる

1.3 WHEN サイドバーが表示される THEN 「訪問予定（①）」「訪問済み（②）」カテゴリボタンも `renderAllCategories()` に存在しないため表示されない

### Expected Behavior (Correct)

2.1 WHEN サイドバーが表示される THEN 「当日TEL（担当）」カテゴリボタンが表示され、`isTodayCallAssigned` 条件（営担あり + 次電日が今日以前）を満たす売主の合計件数が正しく表示される

2.2 WHEN 担当者別サブカテゴリを表示する THEN `visitAssigneeInitials` と `visit_assignee` の両方を参照し、いずれかに値がある売主を正しくカウントする

2.3 WHEN サイドバーが表示される THEN 「訪問予定」「訪問済み」カテゴリボタンが表示され、それぞれ `isVisitScheduled`・`isVisitCompleted` 条件を満たす売主の件数が正しく表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「当日TEL分」カテゴリが表示される THEN 追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし の条件で引き続き正しくフィルタリングされる

3.2 WHEN 「当日TEL（内容）」カテゴリが表示される THEN 追客中 + 次電日が今日以前 + コミュニケーション情報のいずれかに入力あり + 営担なし の条件で引き続き正しくフィルタリングされる

3.3 WHEN 担当者別サブカテゴリ（`当日TEL(Y)` など）が表示される THEN 各担当者の当日TEL件数が引き続き正しく表示される

3.4 WHEN 「未査定」「査定（郵送）」「当日TEL_未着手」「Pinrich空欄」カテゴリが表示される THEN 既存の条件で引き続き正しくフィルタリングされる

3.5 WHEN カテゴリをクリックする THEN 売主リストが選択したカテゴリでフィルタリングされる既存の動作が維持される
