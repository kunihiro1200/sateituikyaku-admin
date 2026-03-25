# Bugfix Requirements Document

## Introduction

GASによるスプレッドシート→DB同期において、スプレッドシートに存在しない買主データがDBから完全削除（ハードデリート）されるべきところ、ソフトデリート（`deleted_at`を設定）されている。

買主番号7205はスプレッドシートに存在しないにもかかわらず、DBに残り続けている。
`EnhancedAutoSyncService.ts`の`executeBuyerSoftDelete()`メソッドが`deleted_at`を設定するソフトデリートを実行しており、ハードデリート（`DELETE FROM buyers WHERE buyer_number = ?`）が行われていない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートに存在しない買主番号がDBに存在する THEN システムは`deleted_at`カラムに削除日時を設定する（ソフトデリート）

1.2 WHEN GASが10分ごとの同期を実行する THEN システムはスプレッドシートに存在しない買主レコードをDBに残し続ける（`deleted_at`が設定されたまま物理的には削除されない）

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートに存在しない買主番号がDBに存在する THEN システムはそのレコードをDBから完全削除（ハードデリート）しなければならない

2.2 WHEN GASが10分ごとの同期を実行する THEN システムはスプレッドシートに存在しない買主レコードをDBから物理的に削除しなければならない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN スプレッドシートに存在する買主番号がDBに存在する THEN システムはそのレコードを削除せずに保持し続けなければならない

3.2 WHEN スプレッドシートのデータが0件の場合（安全ガード1） THEN システムは削除処理をスキップしなければならない

3.3 WHEN スプレッドシートの買主数がDBのアクティブ買主数の50%未満の場合（安全ガード2） THEN システムは削除処理をスキップしなければならない

3.4 WHEN 削除対象がアクティブ買主の10%以上の場合（安全ガード3） THEN システムは削除処理をスキップしなければならない

3.5 WHEN スプレッドシートに存在する買主のデータが更新されている THEN システムはそのレコードを正常に更新しなければならない
