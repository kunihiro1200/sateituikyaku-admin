# バグフィックス要件ドキュメント

## はじめに

売主一覧ページ（SellersPage）から案件をクリックして通話モードページ（CallModePage）に遷移する際、および通話モードページから一覧に戻る際の遷移時間が著しく長い。

コードベースの調査により、以下の原因が特定された：

- **一覧 → 通話モード遷移**: `loadAllData` が3本のAPIを並列実行した後、さらに `seller.visitAssignee` が確定してから `fetchSidebarSellers`（`/api/sellers` を pageSize=500 で呼び出し）と `fetchSidebarCounts`（`/api/sellers/sidebar-counts`）を逐次実行している。合計5本のAPIコールが発生する。
- **通話モード → 一覧遷移**: `SellersPage` の `fetchSellers` が毎回 `listSellers` を呼び出し、その中で `Promise.all` による全件 `decryptSeller`（暗号化復号 + 従業員名変換）が実行される。さらに `fetchSidebarCounts` も毎回実行される。キャッシュが有効な場合は短縮されるが、キャッシュ切れ時は顕著に遅い。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 売主一覧から案件をクリックして通話モードページに遷移する THEN システムは `loadAllData`（3並列API）完了後に `fetchSidebarSellers`（pageSize=500）と `fetchSidebarCounts` を逐次実行し、合計5本のAPIコールが完了するまでローディング状態が続く

1.2 WHEN 通話モードページから売主一覧に戻る THEN システムは `fetchSellers`（`listSellers` + 全件 `decryptSeller`）と `fetchSidebarCounts` を毎回実行し、キャッシュが切れている場合に顕著な遅延が発生する

1.3 WHEN `listSellers` が実行される THEN システムは取得した全売主レコードに対して `decryptSeller` を `Promise.all` で並列実行し、各レコードで暗号化復号処理と従業員名変換（`getEmployeeNameByInitials`）が発生する

1.4 WHEN `getSidebarCounts` が実行される THEN システムは複数の独立したDBクエリを逐次実行してカウントを集計する

### 期待される動作（正常）

2.1 WHEN 売主一覧から案件をクリックして通話モードページに遷移する THEN システムは売主詳細データ（`/api/sellers/:id`）を優先的に表示し、サイドバーデータは非同期でバックグラウンド取得することで体感遷移時間を短縮する

2.2 WHEN 通話モードページから売主一覧に戻る THEN システムはキャッシュが有効な場合はキャッシュから即座にデータを返し、ユーザーが体感する遅延を最小化する

2.3 WHEN `listSellers` が実行される THEN システムはキャッシュが有効な場合はDBクエリと復号処理をスキップして即座にレスポンスを返す

2.4 WHEN `getSidebarCounts` が実行される THEN システムはキャッシュが有効な場合はキャッシュから即座にカウントを返す

### 変更しない動作（リグレッション防止）

3.1 WHEN 通話モードページで売主データを表示する THEN システムは引き続き正確な売主情報（名前・電話番号・ステータス等）を表示する

3.2 WHEN 売主一覧でサイドバーカテゴリを選択する THEN システムは引き続き正確なカテゴリ別フィルタリングを行う

3.3 WHEN 売主データが更新される THEN システムは引き続き更新後のデータを正しく反映する（キャッシュの適切な無効化）

3.4 WHEN 通話モードページのサイドバーに売主リストを表示する THEN システムは引き続き営担でフィルタリングされた売主リストを表示する

3.5 WHEN 認証が必要なAPIを呼び出す THEN システムは引き続き認証チェックを正しく行う
