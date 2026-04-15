# Bugfix Requirements Document

## Introduction

買主リストのサイドバーに表示される「問合せメール未対応」カテゴリのカウントが、買主詳細画面で対応処理（`inquiry_email_phone` フィールドの更新）を行った後もリアルタイムに更新されないバグ。

対応済みにした後、一覧に戻るとサイドバーに「問合せメール未対応 1」が残ったまま表示され、そのカテゴリをクリックすると「買主データが見つかりませんでした」と表示される。また、コンソールに 404 エラーが発生している。

根本原因は2つある：
1. `BuyerService.shouldUpdateBuyerSidebarCounts()` の監視フィールドリストに `inquiry_email_phone` が含まれていないため、対応処理後にサイドバーカウント更新がトリガーされない
2. `SidebarCountsUpdateService.determineBuyerCategories()` に `inquiryEmailUnanswered` カテゴリの判定ロジックが実装されていないため、差分更新でカウントが正しく減算されない

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面で `inquiry_email_phone` フィールドを「未」から「済」等に更新して保存する THEN サイドバーカウント更新がトリガーされず、「問合せメール未対応」のカウントが変わらない

1.2 WHEN サイドバーの「問合せメール未対応」カテゴリをクリックする THEN 対応済みの買主が存在しないにもかかわらず古いカウント（例: 1）が表示されたまま「買主データが見つかりませんでした」と表示される

1.3 WHEN 「問合せメール未対応」カテゴリをクリックする THEN コンソールに `Failed to fetch related buyers count: AxiosError: Request failed with status code 404` エラーが発生する

### Expected Behavior (Correct)

2.1 WHEN 買主詳細画面で `inquiry_email_phone` フィールドを更新して保存する THEN `shouldUpdateBuyerSidebarCounts()` が `inquiry_email_phone` の変更を検知してサイドバーカウント更新をトリガーする

2.2 WHEN `inquiry_email_phone` の更新によりサイドバーカウント更新がトリガーされる THEN `SidebarCountsUpdateService.determineBuyerCategories()` が `inquiryEmailUnanswered` カテゴリを正しく判定し、差分更新でカウントを即時減算する

2.3 WHEN 「問合せメール未対応」の買主が0件になる THEN サイドバーから「問合せメール未対応」カテゴリが消える（カウント0のカテゴリは非表示）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `next_call_date`、`follow_up_assignee`、`viewing_date`、`notification_sender` フィールドを更新する THEN サイドバーカウント更新が従来通りトリガーされる

3.2 WHEN `inquiry_email_phone` が「未」のままの買主が存在する THEN その買主は引き続き「問合せメール未対応」カテゴリにカウントされる

3.3 WHEN 「内覧日前日」「当日TEL」「担当」等の他のサイドバーカテゴリを操作する THEN それらのカウントは影響を受けない

3.4 WHEN 買主リストページを初回ロードする THEN サイドバーカウントは従来通り正常に表示される
