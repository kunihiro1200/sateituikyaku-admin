# Bugfix Requirements Document

## Introduction

売主リストのサイドバーカテゴリー「Pinrich要変更」が実装されていないため、AA13712を含む対象売主がサイドバーに表示されない。

現在のサイドバーには「Pinrich空欄（⑧Pinrich空欄）」カテゴリは存在するが、「Pinrich要変更」カテゴリは存在しない。「Pinrich要変更」は「Pinrich空欄」とは異なる条件（Airtable数式で定義された4つのOR条件）を持つ独立したカテゴリである。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主が「Pinrich要変更」の条件（以下のいずれか）を満たす場合 THEN サイドバーに「Pinrich要変更」カテゴリが存在しないため、その売主はどのカテゴリにも表示されない

1.2 WHEN 売主AA13712が「Pinrich要変更」の条件を満たす場合 THEN サイドバーの「Pinrich要変更」カテゴリに表示されない

1.3 WHEN バックエンドのサイドバーカウント計算処理（`SellerSidebarCountsUpdateService`）が実行される場合 THEN `pinrichChangeRequired`カテゴリのカウントが計算・保存されない

1.4 WHEN フロントエンドのサイドバー（`SellerStatusSidebar`）が表示される場合 THEN 「Pinrich要変更」ボタンが存在しない

### Expected Behavior (Correct)

2.1 WHEN 売主が以下のいずれかの条件を満たす場合 THEN サイドバーの「Pinrich要変更」カテゴリにカウントされ、クリックで一覧表示される

- 条件A: `visit_assignee = "外す"` AND `pinrich_status = "クローズ"` AND `status = "追客中"`
- 条件B: `confidence_level = "D"` AND `pinrich_status` が `{"クローズ", "登録不要", "アドレスエラー", "配信不要（他決後、訪問後、担当付）", "△配信停止"}` のいずれでもない
- 条件C: `visit_date` が空欄でない AND `pinrich_status = "配信中"` AND `visit_assignee` が空欄でない AND `status` が `{"専任媒介", "追客中", "除外後追客中"}` のいずれか
- 条件D: `status` が `{"他決→追客", "他決→追客不要", "一般媒介"}` のいずれか AND `pinrich_status = "クローズ"` AND `contract_year_month >= "2025-05-01"`

2.2 WHEN 売主AA13712が上記条件のいずれかを満たす場合 THEN サイドバーの「Pinrich要変更」カテゴリに表示される

2.3 WHEN バックエンドのサイドバーカウント計算処理が実行される場合 THEN `pinrichChangeRequired`カテゴリのカウントが正しく計算され、`seller_sidebar_counts`テーブルに保存される

2.4 WHEN フロントエンドのサイドバーが表示される場合 THEN 「Pinrich要変更」ボタンが表示され、クリックすると対象売主の一覧が表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主が「Pinrich空欄（pinrichEmpty）」の条件を満たす場合 THEN 既存の「⑧Pinrich空欄」カテゴリに引き続き正しく表示される

3.2 WHEN 売主が「当日TEL分（todayCall）」の条件を満たす場合 THEN 既存の「③当日TEL分」カテゴリに引き続き正しく表示される

3.3 WHEN 売主が「当日TEL_未着手（todayCallNotStarted）」の条件を満たす場合 THEN 既存の「⑦当日TEL_未着手」カテゴリに引き続き正しく表示される

3.4 WHEN 売主が「専任（exclusive）」「一般（general）」「訪問後他決（visitOtherDecision）」「未訪問他決（unvisitedOtherDecision）」の条件を満たす場合 THEN それぞれの既存カテゴリに引き続き正しく表示される

3.5 WHEN `SellerSidebarCountsUpdateService`が実行される場合 THEN 既存の全カテゴリ（`todayCall`, `todayCallWithInfo`, `todayCallAssigned`, `visitDayBefore`, `visitCompleted`, `unvaluated`, `mailingPending`, `todayCallNotStarted`, `pinrichEmpty`, `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`）のカウントが引き続き正しく計算される
