# Implementation Tasks

## Tasks

- [ ] 1. Write bug condition exploration property test
  - [ ] 1.1 `gas_buyer_complete_code.js`の現在の`updateBuyerSidebarCounts()`ロジックをJavaScriptで再現したテストファイルを作成する
  - [ ] 1.2 買主7326・7327・7342相当のデータ（過去日付・担当なし）でバグを再現し、修正前コードでは`todayCall`が3にならないことを確認する
  - [ ] 1.3 担当ありの買主（`next_call_date=今日`, `follow_up_assignee='Y'`）が`todayCall`に過剰カウントされることを確認する

- [ ] 2. Apply fix to gas_buyer_complete_code.js
  - [ ] 2.1 Pythonスクリプトを使って`gas_buyer_complete_code.js`の`updateBuyerSidebarCounts()`内の`assignee`取得順序を`follow_up_assignee || initial_assignee`に修正する
  - [ ] 2.2 日付比較を`=== todayStr`から`nextCallDate && nextCallDate <= todayStr`に修正する
  - [ ] 2.3 `follow_up_assignee`の有無による分岐を追加し、担当なしのみ`counts.todayCall`にカウント、担当ありは`counts.todayCallAssigned`にカウントするよう修正する
  - [ ] 2.4 修正後のコードをgitコミットする

- [ ] 3. Verify fix and deploy
  - [ ] 3.1 修正後のロジックで買主7326・7327・7342が`todayCall`に3件カウントされることをテストで確認する
  - [ ] 3.2 未来日付・空日付の買主がカウントされないことを確認する（リグレッション防止）
  - [ ] 3.3 GASスクリプトをGoogle Apps Scriptにデプロイする（clasp pushまたは手動コピー）
