# バグ修正要件ドキュメント

## はじめに

売主通話モードページ（`CallModePage`）の訪問予約セクションにおいて、`visit_valuation_acquirer`（訪問査定取得者）フィールドが一度自動入力された後、編集画面でクリア（空欄）にしても値が残り続けるバグを修正する。

**根本原因**: `handleSaveAppointment` 内のフォールバックロジックが、ユーザーが意図的にフィールドをクリアした場合でも発動してしまう。`editedVisitValuationAcquirer` が空文字列の場合、フォールバックが自動的にスタッフのイニシャルを設定し、クリアの意図が無視される。

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN ユーザーが訪問査定取得者フィールドを一度自動入力された後に編集画面でクリア（空欄）にして保存する THEN システムはフォールバックロジックを発動してスタッフのイニシャルを自動設定し、空欄のまま保存されない

1.2 WHEN `editedVisitValuationAcquirer` が空文字列（ユーザーが意図的にクリアした状態）で `handleSaveAppointment` が呼ばれる THEN システムは `employees.find()` または `getActiveEmployees()` を呼び出してイニシャルを取得し、`visitValuationAcquirer` に設定して送信する

### 期待される動作（正しい動作）

2.1 WHEN ユーザーが訪問査定取得者フィールドを編集画面でクリア（空欄）にして保存する THEN システムは SHALL `visitValuationAcquirer: null` をAPIに送信し、フィールドを空欄として保存する

2.2 WHEN ユーザーが訪問査定取得者フィールドを空欄のまま新規に訪問予約を保存する（フィールドに一度も値が入っていない場合） THEN システムは SHALL ログイン中スタッフのイニシャルを自動設定して保存する

### 変更してはいけない動作（リグレッション防止）

3.1 WHEN ユーザーが訪問査定取得者フィールドに値を手動入力して保存する THEN システムは SHALL CONTINUE TO その手動入力値をそのまま保存する

3.2 WHEN ユーザーが訪問予約を新規作成し、訪問査定取得者フィールドが一度も設定されていない（`seller.visitValuationAcquirer` が null または undefined）状態で保存する THEN システムは SHALL CONTINUE TO ログイン中スタッフのイニシャルを自動設定して保存する

3.3 WHEN ユーザーが訪問予約を保存する THEN システムは SHALL CONTINUE TO `visitDate`、`visitTime`、`visitAssignee`、`appointmentNotes` を正常に保存する

3.4 WHEN `SellerService.updateSeller()` が `visitValuationAcquirer: null` を受け取る THEN システムは SHALL CONTINUE TO `visit_valuation_acquirer` カラムを `null` で更新する
