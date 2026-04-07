# バグフィックス要件ドキュメント

## Introduction

売主リストのサイドバー表示において、「専任」「一般」「未訪問他決」「訪問後他決」の4つのカテゴリが完全に消えている問題を修正します。

**発生時期**: おととい頃から

**影響範囲**: 
- 売主一覧ページ（/sellers）のサイドバー
- 4つのカテゴリ（専任、一般、未訪問他決、訪問後他決）が完全に表示されない
- カテゴリ名も件数も表示されない

**データの状態**:
- データベースには該当する売主データが存在する（専任媒介の売主が実際にいる）
- 他のカテゴリ（訪問日前日、当日TEL分など）は正常に表示されている

**エラー情報**:
- ブラウザのコンソールに401エラー（認証エラー）が表示されている
- `/api/sellers/sidebar-counts`エンドポイントへのリクエストが401エラーを返している

**重要な発見**:
- `backend/src/routes/sellers.ts`の66-84行目を確認したところ、`/sidebar-counts`エンドポイントは認証不要のはずだが、82-84行目に`router.use(authenticate)`がある
- これは正しい配置のはずだが、何らかの変更で認証が必要になってしまった可能性がある

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが売主一覧ページ（/sellers）を開く THEN ブラウザコンソールに401エラー（認証エラー）が表示される

1.2 WHEN `/api/sellers/sidebar-counts`エンドポイントにリクエストが送信される THEN 401エラーが返される

1.3 WHEN サイドバーが表示される THEN 「専任」「一般」「未訪問他決」「訪問後他決」の4つのカテゴリが完全に表示されない（カテゴリ名も件数も表示されない）

1.4 WHEN データベースに専任媒介の売主が存在する THEN サイドバーに「専任」カテゴリが表示されない

### Expected Behavior (Correct)

2.1 WHEN ユーザーが売主一覧ページ（/sellers）を開く THEN `/api/sellers/sidebar-counts`エンドポイントが認証なしで正常にレスポンスを返す

2.2 WHEN `/api/sellers/sidebar-counts`エンドポイントにリクエストが送信される THEN 200 OKレスポンスが返され、全カテゴリのカウントが含まれる

2.3 WHEN サイドバーが表示される THEN 「専任」「一般」「未訪問他決」「訪問後他決」の4つのカテゴリが正しく表示される

2.4 WHEN データベースに専任媒介の売主が存在する THEN サイドバーに「専任」カテゴリと正しい件数が表示される

2.5 WHEN 専任カテゴリの条件を満たす売主が存在する THEN その売主は以下の条件を満たす:
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` > 今日
- `status` IN ("専任媒介", "他決→専任", "リースバック（専任）")

2.6 WHEN 一般カテゴリの条件を満たす売主が存在する THEN その売主は以下の条件を満たす:
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` > 今日
- `status` = "一般媒介"
- `contract_year_month` >= "2025-06-23"

2.7 WHEN 訪問後他決カテゴリの条件を満たす売主が存在する THEN その売主は以下の条件を満たす:
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` > 今日
- `status` IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
- `visit_assignee` IS NOT NULL AND `visit_assignee` ≠ ""

2.8 WHEN 未訪問他決カテゴリの条件を満たす売主が存在する THEN その売主は以下の条件を満たす:
- `exclusive_other_decision_meeting` ≠ "完了"
- `next_call_date` IS NULL OR `next_call_date` ≠ 今日
- `status` IN ("他決→追客", "他決→追客不要", "一般→他決")
- `visit_assignee` IS NULL OR `visit_assignee` = "" OR `visit_assignee` = "外す"

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 他のカテゴリ（訪問日前日、当日TEL分など）が表示される THEN それらのカテゴリは引き続き正常に表示される

3.2 WHEN `/api/sellers/sidebar-counts`エンドポイントが認証不要として定義されている THEN 他の認証が必要なエンドポイントは引き続き認証を要求する

3.3 WHEN サイドバーのカウントロジックが実装されている THEN 既存のカウントロジック（`getSidebarCountsFallback()`）は変更されない

3.4 WHEN フロントエンドがサイドバーカウントを取得する THEN 既存のAPIクライアント（`api.get('/api/sellers/sidebar-counts')`）は変更されない
