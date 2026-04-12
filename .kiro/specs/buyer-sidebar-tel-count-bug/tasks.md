# Implementation Tasks

## Tasks

- [x] 1. Write bug condition exploration property test
  - [x] 1.1 `gas_buyer_complete_code.js`の現在の`updateBuyerSidebarCounts()`ロジックをJavaScriptで再現したテストファイルを作成する
  - [x] 1.2 買主7326・7327・7342相当のデータ（過去日付・担当なし）でバグを再現し、修正前コードでは`todayCall`が3にならないことを確認する
  - [x] 1.3 担当ありの買主（`next_call_date=今日`, `follow_up_assignee='Y'`）が`todayCall`に過剰カウントされることを確認する

- [x] 2. Apply fix to gas_buyer_complete_code.js
  - [x] 2.1 Pythonスクリプトを使って`gas_buyer_complete_code.js`の`updateBuyerSidebarCounts()`内の`assignee`取得順序を`follow_up_assignee || initial_assignee`に修正する
  - [x] 2.2 日付比較を`=== todayStr`から`nextCallDate && nextCallDate <= todayStr`に修正する
  - [x] 2.3 `follow_up_assignee`の有無による分岐を追加し、担当なしのみ`counts.todayCall`にカウント、担当ありは`counts.todayCallAssigned`にカウントするよう修正する
  - [x] 2.4 修正後のコードをgitコミットする（コミット: 6f3542d2）

- [ ] 3. Fix BuyerSync.gs sync error and verify end-to-end
  - [x] 3.1 BuyerSync.gs の PATCH → バルクPOST upsert 変更済み（コミット: 986fbbd2）
  - [ ] 3.2 `syncBuyers()` を実行し、買主7340・7342がDBに登録されることを確認する（GASのURL取得上限リセット後に実施）
  - [ ] 3.3 DB登録後、サイドバーの「当日TEL」が5件→3件に修正されることを確認する（7326・7327・7342の3件）
  - [ ] 3.4 サイドバーの「当日TEL」をクリックした際に一覧が3件表示されることを確認する
  - [ ] 3.5 未来日付・空日付の買主がカウントされないことを確認する（リグレッション防止）
