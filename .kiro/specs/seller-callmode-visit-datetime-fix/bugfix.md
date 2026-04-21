# Bugfix Requirements Document

## Introduction

売主管理システムの通話モードページ（CallModePage）において、訪問予約の日時を入力・保存すると、時間部分だけが `00:00` にリセットされるバグが再発している。

このバグはコミット `2f47187b` で一度修正されたが、その後の変更（コミット `5d93fe8b`：`combineVisitDateAndTime` の導入）によって再発した。

**影響範囲**: 売主番号 AA14001 を含む、訪問予約を持つ全売主  
**対象ページ**: 通話モードページ（`/sellers/:id/call`）  
**対象機能**: 訪問予約セクションの日時入力フォーム

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが通話モードページの訪問予約フォームで日時（例: `2026-05-10T14:30`）を入力して保存する THEN システムは時間部分を `00:00` にリセットして表示する（例: `2026-05-10T00:00`）

1.2 WHEN スプレッドシートの「訪問時間」列が空欄の状態でスプレッドシート同期が実行される THEN システムは `combineVisitDateAndTime` が `YYYY-MM-DD` 形式（時刻なし）の文字列を `visit_date` に保存し、フロントエンドの `new Date()` がUTC→JST変換で時間を9時間ずらす

1.3 WHEN フロントエンドが `sellerData.visitDate`（例: `"2026-05-10"` または `"2026-05-10T00:00:00.000Z"`）を `new Date()` でパースして `datetime-local` 入力フィールドに変換する THEN システムはタイムゾーン変換により時間部分が `00:00` または誤った値になる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが通話モードページの訪問予約フォームで日時（例: `2026-05-10T14:30`）を入力して保存する THEN システムは入力した時間（`14:30`）をそのまま保持して表示する

2.2 WHEN スプレッドシートの「訪問時間」列が空欄の状態でスプレッドシート同期が実行される THEN システムは既存の `visit_date` の時間部分を上書きしない（または時刻なしの場合は `00:00:00` のまま保持する）

2.3 WHEN フロントエンドが `sellerData.visitDate` を `datetime-local` 入力フィールドに変換する THEN システムはタイムゾーン変換を行わず、DBに保存されたローカル時刻をそのまま表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが訪問予約フォームで訪問日のみ（時間なし）を入力して保存する THEN システムは SHALL CONTINUE TO 日付部分を正しく保存・表示する

3.2 WHEN スプレッドシートの「訪問時間」列に値（例: `14:30`）が入力されている状態でスプレッドシート同期が実行される THEN システムは SHALL CONTINUE TO 日付と時間を正しく組み合わせて `visit_date` に保存する

3.3 WHEN ユーザーが訪問予約フォームで訪問日時を削除（空欄）にして保存する THEN システムは SHALL CONTINUE TO `visit_date` を `null` にクリアする

3.4 WHEN ユーザーが訪問予約フォームで営担（visitAssignee）を設定して保存する THEN システムは SHALL CONTINUE TO 営担を正しく保存する

3.5 WHEN 訪問予約が保存された後にページをリロードする THEN システムは SHALL CONTINUE TO 保存した日時を正しく表示する

---

## Bug Condition (バグ条件の定式化)

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type VisitDateInput
  OUTPUT: boolean

  // 以下のいずれかの条件でバグが発生する
  RETURN (
    // 条件A: フロントエンドがvisitDateをnew Date()でパースしてUTC→JST変換が発生
    X.visitDate is string AND X.visitDate does NOT contain 'T' AND new Date(X.visitDate) shifts timezone
  ) OR (
    // 条件B: スプレッドシート同期でvisitTimeが空欄のときcombineVisitDateAndTimeが日付のみを返す
    X.source = 'spreadsheet_sync' AND X.visitTime is empty AND X.visitDate is date_only_string
  )
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking - 訪問日時の時間部分が保持される
FOR ALL X WHERE isBugCondition(X) DO
  result ← saveAndReloadVisitDate'(X)
  ASSERT result.hours = X.inputHours AND result.minutes = X.inputMinutes
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT saveAndReloadVisitDate(X) = saveAndReloadVisitDate'(X)
END FOR
```
