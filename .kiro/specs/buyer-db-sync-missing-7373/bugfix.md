# バグ修正要件ドキュメント

## はじめに

買主リストのスプレッドシートに買主番号7373が存在するにもかかわらず、DBに同期されていないバグを修正する。

調査の結果、`EnhancedAutoSyncService`の`detectMissingBuyers()`メソッドにおいて、`getAllDbBuyerNumbers()`が`deleted_at`フィルタリングを行っていないことが根本原因として特定された。

具体的には以下の問題が存在する：

- `getAllDbBuyerNumbers()`は`deleted_at`の有無に関わらず全レコードを取得する
- `getAllActiveBuyerNumbers()`は`.is('deleted_at', null)`でアクティブなレコードのみを取得する
- `detectMissingBuyers()`は`getAllDbBuyerNumbers()`を使用しているため、過去に`deleted_at`がセットされた（ソフトデリート状態の）買主番号も「DBに存在する」と判断し、スプレッドシートに存在しても「欠損なし」と誤判定する

なお、スプレッドシートの「削除」列（`is_deleted`）は同期処理に一切影響しない（無視する）。



## バグ分析

### 現在の動作（不具合）

1.1 WHEN 買主番号7373がスプレッドシートに存在し、かつDBに`deleted_at`がセットされたレコードが存在する THEN システムは`detectMissingBuyers()`で「DBに存在する」と誤判定し、同期をスキップする

1.2 WHEN `detectMissingBuyers()`が`getAllDbBuyerNumbers()`を呼び出す THEN システムは`deleted_at`フィルタリングなしで全レコードを取得するため、ソフトデリート済みの買主番号も「存在する」と判断する

### 期待される動作（正しい動作）

2.1 WHEN 買主番号7373がスプレッドシートに存在し、かつDBに`deleted_at`がセットされたレコードが存在する THEN システムは`detectMissingBuyers()`で「DBにアクティブなレコードが存在しない」と正しく判定し、同期対象として検出する

2.2 WHEN `detectMissingBuyers()`がDB上の買主番号を取得する THEN システムは`deleted_at`がnullのレコードのみを取得し（`getAllActiveBuyerNumbers()`と同様のフィルタリング）、ソフトデリート済みの買主番号を「存在しない」と正しく判断する

### 変更されない動作（リグレッション防止）

3.1 WHEN 買主番号がスプレッドシートに存在し、DBにもアクティブなレコード（`deleted_at`がnull）が存在する THEN システムは引き続き「DBに存在する」と正しく判定し、`detectMissingBuyers()`の検出対象に含めない

3.2 WHEN 買主番号がスプレッドシートに存在せず、DBにアクティブなレコードが存在する THEN システムは引き続き`detectDeletedBuyers()`でその買主を削除対象として検出する

3.3 WHEN 買主番号がスプレッドシートにも存在し、DBにもアクティブなレコードが存在し、データに差分がある THEN システムは引き続き`detectUpdatedBuyers()`で更新対象として検出し、`syncUpdatedBuyers()`で更新する

3.4 WHEN `syncBuyers()`が実行される THEN システムは引き続き安全ガード（スプレッドシート0件チェック、50%比率チェック、10%削除閾値チェック）を適用する
