# Bugfix Requirements Document

## Introduction

物件リストのサイドバーカテゴリーにおいて、担当者が「林」の専任・公開中物件が「林専任公開中」と表示されるべきところ、「専任・公開中」と表示されるバグを修正する。

このバグは、`PropertySidebarStatus.tsx` のカテゴリー集計ロジックにおいて、`sidebar_status` が古い形式（`'専任・公開中'`）のままになっている物件を担当者別に分解する処理が、`workTaskMap` が存在しない場合にのみ実行されるという条件分岐の問題に起因する可能性がある。また、`statusList` の `label` に `key` をそのまま使用しているため、`'専任・公開中'` がそのまま表示される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件の `sidebar_status` が `'専任・公開中'`（古い形式）で `sales_assignee` が `'林'` の場合 THEN サイドバーカテゴリーに「専任・公開中」と表示される

1.2 WHEN `workTaskMap` が存在しない状態で `sidebar_status === '専任・公開中'` の物件が存在する場合 THEN `ASSIGNEE_TO_SENIN_STATUS` による担当者別分解が実行されず「専任・公開中」のままカウントされる

### Expected Behavior (Correct)

2.1 WHEN 物件の `sidebar_status` が `'専任・公開中'`（古い形式）で `sales_assignee` が `'林'` の場合 THEN サイドバーカテゴリーに「林・専任公開中」と表示される

2.2 WHEN `workTaskMap` の有無に関わらず `sidebar_status === '専任・公開中'` の物件が存在する場合 THEN `ASSIGNEE_TO_SENIN_STATUS` による担当者別分解が常に実行され、担当者名付きのカテゴリーとしてカウントされる

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件の `sidebar_status` がすでに `'林・専任公開中'` などの担当者別形式になっている場合 THEN サイドバーカテゴリーに正しく「林・専任公開中」と表示され続ける

3.2 WHEN 物件の `sidebar_status` が `'専任・公開中'` で `sales_assignee` が `'山本'`、`'生野'`、`'久'`、`'裏'`、`'国広'`、`'木村'`、`'角井'` の場合 THEN それぞれ「Y専任公開中」「生・専任公開中」「久・専任公開中」「U専任公開中」「K専任公開中」「R専任公開中」「I専任公開中」と表示され続ける

3.3 WHEN 担当者別専任公開中カテゴリーをクリックしてフィルタリングする場合 THEN 対応する担当者の物件のみが表示され続ける

3.4 WHEN `sidebar_status` が `'専任・公開中'` で `sales_assignee` が未設定またはマッピングに存在しない場合 THEN 「専任・公開中」としてカウントされ続ける
