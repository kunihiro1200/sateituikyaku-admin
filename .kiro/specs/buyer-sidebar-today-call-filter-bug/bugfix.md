# Bugfix Requirements Document

## Introduction

買主リストのサイドバーに表示される「当日TEL 1」のカウントと、クリック時に表示される件数（8件）が一致しないバグです。
また、表示される8件の中に次電日が今日以前のものが含まれていないという問題もあります。

根本原因は `BuyersPage.tsx` のフィルタリングロジックにあります。「当日TEL」をクリックした際、`calculated_status === '当日TEL'`（担当なし）だけでなく、`calculated_status.startsWith('当日TEL(')` に一致する `当日TEL(Y)`, `当日TEL(I)` 等の担当あり当日TELも一緒に表示してしまっています。

サイドバーのカウントは `calculated_status === '当日TEL'` の件数（1件）を正しく集計していますが、フィルタリング時に担当あり当日TEL（7件）も混入するため、表示件数が8件になります。さらに担当あり当日TELの買主は `follow_up_assignee` が設定されているため、次電日が今日以前であっても `当日TEL` ではなく `当日TEL(担当者)` として分類されており、「次電日が今日以前のものが含まれない」という現象が発生しています。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーの「当日TEL」カテゴリをクリックする THEN the system `calculated_status === '当日TEL'`（担当なし）だけでなく `当日TEL(Y)`, `当日TEL(I)` 等の担当あり当日TELも含めて表示し、サイドバーのカウント（1件）と実際の表示件数（8件）が一致しない

1.2 WHEN サイドバーの「当日TEL」カテゴリをクリックして8件が表示される THEN the system 担当あり当日TEL（`当日TEL(Y)` 等）の買主を表示するため、次電日が今日以前の「当日TEL」（担当なし）の買主が実質的に埋もれ、フィルタリング条件が正しく機能していないように見える

### Expected Behavior (Correct)

2.1 WHEN サイドバーの「当日TEL」カテゴリをクリックする THEN the system SHALL `calculated_status === '当日TEL'` に完全一致する買主のみを表示し、サイドバーのカウントと表示件数が一致する

2.2 WHEN サイドバーの「当日TEL(Y)」等の担当あり当日TELカテゴリをクリックする THEN the system SHALL `calculated_status === '当日TEL(Y)'` に完全一致する買主のみを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN サイドバーの「担当(Y)」等の担当カテゴリをクリックする THEN the system SHALL CONTINUE TO `calculated_status === '担当(Y)'` に完全一致する買主のみを表示する

3.2 WHEN サイドバーの「All」をクリックする THEN the system SHALL CONTINUE TO 全買主を表示する

3.3 WHEN 検索クエリを入力する THEN the system SHALL CONTINUE TO 検索フィルタが正しく機能する

3.4 WHEN サイドバーの各カテゴリのカウント集計ロジック（`buildCategoriesFromBuyers`） THEN the system SHALL CONTINUE TO 変更なく動作する

3.5 WHEN `BuyerStatusCalculator` の `calculateBuyerStatus` ロジック THEN the system SHALL CONTINUE TO 変更なく動作する
