# Bugfix Requirements Document

## Introduction

スプレッドシートの「営担」列（`visit_assignee`）に値が入力されているにもかかわらず、GASの `syncUpdatesToSupabase_` 関数による定期同期（10分トリガー）でDBに反映されないバグ。

売主AA12497をはじめ複数の売主で同症状が確認されている。

**根本原因の仮説**: `syncUpdatesToSupabase_` 内の比較ロジックで、スプレッドシートから読み込んだ `row['営担']` の値が `undefined` になるケースがある。`rowToObject` 関数はヘッダーが空文字列の列をスキップするため、「営担」列のヘッダーに余分な空白・改行が含まれている場合、`row['営担']` が `undefined` → `null` として扱われ、DBの既存値と比較した際に「変更なし」と誤判定される可能性がある。

また、`rawVisitAssignee === undefined` の条件は `null` を捕捉しないため、スプレッドシートのセルが `null` として読み込まれた場合も同様に誤判定が発生する。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートの「営担」列に担当者名（例: "Y"）が入力されており、かつDBの `visit_assignee` が `null` の売主が存在する THEN `syncUpdatesToSupabase_` はその売主の `visit_assignee` をDBに更新しない

1.2 WHEN `rowToObject` が「営担」列のヘッダーを正しく認識できない（ヘッダー名に余分な空白・改行が含まれる等）THEN `row['営担']` が `undefined` となり、`sheetVisitAssignee` が `null` に変換される

1.3 WHEN `sheetVisitAssignee` が `null` であり、かつ `dbSeller.visit_assignee` も `null` の場合 THEN 比較結果が「等しい」となり、`updateData.visit_assignee` がセットされず更新がスキップされる

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートの「営担」列に担当者名が入力されている THEN `syncUpdatesToSupabase_` はその値をDBの `visit_assignee` に正しく反映する

2.2 WHEN `rowToObject` がヘッダーを正しく認識できない場合でも THEN ヘッダーの正規化（trim処理）により「営担」列の値を確実に取得できる

2.3 WHEN スプレッドシートの `visit_assignee` 値とDBの値が異なる THEN `needsUpdate = true` がセットされ、Supabaseへの PATCH リクエストが実行される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN スプレッドシートの「営担」列が空欄または「外す」の場合 THEN システムは引き続き `visit_assignee` を `null` としてDBに保存する

3.2 WHEN スプレッドシートとDBの `visit_assignee` が同じ値の場合 THEN システムは引き続き不要な更新リクエストを送信しない（差分なしはスキップ）

3.3 WHEN `status`、`next_call_date`、`comments` など他のフィールドの同期処理 THEN システムは引き続き正常に動作する

3.4 WHEN 売主番号が `AA\d+` 形式でない行 THEN システムは引き続きその行をスキップする

3.5 WHEN `onEditTrigger` による即時同期 THEN システムは引き続き正常に動作する
