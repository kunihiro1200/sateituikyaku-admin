# 業務リスト 間取図CWカウントバグ タスクリスト

## Tasks

- [x] 1. バグの事前確認
  - [x] 1.1 Supabase の `cw_counts` テーブルで `item_name = '間取図（300円）'` の `current_total` が 153 であることを確認する
  - [x] 1.2 フロントエンドの業務リストで「間取図300円（CW）計⇒ 153」が表示されることを確認する
  - [x] 1.3 GASコード `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` の `getCwCountValue` 関数で2行目固定参照になっていることを確認する

- [x] 2. GASコードの修正
  - [x] 2.1 `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` の `getCwCountValue` 関数を修正する
    - A列から「現在計」ラベルを持つ行インデックスを動的に検索する処理を追加
    - `sheet.getRange(2, itemColIndex + 1)` の固定行番号 `2` を、検索で見つけた「現在計」行番号に変更
    - 「現在計」行が見つからない場合は `null` を返してログに記録する
  - [x] 2.2 修正後のコードをGASエディタにデプロイする（コピー＆ペースト）

- [ ] 3. 修正の動作確認
  - [ ] 3.1 GASエディタで `syncCwCounts` 関数を手動実行する
  - [ ] 3.2 Supabase の `cw_counts` テーブルで `item_name = '間取図（300円）'` の `current_total` が 3 に更新されたことを確認する
  - [ ] 3.3 フロントエンドの業務リストで「間取図300円（CW）計⇒ 3」が表示されることを確認する
  - [ ] 3.4 「サイト登録（CW）計」の値も正しく表示されることを確認する（リグレッション確認）
  - [ ] 3.5 業務リストの他のセクション（間取図修正回数等）が影響を受けていないことを確認する
