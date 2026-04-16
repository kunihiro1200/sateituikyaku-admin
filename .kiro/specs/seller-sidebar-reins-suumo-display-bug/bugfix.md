# Bugfix Requirements Document

## Introduction

物件リストのサイドバーで「レインズ登録＋SUUMO登録」カテゴリーに、条件を満たす物件（AA13600など）が表示されないバグを修正します。

**影響範囲**: 物件リストページのサイドバーステータス表示

**根本原因**: `PropertyListingSyncService.calculateSidebarStatus()` が `gyomuListData`（業務リストデータ）から公開予定日を取得するが、`syncUpdatedPropertyListings()` および `detectUpdatedPropertyListings()` から呼び出す際に `gyomuListData` が渡されていない（空配列のデフォルト値が使用される）。そのため、公開予定日が常に `null` となり、「レインズ登録＋SUUMO登録」および「本日公開予定」の条件が満たされない。

**バグ条件 C(X)**:
```
C(X) = atbb_status === '専任・公開中'
       AND suumo_url が空
       AND suumo_registered !== 'S不要'
       AND work_tasks.publish_scheduled_date が昨日以前
       AND sidebar_status が '레インズ登録＋SUUMO登録' でない（表示されていない）
```

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件の `atbb_status` が「専任・公開中」AND `suumo_url` が空 AND `suumo_registered` が「S不要」でない AND `work_tasks.publish_scheduled_date` が昨日以前 THEN システムは物件を「レインズ登録＋SUUMO登録」カテゴリーに表示しない

1.2 WHEN `syncUpdatedPropertyListings()` が実行される THEN システムは `calculateSidebarStatus(row)` を `gyomuListData` なしで呼び出し、公開予定日が常に `null` になる

1.3 WHEN `detectUpdatedPropertyListings()` が実行される THEN システムは `calculateSidebarStatus(row)` を `gyomuListData` なしで呼び出し、`sidebar_status` の変更が正しく検出されない

### Expected Behavior (Correct)

2.1 WHEN 物件の `atbb_status` が「専任・公開中」AND `suumo_url` が空 AND `suumo_registered` が「S不要」でない AND `work_tasks.publish_scheduled_date` が昨日以前 THEN システムは物件の `sidebar_status` を「レインズ登録＋SUUMO登録」に設定し、サイドバーカテゴリーに表示する

2.2 WHEN `syncUpdatedPropertyListings()` が実行される THEN システムは `work_tasks` テーブルから公開予定日データを取得し、`calculateSidebarStatus(row, gyomuListData)` に渡して正しく `sidebar_status` を計算する

2.3 WHEN `detectUpdatedPropertyListings()` が実行される THEN システムは `work_tasks` テーブルから公開予定日データを取得し、`calculateSidebarStatus(row, gyomuListData)` に渡して `sidebar_status` の変更を正しく検出する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件の `suumo_url` が入力されている AND `atbb_status` が「専任・公開中」 THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」カテゴリーに表示しない

3.2 WHEN 物件の `atbb_status` が「一般・公開中」AND `suumo_url` が空 AND `work_tasks.publish_scheduled_date` が昨日以前 THEN システムは引き続き物件を「SUUMO URL　要登録」カテゴリーに表示する

3.3 WHEN 物件の `suumo_registered` が「S不要」 THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示しない

3.4 WHEN 物件の `work_tasks.publish_scheduled_date` が今日以降 THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」カテゴリーに表示しない

3.5 WHEN `calculateSidebarStatus()` が他のステータス（未報告、未完了、専任公開中など）を計算する THEN システムは引き続き正しいステータスを返す
