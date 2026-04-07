# Bugfix Requirements Document

## Introduction

売主リストのサイドバーにおいて、AA13224とAA13932が「当日TEL」カテゴリに表示されない問題を修正します。

これらの売主は以下の条件を満たしているため、「当日TEL」カテゴリに表示されるべきです：
- 次電日が今日以前（AA13224: 2026-04-07、AA13932: 2026-04-06）
- コミュニケーション情報が空（phone_contact_person、preferred_contact_time、contact_methodが全て空）
- 営業担当（visit_assignee）が空
- ステータスが「追客中」または「他決→追客」

調査の結果、データベースには正しいデータが保存されており、`getSidebarCountsFallback()`メソッドのクエリロジックも正しいことが確認されました。問題の根本原因は、`seller_sidebar_counts`テーブルが古いデータを保持していることです。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `seller_sidebar_counts`テーブルが古いデータを保持している THEN AA13224とAA13932が「当日TEL」カテゴリに表示されない

1.2 WHEN `seller_sidebar_counts`テーブルのtodayCallカウントが21件（更新日時: 2026-04-07T02:33:49）である THEN 実際の条件を満たす売主数（23件以上）と一致しない

1.3 WHEN GASの自動同期が実行されて`seller_sidebar_counts`テーブルを更新する THEN 古いロジックまたは不完全なデータで更新される可能性がある

### Expected Behavior (Correct)

2.1 WHEN AA13224（status="他決→追客", next_call_date="2026-04-07", visit_assignee=null, コミュニケーション情報=空）が存在する THEN システムは「当日TEL」カテゴリにAA13224を表示する

2.2 WHEN AA13932（status="追客中", next_call_date="2026-04-06", visit_assignee=null, コミュニケーション情報=空）が存在する THEN システムは「当日TEL」カテゴリにAA13932を表示する

2.3 WHEN `seller_sidebar_counts`テーブルが更新される THEN 最新のデータベースの状態を正確に反映したカウントが保存される

2.4 WHEN `getSidebarCountsFallback()`メソッドが実行される THEN 「追客中」と「他決→追客」の両方のステータスを持つ売主を正しく取得する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 他の売主が「当日TEL」カテゴリの条件を満たしている THEN システムはそれらの売主を引き続き正しく表示する

3.2 WHEN `getSidebarCountsFallback()`メソッドのクエリロジックが実行される THEN 既存の正しいロジック（「追客中」をilike検索、「他決→追客」を完全一致検索、両方をマージ）が維持される

3.3 WHEN サイドバーの他のカテゴリ（「訪問日前日」「訪問済み」「未査定」など）が表示される THEN それらのカウントと表示が正しく維持される

3.4 WHEN `seller_sidebar_counts`テーブルからデータを取得できない場合 THEN システムは`getSidebarCountsFallback()`メソッドに自動的にフォールバックする
