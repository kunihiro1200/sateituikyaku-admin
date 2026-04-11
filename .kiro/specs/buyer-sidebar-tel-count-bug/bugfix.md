# Bugfix Requirements Document

## Introduction

買主リストのサイドバーに表示される「当日TEL」カウントと、そのカテゴリをクリックした際に表示される一覧の件数が一致しないバグ。

サイドバーには「5件」と表示されているが、クリックすると一覧に2件しか表示されない。正しい件数は3件（買主番号: 7326、7327、7342）。

根本原因は、サイドバーカウントを計算するGAS（`gas_buyer_complete_code.js`の`updateBuyerSidebarCounts()`）と、一覧表示のフィルタリングに使用するバックエンド（`BuyerStatusCalculator.ts`の`calculateBuyerStatus()`）で、「当日TEL」の判定条件が異なることにある。

**GASの条件（サイドバーカウント）**:
- `next_call_date === 今日`（今日のみ）
- `follow_up_assignee` の条件なし（担当あり・なし両方カウント）
- `assignee = initial_assignee || follow_up_assignee`（initial_assigneeを優先）

**バックエンドの条件（一覧フィルタリング）**:
- `next_call_date <= 今日`（今日以前）
- `follow_up_assignee` が空の場合のみ（担当なしのみ）
- `follow_up_assignee` を使用

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN GASが`updateBuyerSidebarCounts()`を実行する THEN `next_call_date === 今日`（今日のみ）かつ`follow_up_assignee`の条件なしで「当日TEL」をカウントする

1.2 WHEN バックエンドが`calculateBuyerStatus()`で一覧フィルタリングを行う THEN `next_call_date <= 今日`（今日以前）かつ`follow_up_assignee`が空の場合のみ「当日TEL」と判定する

1.3 WHEN GASが担当者イニシャルを取得する THEN `initial_assignee || follow_up_assignee`の順（initial_assigneeを優先）でassigneeを決定する

1.4 WHEN バックエンドが担当者イニシャルを取得する THEN `follow_up_assignee || initial_assignee`の順（follow_up_assigneeを優先）でassigneeを決定する

1.5 WHEN サイドバーの「当日TEL」をクリックする THEN 一覧に表示される件数がサイドバーのカウントと異なる

### Expected Behavior (Correct)

2.1 WHEN GASが`updateBuyerSidebarCounts()`を実行する THEN `next_call_date <= 今日`（今日以前）かつ`follow_up_assignee`が空の場合のみ「当日TEL」をカウントするべきである

2.2 WHEN GASが`updateBuyerSidebarCounts()`を実行する THEN `next_call_date <= 今日`（今日以前）かつ`follow_up_assignee`が空でない場合は「当日TEL(担当)」としてカウントするべきである

2.3 WHEN GASが担当者イニシャルを取得する THEN `follow_up_assignee || initial_assignee`の順（follow_up_assigneeを優先）でassigneeを決定するべきである

2.4 WHEN サイドバーの「当日TEL」をクリックする THEN 一覧に表示される件数がサイドバーのカウントと一致するべきである（3件: 7326、7327、7342）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `follow_up_assignee`が空でない買主の`next_call_date`が今日以前である THEN システムは引き続き「当日TEL(担当)」としてカウントするべきである

3.2 WHEN `next_call_date`が未来の日付である THEN システムは引き続き「当日TEL」にカウントしないべきである

3.3 WHEN `next_call_date`が空である THEN システムは引き続き「当日TEL」にカウントしないべきである

3.4 WHEN 内覧日前日の買主が存在する THEN システムは引き続き「内覧日前日」カウントを正しく計算するべきである

3.5 WHEN 担当別カウント（`assigned`）を計算する THEN システムは引き続き`follow_up_assignee || initial_assignee`の順で担当者を判定するべきである
