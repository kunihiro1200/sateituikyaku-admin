# Bugfix Requirements Document

## Introduction

業務依頼（Business）画面のCC224（物件番号）のサイト登録タブで、ユーザーが入力して保存ボタンを押した後、一時的にデータが保存されているように見えるが、しばらく（最大10分）経過するとデータが消えてしまうバグ。

コードベースの調査により、以下の構造が判明している：

- バックエンドAPIは保存時にDBへ書き込み、その後 `writeBackToSpreadsheet()` でスプシへ非同期書き戻しを行う
- GASスクリプト（`GyomuWorkTaskSync.gs`）が10分ごとにスプシ→DBへ `upsert`（`merge-duplicates`）を実行する
- **推定原因**: `writeBackToSpreadsheet()` がサイト登録タブの特定カラムをスプシに正しく書き戻せていない場合、GASの次回同期でスプシの古い値（または空値）がDBを上書きし、保存したデータが消える

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーがサイト登録タブのフィールドに値を入力して保存ボタンを押した THEN システムはDBへの保存に成功し、画面上では一時的に入力値が表示される

1.2 WHEN 保存後10分以内にGASの自動同期（`syncGyomuWorkTasks()`）が実行された THEN システムはスプシの古い値（または空値）でDBを上書きし、ユーザーが入力したデータが消える

1.3 WHEN `writeBackToSpreadsheet()` がサイト登録タブのカラムをスプシに書き戻す THEN システムはカラムマッピングの不一致またはエラーにより、一部のカラムをスプシに正しく反映できない

### Expected Behavior (Correct)

2.1 WHEN ユーザーがサイト登録タブのフィールドに値を入力して保存ボタンを押した THEN システムはDBへの保存とスプシへの書き戻しを正しく完了し、GASの次回同期後もデータが保持される

2.2 WHEN 保存後にGASの自動同期（`syncGyomuWorkTasks()`）が実行された THEN システムはスプシに書き戻された最新値でDBをupsertするため、ユーザーが入力したデータが保持される

2.3 WHEN `writeBackToSpreadsheet()` がサイト登録タブのカラムをスプシに書き戻す THEN システムはDBカラム名とスプシカラム名の逆マッピングを正しく解決し、全カラムをスプシに反映する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが媒介契約タブ・売買契約タブ・決済タブのフィールドを保存した THEN システムはSHALL CONTINUE TO 既存の保存・同期動作を維持する

3.2 WHEN GASの `syncGyomuWorkTasks()` が実行された THEN システムはSHALL CONTINUE TO スプシの全カラムをDBへ正しくupsertする

3.3 WHEN バックエンドAPIの `PUT /api/work-tasks/:propertyNumber` が呼び出された THEN システムはSHALL CONTINUE TO DBへの保存を成功させ、レスポンスを返す

3.4 WHEN `writeBackToSpreadsheet()` が失敗した THEN システムはSHALL CONTINUE TO DBへの保存結果には影響を与えず、エラーログのみを出力する
