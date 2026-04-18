# Bugfix Requirements Document

## Introduction

通話モードページ（CallModePage: `/sellers/:id/call`）において、訪問予約の日付と時間を登録する際に、日付は正しく保存されるが時間が保存されない（または後から消える）バグを修正する。

このバグは、フロントエンドからの保存時に `visit_date`（TIMESTAMP型）に日時が正しく書き込まれるものの、スプレッドシート自動同期（EnhancedAutoSyncService）が実行された際に `visit_date` が日付のみ（`YYYY-MM-DD 00:00:00`）で上書きされることで発生する可能性がある。また、スプレッドシートの「訪問日」列（日付のみ）と「訪問時間」列（時間のみ）が別々のカラムとして管理されており、同期時に時間情報が失われる構造的な問題がある。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話モードページで訪問予約の日付と時間を入力して保存する THEN システムは日付のみを保存し、時間が `00:00:00` になる場合がある

1.2 WHEN スプレッドシート自動同期（EnhancedAutoSyncService）が実行される THEN システムは `visit_date` をスプレッドシートの「訪問日 Y/M/D」列（日付のみ）で上書きし、フロントエンドから登録した時間情報を消去する

1.3 WHEN スプレッドシートの「訪問日 Y/M/D」列と「訪問時間」列の両方に値がある THEN システムは `visit_date`（TIMESTAMP型）に日付のみを保存し、時間を `visit_time` カラムに別途保存するが、フロントエンドの表示では `visit_date` の時間部分のみを参照するため時間が表示されない

### Expected Behavior (Correct)

2.1 WHEN 通話モードページで訪問予約の日付と時間を入力して保存する THEN システムは `visit_date`（TIMESTAMP型）に日付と時間の両方を `YYYY-MM-DD HH:mm:ss` 形式で正しく保存する SHALL

2.2 WHEN スプレッドシート自動同期が実行される THEN システムはスプレッドシートの「訪問日 Y/M/D」列と「訪問時間」列を組み合わせて `visit_date` を `YYYY-MM-DD HH:mm:ss` 形式で保存し、フロントエンドから登録した時間情報を消去しない SHALL

2.3 WHEN スプレッドシートの「訪問時間」列に値がある THEN システムは `visit_date` の時間部分にその値を反映し、`visit_time` カラムとの整合性を保つ SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 通話モードページで訪問予約の日付のみを入力して保存する（時間を指定しない） THEN システムは CONTINUE TO 日付を正しく保存し、時間部分は `00:00:00` として扱う

3.2 WHEN スプレッドシートの「訪問日 Y/M/D」列に値があり「訪問時間」列が空欄の場合 THEN システムは CONTINUE TO 日付のみを `visit_date` に保存する（時間は `00:00:00`）

3.3 WHEN 通話モードページで訪問予約を削除（日付を空欄にして保存）する THEN システムは CONTINUE TO `visit_date` を `null` にクリアする

3.4 WHEN 訪問予約の営担（visitAssignee）を変更して保存する THEN システムは CONTINUE TO 営担を正しく更新し、日時情報は変更しない

3.5 WHEN スプレッドシート同期で「訪問日 Y/M/D」列が変更されていない場合 THEN システムは CONTINUE TO `visit_date` を更新しない（不要な上書きを行わない）

---

## Bug Condition (バグ条件の定式化)

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type VisitAppointmentInput
  OUTPUT: boolean

  // フロントエンドから時間付きで保存した後、スプレッドシート同期が実行された場合
  RETURN (X.visitDate が時間情報を含む) AND
         (スプレッドシートの「訪問時間」列が空欄 OR 同期ロジックが日付のみで上書きする)
END FUNCTION
```

### Fix Checking プロパティ

```pascal
// Property: Fix Checking - 訪問時間の保存
FOR ALL X WHERE isBugCondition(X) DO
  result ← saveVisitAppointment'(X)
  ASSERT result.visit_date の時間部分 = X.inputTime
END FOR
```

### Preservation Checking プロパティ

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT saveVisitAppointment(X) = saveVisitAppointment'(X)
END FOR
```
