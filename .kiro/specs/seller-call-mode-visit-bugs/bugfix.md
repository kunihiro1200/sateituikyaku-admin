# バグ修正要件ドキュメント

## はじめに

売主通話モードページ（`CallModePage`）において、2つのバグが発生している。

**バグ1**: 訪問予約（訪問予定日時）を入力・保存した際に、操作を行ったアカウントのスタッフイニシャルが `visit_valuation_acquirer`（訪問査定取得者）に自動設定されるべきだが、設定されない。

**バグ2**: 通話モードページの訪問統計セクションで、以前はスタッフ全員の統計が表示されていたが、現在は表示されなくなっている。`/api/sellers/visit-stats` エンドポイントが `backend/src/routes/sellers.ts` に存在しないため、APIが404エラーを返している。

---

## バグ分析

### 現在の動作（不具合）

#### バグ1: 訪問査定取得者が表示されない

1.1 WHEN ユーザーが訪問予約（訪問予定日時）を入力して保存する THEN システムは `visit_valuation_acquirer` フィールドを空のまま保存する（ログイン中スタッフのイニシャルが自動設定されない）

1.2 WHEN 訪問予約が保存された後に通話モードページを表示する THEN システムは「訪問査定取得者」フィールドに何も表示しない

#### バグ2: 訪問統計でスタッフ全員が表示されなくなった

1.3 WHEN 訪問予約（`visitDate` または `appointmentDate`）が設定されている売主の通話モードページを表示する THEN システムは `/api/sellers/visit-stats?month=YYYY-MM` にリクエストを送信するが、エンドポイントが存在しないため404エラーが返る

1.4 WHEN 訪問統計セクションが表示される THEN システムはスタッフ別の訪問統計データを表示しない（エラーにより空のまま）

---

### 期待される動作（正しい動作）

#### バグ1: 訪問査定取得者の自動設定

2.1 WHEN ユーザーが訪問予約（訪問予定日時）を入力して保存する THEN システムは SHALL ログイン中スタッフのイニシャルを `visit_valuation_acquirer` フィールドに自動設定して保存する

2.2 WHEN 訪問予約が保存された後に通話モードページを表示する THEN システムは SHALL 「訪問査定取得者」フィールドに自動設定されたイニシャルを表示する

#### バグ2: 訪問統計の表示

2.3 WHEN 訪問予約が設定されている売主の通話モードページを表示する THEN システムは SHALL `/api/sellers/visit-stats?month=YYYY-MM` エンドポイントから訪問統計データを正常に取得する

2.4 WHEN 訪問統計データが取得できた場合 THEN システムは SHALL スタッフ全員の訪問統計（訪問査定取得件数など）を通話モードページに表示する

---

### 変更してはいけない動作（リグレッション防止）

3.1 WHEN ユーザーが訪問予約を保存する THEN システムは SHALL CONTINUE TO `appointmentDate`、`assignedTo`（営担）、`appointmentNotes` を正常に保存する

3.2 WHEN 訪問予約フォームで `visitValuationAcquirer` を手動入力している場合 THEN システムは SHALL CONTINUE TO 手動入力値を優先して保存する（自動設定は手動入力がない場合のみ適用）

3.3 WHEN 訪問予約が設定されていない売主の通話モードページを表示する THEN システムは SHALL CONTINUE TO 訪問統計セクションを表示しない（`loadVisitStats` は `visitDate` または `appointmentDate` がある場合のみ実行）

3.4 WHEN `performance-metrics` エンドポイントが呼び出される THEN システムは SHALL CONTINUE TO 既存の実績メトリクス（訪問査定取得割合、専任件数など）を正常に返す

3.5 WHEN `SellerService.updateSeller()` が呼び出される THEN システムは SHALL CONTINUE TO 既存の全フィールド更新処理を正常に実行する
