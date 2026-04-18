# Bugfix Requirements Document

## Introduction

売主管理システムの通話モードページ（`/sellers/:id/call`）にある「🔥 手入力査定額」セクションで2つのバグが発生している。

**バグ1**: 査定額1・査定額2・査定額3を入力して「手入力査定額を保存」ボタンで保存した後、セクション右上の「完了」ボタンを押すと入力した査定額が消えてしまう。根本原因は `loadAllData()` 内で `setIsManualValuation(false)` と `setEditedManualValuationAmount1/2/3('')` が無条件に実行されており、保存後の再読み込み時に手入力値がリセットされることにある。

**バグ2**: 手入力査定額を保存した際、スプレッドシートのCB列（査定額1）・CC列（査定額2）・CD列（査定額3）への即時同期が行われていない。根本原因は `column-mapping.json` の `databaseToSpreadsheet` セクションで `valuation_amount_1/2/3` が「査定額1（自動計算）v」（BC/BD/BE列）にのみマッピングされており、CB/CC/CD列（「査定額1/2/3」）へのマッピングが存在しないことにある。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 手入力査定額（査定額1・査定額2・査定額3）を入力して「手入力査定額を保存」ボタンを押した後、セクション右上の「完了」ボタンを押す THEN the system は入力・保存済みの手入力査定額をUIから消去し、空欄状態に戻してしまう

1.2 WHEN `loadAllData()` が呼び出される（完了ボタン押下後の再読み込みを含む） THEN the system は `setIsManualValuation(false)` と `setEditedManualValuationAmount1/2/3('')` を無条件に実行し、DBに保存済みの手入力査定額をUIに反映しない

1.3 WHEN 手入力査定額を「手入力査定額を保存」ボタンで保存する THEN the system はスプレッドシートのCB列（査定額1）・CC列（査定額2）・CD列（査定額3）を更新しない

1.4 WHEN `SellerService.updateSeller()` が `valuationAmount1/2/3` を更新してスプレッドシート同期を実行する THEN the system は `column-mapping.json` の `databaseToSpreadsheet` マッピングに従いBC/BD/BE列（「査定額1（自動計算）v」）のみを更新し、CB/CC/CD列（「査定額1/2/3」）は更新されない

### Expected Behavior (Correct)

2.1 WHEN 手入力査定額を保存した後に「完了」ボタンを押す THEN the system SHALL 保存済みの手入力査定額をUIに維持し、消去しない

2.2 WHEN `loadAllData()` が呼び出される THEN the system SHALL DBから取得した `manualValuationAmount1/2/3` の値が存在する場合は `setIsManualValuation(true)` を設定し、`setEditedManualValuationAmount1/2/3` に万円単位の値を復元する

2.3 WHEN 手入力査定額を「手入力査定額を保存」ボタンで保存する THEN the system SHALL スプレッドシートのCB列（査定額1）・CC列（査定額2）・CD列（査定額3）を即時同期する

2.4 WHEN `SellerService.updateSeller()` が `valuationAmount1/2/3` を更新してスプレッドシート同期を実行する THEN the system SHALL CB列（査定額1）・CC列（査定額2）・CD列（査定額3）も更新する（`column-mapping.json` の `databaseToSpreadsheet` に `valuation_amount_1/2/3` → `査定額1/2/3` のマッピングを追加する）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 手入力査定額が保存されていない状態で「完了」ボタンを押す THEN the system SHALL CONTINUE TO 査定額フィールドを空欄のまま維持する

3.2 WHEN 固定資産税路線価を入力して「完了」ボタンを押す（自動計算モード） THEN the system SHALL CONTINUE TO 査定額1/2/3を自動計算してDBおよびスプレッドシートに保存する

3.3 WHEN `SellerService.updateSeller()` がスプレッドシート同期を実行する THEN the system SHALL CONTINUE TO BC/BD/BE列（「査定額1（自動計算）v」）を更新する（既存の自動計算列への同期は維持する）

3.4 WHEN 手入力査定額をクリアする THEN the system SHALL CONTINUE TO `isManualValuation` を `false` に戻し、手入力フィールドを空欄にする

3.5 WHEN 手入力査定額を保存する THEN the system SHALL CONTINUE TO `valuationAmount1/2/3`（円単位）をDBに保存し、`fixedAssetTaxRoadPrice` を `null` にクリアする
