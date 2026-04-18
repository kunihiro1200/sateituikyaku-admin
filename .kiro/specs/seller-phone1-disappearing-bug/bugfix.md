# Bugfix Requirements Document

## Introduction

売主リストにおいて、通話モードページ（CallModePage）で「1番電話」フィールドに担当者イニシャルを入力して保存しても、しばらく経つと値が消えてしまうバグ。

コード調査の結果、根本原因は以下の2点であることが判明した：

1. **カラム名不一致（主因）**: `EnhancedAutoSyncService.ts` がスプレッドシートの「1番電話」列を参照する際に、誤ったキー名 `row['一番TEL']` を使用している。実際のスプレッドシートカラム名は `'1番電話'` であるため、同期処理が常に `undefined` を取得し、DBの `first_call_person` を `null` で上書きしてしまう。

2. **新規登録時の誤マッピング（副因）**: `SellerService.supabase.ts` の `createSeller` メソッドがスプレッドシートに新規行を追加する際、`'1番電話'` 列に `data.assignedTo`（営業担当）の値を書き込んでいる。本来は `data.firstCallPerson`（1番電話担当者）を書き込むべきである。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが通話モードページで「1番電話」フィールドに値を入力して保存した後、`EnhancedAutoSyncService` のスプレッドシート→DB同期処理が実行される THEN システムは `row['一番TEL']`（常に `undefined`）を参照するため `first_call_person` を `null` で上書きし、入力した値が消える

1.2 WHEN `EnhancedAutoSyncService.detectUpdatedSellers` が差分検出を行う THEN システムは `sheetRow['一番TEL']`（常に `''`）とDBの `first_call_person` を比較するため、スプレッドシート側で「1番電話」が変更されても差分として検出されない

1.3 WHEN `EnhancedAutoSyncService.syncSingleSeller`（新規作成）が実行される THEN システムは `row['一番TEL']`（常に `undefined`）を参照するため、スプレッドシートの「1番電話」列の値がDBに保存されない

1.4 WHEN `EnhancedAutoSyncService.updateSingleSeller`（既存更新）が実行される THEN システムは `row['一番TEL']`（常に `undefined`）を参照するため、スプレッドシートの「1番電話」列の値がDBに反映されない

1.5 WHEN `SellerService.createSeller` が新規売主をスプレッドシートに追加する THEN システムは `'1番電話'` 列に `data.assignedTo`（営業担当のイニシャル）を書き込むため、1番電話担当者ではなく営業担当者の値が誤って記録される

### Expected Behavior (Correct)

2.1 WHEN ユーザーが通話モードページで「1番電話」フィールドに値を入力して保存した後、`EnhancedAutoSyncService` の同期処理が実行される THEN システムは `row['1番電話']`（正しいカラム名）を参照し、DBの `first_call_person` を保持する（または正しい値で更新する）

2.2 WHEN `EnhancedAutoSyncService.detectUpdatedSellers` が差分検出を行う THEN システムは `sheetRow['1番電話']` とDBの `first_call_person` を比較し、変更があった場合のみ差分として検出する

2.3 WHEN `EnhancedAutoSyncService.syncSingleSeller`（新規作成）が実行される THEN システムは `row['1番電話']` を参照し、スプレッドシートの「1番電話」列の値をDBの `first_call_person` に正しく保存する

2.4 WHEN `EnhancedAutoSyncService.updateSingleSeller`（既存更新）が実行される THEN システムは `row['1番電話']` を参照し、スプレッドシートの「1番電話」列の値をDBの `first_call_person` に正しく反映する

2.5 WHEN `SellerService.createSeller` が新規売主をスプレッドシートに追加する THEN システムは `'1番電話'` 列に `data.firstCallPerson`（1番電話担当者）の値を書き込む

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが通話モードページで「1番電話」フィールドに値を入力して保存する THEN システムは `PUT /api/sellers/:id` を通じて `first_call_person` をDBに保存し続ける（この保存フローは変更しない）

3.2 WHEN スプレッドシートの「1番電話」列が空欄の場合 THEN システムは `first_call_person` を `null` として扱い続ける

3.3 WHEN `EnhancedAutoSyncService` が他のフィールド（`status`、`next_call_date`、`comments`、`contact_method`、`preferred_contact_time` 等）を同期する THEN システムはそれらのフィールドを従来通り正しく同期し続ける

3.4 WHEN `SellerService.createSeller` が新規売主を登録する THEN システムは `first_call_person` 以外のスプレッドシート書き込みフィールド（名前、住所、電話番号、メール、物件所在地、反響日付等）を従来通り正しく書き込み続ける

3.5 WHEN `column-mapping.json` の `databaseToSpreadsheet` セクションで `first_call_person` が `"一番TEL"` にマッピングされている THEN このマッピングはDB→スプレッドシート方向の同期（`SpreadsheetSyncService`）で使用されており、変更しない（スプレッドシート側のカラム名が「一番TEL」である別の列が存在する可能性があるため）

---

## Bug Condition (バグ条件の定式化)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SyncEvent
  OUTPUT: boolean

  // バグ条件: EnhancedAutoSyncServiceの同期処理が実行され、
  // かつスプレッドシート行に "1番電話" キーで値が存在する場合
  RETURN X.source = "EnhancedAutoSyncService"
    AND X.sheetRow["1番電話"] IS NOT NULL
    AND X.sheetRow["1番電話"] != ""
END FUNCTION
```

```pascal
// Property: Fix Checking - 1番電話同期の正確性
FOR ALL X WHERE isBugCondition(X) DO
  result ← sync'(X)
  ASSERT result.first_call_person = X.sheetRow["1番電話"]
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT sync(X) = sync'(X)
END FOR
```
