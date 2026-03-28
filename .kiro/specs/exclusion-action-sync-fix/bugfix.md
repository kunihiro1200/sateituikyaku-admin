# Bugfix Requirements Document

## Introduction

「除外日にすること」フィールド（DBカラム: `exclusion_action`、スプレッドシートカラム: `除外日にすること`）が、データベースとスプレッドシート間で双方向に同期されていない。

このフィールドは次電日の自動除外設定機能であり、「次電日に不通であれば除外」または「次電日になにもせずに除外」のいずれかを選択すると、次電日に除外日が自動設定される重要な機能である。

現在、以下の2つの同期経路が両方とも機能していない：
- **DB → スプシ（即時同期）**: `column-mapping.json` の `databaseToSpreadsheet` セクションに `exclusion_action` のマッピングが存在しない
- **スプシ → DB（GAS定期同期）**: `gas_complete_code.js` の `syncSellerList` 関数に `除外日にすること` の同期処理が存在しない

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ブラウザで売主の「除外日にすること」フィールドを選択・保存した THEN システムはDBには保存するがスプレッドシートの「除外日にすること」列に反映しない

1.2 WHEN スプレッドシートの「除外日にすること」列を変更した THEN GASの定期同期（`syncSellerList`）はその変更をDBに反映しない

### Expected Behavior (Correct)

2.1 WHEN ブラウザで売主の「除外日にすること」フィールドを選択・保存した THEN システムはDBへの保存と同時にスプレッドシートの「除外日にすること」列にも即時反映する（SHALL）

2.2 WHEN スプレッドシートの「除外日にすること」列を変更した THEN GASの定期同期（`syncSellerList`）はその変更をDBの `exclusion_action` カラムに反映する（SHALL）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「除外日にすること」以外のフィールド（例: `status`、`next_call_date`、`comments` など）をブラウザで保存した THEN システムはそれらのフィールドを引き続き正常にスプレッドシートに即時同期する（SHALL CONTINUE TO）

3.2 WHEN GASの `syncSellerList` が実行された THEN システムは「除外日にすること」以外の既存フィールドを引き続き正常にDBに同期する（SHALL CONTINUE TO）

3.3 WHEN `exclusion_action` が null または空文字の売主データを同期した THEN システムはエラーを発生させずに正常に処理する（SHALL CONTINUE TO）
