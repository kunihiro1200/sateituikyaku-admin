# seller-sidebar-duplicate-and-gas-sync-fix タスクリスト

## Tasks

- [x] 1. バグ1修正: SellerSidebarCountsUpdateService の todayCallNoInfoCount から未着手売主を除外
  - [x] 1.1 `backend/src/services/SellerSidebarCountsUpdateService.ts` の `todayCallNoInfoCount` 計算ロジックに「未着手」条件を満たす売主を除外するフィルターを追加する
  - [x] 1.2 修正後、`todayCallNoInfoCount + todayCallNotStartedCount` の合計が修正前の `todayCallNoInfoCount` と一致することを確認する

- [x] 2. バグ1テスト: サイドバー重複カウントの探索的テスト（修正前コードで実行）
  - [x] 2.1 「未着手」条件を満たす売主が `todayCall` と `todayCallNotStarted` の両方にカウントされることを確認するユニットテストを作成する（`backend/src/services/__tests__/` 配下）
  - [x] 2.2 修正前のコードでテストを実行し、バグが再現されることを確認する（カウンターエグザンプルの取得）

- [x] 3. バグ1テスト: 修正後の Fix Checking と Preservation Checking
  - [x] 3.1 修正後のコードで「未着手」売主が `todayCallNotStarted` のみにカウントされ `todayCall` から除外されることを確認するテストを実行する（Property 1 の検証）
  - [x] 3.2 「未着手」条件を満たさない売主（不通、他決→追客、古い反響日付等）が修正後も `todayCall` に正しくカウントされることを確認するテストを実行する（Property 2 の検証）

- [x] 4. バグ2対応: GAS ハッシュキャッシュのリセットと次電日反映確認
  - [x] 4.1 `gas/seller-sync-clean.gs` の `buildRowHash_()` 関数が `次電日` フィールドを正しく参照していることを確認する（スプレッドシートのヘッダー名との一致確認）
  - [x] 4.2 `resetRowHashCache()` を手動実行して `_seller_hashes` シートをクリアし、次回 `syncSellerList()` 実行後に AA13950 の `next_call_date` がDBに正しく反映されることを確認する

- [x] 5. バグ2テスト: GAS差分検知の Preservation Checking
  - [x] 5.1 スプレッドシートに変更がない売主は修正後もPATCHがスキップされることを確認する（Property 4 の検証）
  - [x] 5.2 `onEditTrigger` による即時同期が引き続き正しく動作することを確認する

- [x] 6. 統合確認: サイドバーUIの表示確認
  - [x] 6.1 修正後のバックエンドをデプロイし、サイドバーの「当日TEL」と「未着手」カウントが正しく表示されることをUIで確認する
  - [x] 6.2 「当日TEL」カウントが修正前より減少し、「未着手」カウントが正しい値になっていることを確認する
