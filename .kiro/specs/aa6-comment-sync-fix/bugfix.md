# バグ修正要件ドキュメント

## はじめに

売主リストのコメント（`comments`フィールド）を管理画面で更新しても、DB→スプレッドシートへの即時同期が行われないバグ。

コードの調査により、`SellerService.updateSeller()` は `comments` フィールドをDBに保存し、`SyncQueue.enqueue()` も呼び出している。しかし、`SpreadsheetSyncService` が使用する `ColumnMapper.mapToSheet()` の実装において、`comments` フィールドがスプレッドシートへの書き込み対象に含まれていない可能性が高い。

これにより、コメントを更新してもスプレッドシートの「コメント」列が更新されず、スプレッドシートを参照するスタッフが最新情報を確認できない状態になっている。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 管理画面でAA6のコメントを更新する THEN システムはDBへの保存は成功するが、スプレッドシートの「コメント」列は更新されない

1.2 WHEN `SyncQueue` がコメント更新後の同期ジョブを処理する THEN システムは `ColumnMapper.mapToSheet()` が `comments` フィールドをスプレッドシート行に含めないため、スプレッドシートへの書き込みが行われない

### 期待される動作（正しい動作）

2.1 WHEN 管理画面でコメントを更新する THEN システムは数秒以内にスプレッドシートの「コメント」列を更新された値に反映させる SHALL

2.2 WHEN `ColumnMapper.mapToSheet()` が売主データを変換する THEN システムは `comments` フィールドを `コメント` 列にマッピングしてスプレッドシート行に含める SHALL

### 変更されない動作（リグレッション防止）

3.1 WHEN コメント以外のフィールド（`status`、`next_call_date`、`visit_assignee` など）を更新する THEN システムは引き続き既存の同期処理を正常に実行する SHALL CONTINUE TO

3.2 WHEN スプレッドシート→DB方向の同期（GASの `syncSellerList`）が実行される THEN システムは引き続き `comments` フィールドをDBに正しく反映する SHALL CONTINUE TO

3.3 WHEN `SellerService.updateSeller()` でコメントを更新する THEN システムは引き続き `SyncQueue.enqueue()` を呼び出してキューに追加する SHALL CONTINUE TO
