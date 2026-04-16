# Bugfix Requirements Document

## Introduction

物件リストの「未報告林」サイドバーカウント（3件）とリスト表示（4件）が一致しないバグ。
`PropertySidebarStatus.tsx` のカウント計算と `PropertyListingsPage.tsx` のフィルタリングで、
異なるロジックが使われているため件数が食い違う。

具体的には、`PropertySidebarStatus.tsx` の `statusCounts` 計算において、
`calculatePropertyStatus` で `unreported` と判定された物件は `return` で早期終了するが、
`sidebar_status` が `null` または空の物件（DBに未保存）と、
`sidebar_status` に古い形式（`'未報告 林田'` スペースあり・フルネーム）が残っている物件の
カウント処理に不整合が生じている。

また、`PropertySidebarStatus.tsx` では `workTaskMap` が渡されない場合（初期ロード時など）に
`today_publish` 判定がスキップされ、その物件が `unreported` として誤分類される可能性がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `PropertySidebarStatus.tsx` が `statusCounts` を計算する際に `workTaskMap` が空（業務依頼データ未取得）の状態で `calculatePropertyStatus` を呼び出す THEN `today_publish` 判定がスキップされ、本来「本日公開予定」になるべき物件が `unreported` として誤カウントされる

1.2 WHEN DBの `sidebar_status` カラムに `'未報告 林田'`（スペースあり・フルネーム）で保存されている物件が存在する THEN `PropertySidebarStatus.tsx` の `normalizedStatus.startsWith('未報告')` チェックで除外されるが、`calculatePropertyStatus` でも `unreported` と判定されてカウントされるため、カウントロジックが複雑になり不整合が生じる

1.3 WHEN `PropertySidebarStatus.tsx` のサイドバーカウントが3件を表示している THEN `PropertyListingsPage.tsx` のフィルタリングでは4件が表示され、ユーザーに混乱を与える

1.4 WHEN `PropertySidebarStatus.tsx` の `statusCounts` 計算において `calculatePropertyStatus` の `unreported` 判定後に `return` する THEN `sidebar_status` が `null` の物件と `sidebar_status` が `'未報告林'` の物件が別々のコードパスで処理され、カウント結果が `PropertyListingsPage.tsx` のフィルタリング結果と一致しない

### Expected Behavior (Correct)

2.1 WHEN `PropertySidebarStatus.tsx` が `statusCounts` を計算する際に `workTaskMap` が空の状態で `calculatePropertyStatus` を呼び出す THEN `workTaskMap` が揃ってから再計算されるか、または `workTaskMap` なしでも `PropertyListingsPage.tsx` のフィルタリングと同一の判定ロジックを使用する

2.2 WHEN DBの `sidebar_status` に古い形式（`'未報告 林田'` スペースあり・フルネーム）が残っている物件が存在する THEN `PropertySidebarStatus.tsx` のカウントと `PropertyListingsPage.tsx` のフィルタリングの両方で同一の正規化ロジックを使用し、同じ件数を返す

2.3 WHEN サイドバーの「未報告林」をクリックする THEN リスト表示の件数がサイドバーのカウントと一致する

2.4 WHEN `PropertySidebarStatus.tsx` の `statusCounts` 計算において `unreported` 物件をカウントする THEN `PropertyListingsPage.tsx` の `filteredListings` 計算と完全に同一の条件（同一の `calculatePropertyStatus` 呼び出し、同一の正規化処理）でカウントする

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「未報告林」以外のサイドバーカテゴリー（「未完了」「要値下げ」「本日公開予定」など）をクリックする THEN システムは引き続き正しい件数を表示し続ける

3.2 WHEN `sidebar_status` が正しい形式（`'未報告林'` スペースなし・イニシャル）で保存されている物件が存在する THEN システムは引き続きそれらを正しくカウントし続ける

3.3 WHEN 担当者別専任公開中（`'Y専任公開中'`、`'林・専任公開中'` など）のカテゴリーをクリックする THEN システムは引き続き正しい件数を表示し続ける

3.4 WHEN `workTaskMap` が正常に取得されている状態でサイドバーカウントを計算する THEN システムは引き続き `today_publish` 判定を正しく行い続ける

3.5 WHEN 「未報告」カテゴリーの物件行をクリックする THEN システムは引き続き報告ページへ直接遷移し続ける
