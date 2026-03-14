# Bugfix Requirements Document

## Introduction

物件リスト（`PropertyListingsPage`）において、最新の物件AA13295が一覧の一番上に表示されるべきだが、現在は表示されていない。

フロントエンドは `contract_date`（契約日）を `orderBy` パラメータとしてAPIに渡しており、バックエンドの `PropertyListingService.getAll()` もそのパラメータをそのままSupabaseに渡している。本来は `distribution_date`（配信日・公開日）の降順でソートされるべきである。`distribution_date` が空欄の物件は末尾に表示し、フォールバックとして `property_number` の降順で並べる。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件リストページを開いたとき THEN システムは `contract_date`（契約日）の降順でソートされた物件一覧を表示する

1.2 WHEN AA13295のように `contract_date`（契約日）が空欄の物件が存在するとき THEN システムはその物件を一覧の末尾付近に表示する

1.3 WHEN 最新の物件番号（AA13295）を持つ物件の `contract_date` が空欄のとき THEN システムはその物件を一覧の一番上に表示しない

### Expected Behavior (Correct)

2.1 WHEN 物件リストページを開いたとき THEN システムは `distribution_date`（配信日・公開日）の降順でソートされた物件一覧を表示する

2.2 WHEN `distribution_date`（配信日・公開日）が入力されている物件が存在するとき THEN システムはその物件を配信日の新しい順に表示する

2.3 WHEN AA13295のように `distribution_date`（配信日・公開日）が空欄の物件が存在するとき THEN システムはその物件を `distribution_date` が入力されている物件より後（末尾側）に表示し、フォールバックとして `property_number` の降順で並べる

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件リストページでフィルター（担当者・ステータス・買主）を適用するとき THEN システムは引き続きフィルター機能を正常に動作させる

3.2 WHEN 物件リストページで検索クエリを入力するとき THEN システムは引き続き検索機能を正常に動作させる

3.3 WHEN 物件リストページでページネーションを操作するとき THEN システムは引き続きページネーション機能を正常に動作させる

3.4 WHEN 物件詳細モーダルを開くとき THEN システムは引き続き物件詳細を正常に表示する
