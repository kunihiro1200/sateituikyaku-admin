# バグ修正要件ドキュメント

## Introduction

売主AA907の次電日（`next_call_date`）がスプレッドシートで更新されているにもかかわらず、DBに反映されず、サイドバーのカテゴリー表示が変わらないバグ。

スプレッドシート → DB の同期はGASの `syncSellerList`（10分トリガー）が担っているが、1時間以上経過してもDBが更新されていない。調査すべき根本原因は複数あり、GASトリガーの停止・`column-mapping.json`のマッピング不備・`EnhancedAutoSyncService`の更新検出ロジックの欠陥・売主番号の検索列誤り（A列 vs B列）・日付フォーマット変換エラーのいずれかである可能性がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートのAA907の「次電日」列が更新されてから10分以上経過した場合 THEN DBの `next_call_date` カラムが更新されず古い値のままになる

1.2 WHEN DBの `next_call_date` が古い値のままの場合 THEN サイドバーの「当日TEL分」「当日TEL（担当）」等のカテゴリー表示がスプレッドシートの最新状態と一致しない

1.3 WHEN GASの `syncSellerList` がAA907の行を処理する場合 THEN 次電日の変更が検出されないか、または変換エラーにより `null` としてDBに書き込まれる

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートのAA907の「次電日」列が更新されてから最大10分以内 THEN DBの `next_call_date` カラムが正しい日付値（YYYY-MM-DD形式）に更新される

2.2 WHEN DBの `next_call_date` が正しく更新された場合 THEN サイドバーのカテゴリー表示（「当日TEL分」「当日TEL（担当）」等）がスプレッドシートの最新状態と一致する

2.3 WHEN スプレッドシートの「次電日」がYYYY/MM/DD形式またはExcelシリアル値で入力されている場合 THEN `formatVisitDate` が正しくYYYY-MM-DD形式に変換してDBに保存する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN AA907以外の売主の次電日がスプレッドシートで更新された場合 THEN システムは引き続き正常にDBへ同期する

3.2 WHEN 次電日以外のフィールド（`status`、`visit_assignee`、`comments`等）がスプレッドシートで更新された場合 THEN システムは引き続き正常にDBへ同期する

3.3 WHEN 次電日が空欄のままの売主がある場合 THEN システムは引き続き `next_call_date` を `null` として保持する

3.4 WHEN サイドバーの「当日TEL分」カテゴリーの判定ロジック（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし）が実行される場合 THEN システムは引き続き正しく判定する
