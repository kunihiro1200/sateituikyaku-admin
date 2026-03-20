# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（`/sellers/:id/call`）にある「近隣買主候補」テーブルで、以下のフィールドが全て「-」（空）で表示されるバグを修正する。

- 種別（`inquiry_property_type`）
- 問合せ住所（`property_address`）
- 価格（`inquiry_price`）
- ヒアリング/内覧結果（`inquiry_hearing` / `viewing_result_follow_up`）
- 最新状況（`latest_status`）
- 内覧日（`latest_viewing_date`）

**根本原因**: バックエンドの `BuyerService.getBuyersByAreas()` メソッドのSQLクエリに、フロントエンドが表示に必要とするフィールドが含まれていない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは `inquiry_property_type`（種別）を「-」と表示する

1.2 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは `property_address`（問合せ住所）を「-」と表示する

1.3 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは `inquiry_price`（価格）を「-」と表示する

1.4 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは `inquiry_hearing` および `viewing_result_follow_up`（ヒアリング/内覧結果）を「-」と表示する

1.5 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは `latest_status`（最新状況）を「-」と表示する

1.6 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは `latest_viewing_date`（内覧日）を「-」と表示する

### Expected Behavior (Correct)

2.1 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは SHALL 買主の `inquiry_property_type` フィールドの値（例: 「戸建」「マンション」「土地」）を表示する

2.2 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは SHALL 買主の `property_address` フィールドの値（問合せ時の物件住所）を表示する

2.3 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは SHALL 買主の `inquiry_price` フィールドの値を万円単位で表示する

2.4 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは SHALL 買主の `viewing_result_follow_up`（優先）または `inquiry_hearing` の値を表示する

2.5 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは SHALL 買主の `latest_status` フィールドの値を表示する

2.6 WHEN 通話モードページの「近隣買主候補」テーブルを表示する THEN システムは SHALL 買主の `latest_viewing_date` フィールドの値を日付形式で表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 近隣買主候補テーブルを表示する THEN システムは SHALL CONTINUE TO 買主番号（`buyer_number`）を正しく表示する

3.2 WHEN 近隣買主候補テーブルを表示する THEN システムは SHALL CONTINUE TO 名前（`name`）を正しく表示する

3.3 WHEN 近隣買主候補テーブルを表示する THEN システムは SHALL CONTINUE TO 配布エリア（`distribution_areas`）を正しく表示する

3.4 WHEN 近隣買主候補テーブルを表示する THEN システムは SHALL CONTINUE TO エリアフィルタリング・種別フィルタリング・価格フィルタリングのロジックを正しく動作させる

3.5 WHEN 近隣買主候補テーブルを表示する THEN システムは SHALL CONTINUE TO メール送信・SMS送信機能を正しく動作させる

3.6 WHEN 近隣買主候補テーブルを表示する THEN システムは SHALL CONTINUE TO 買主番号クリックで買主詳細ページへ遷移する
