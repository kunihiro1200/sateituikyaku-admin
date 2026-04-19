# 業務リスト 間取図500円表示バグ タスクリスト

## Tasks

- [ ] 1. バグの事前確認
  - [ ] 1.1 業務リストでAA13328等の `cw_request_email_2f_above` に値がある案件を開き、【★図面確認】セクションに「間取図300円（CW）計」と誤表示されることを確認する
  - [ ] 1.2 Supabase の `cw_counts` テーブルで `item_name = '間取図（500円）'` のレコードが存在しないことを確認する
  - [ ] 1.3 `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` の `syncCwCounts()` 関数の `targets` 配列に「間取図（500円）」が含まれていないことを確認する

- [-] 2. GASコードの修正
  - [x] 2.1 `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` の `syncCwCounts()` 関数の `targets` 配列に `'間取図（500円）'` を追加する
    - 修正前: `var targets = ['間取図（300円）', 'サイト登録'];`
    - 修正後: `var targets = ['間取図（300円）', '間取図（500円）', 'サイト登録'];`
  - [ ] 2.2 修正後のコードをGASエディタにデプロイする（コピー＆ペースト）
  - [ ] 2.3 GASエディタで `syncCwCounts` 関数を手動実行する
  - [ ] 2.4 Supabase の `cw_counts` テーブルに `item_name = '間取図（500円）'` のレコードが追加されたことを確認する

- [x] 3. フロントエンドコードの修正
  - [x] 3.1 `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の `CwCountData` 型に `floorPlan500: string | null` を追加する
  - [x] 3.2 `useCwCounts()` フックの初期値に `floorPlan500: null` を追加する
  - [x] 3.3 `useCwCounts()` フックのクエリを `.in('item_name', ['間取図（300円）', '間取図（500円）', 'サイト登録'])` に変更する
  - [x] 3.4 `useCwCounts()` フックの `forEach` 内に `if (row.item_name === '間取図（500円）') result.floorPlan500 = row.current_total;` を追加する
  - [x] 3.5 【★図面確認】セクションの `ReadOnlyDisplayField` の `value` を、`getValue('cw_request_email_2f_above')` の有無で500円/300円を切り替えるロジックに修正する

- [ ] 4. 修正の動作確認
  - [ ] 4.1 `cw_request_email_2f_above` に値がある案件（AA13328等）を開き、「間取図500円（CW)計⇒ {値}」が表示されることを確認する（Fix Checking）
  - [ ] 4.2 `cw_request_email_2f_above` が空の案件を開き、「間取図300円（CW)計⇒ {値}」が変わらず表示されることを確認する（Preservation Checking）
  - [ ] 4.3 【サイト登録確認】セクションの「サイト登録（CW）計⇒ {値}」が正常に表示されることを確認する（リグレッション確認）
  - [ ] 4.4 `cw_request_email_2f_above` に値があり `floorPlan500` が null の場合に「-」が表示されることを確認する（エッジケース確認）
