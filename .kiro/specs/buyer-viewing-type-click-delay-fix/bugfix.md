# バグ修正要件ドキュメント

## はじめに

買主リスト（BuyerViewingResultPage）の「内覧形態」フィールドにおいて、ボタンをクリックしてから約5秒後にようやく反応するという深刻な遅延バグが発生している。

ユーザーが内覧形態（`viewing_mobile` または `viewing_type_general`）のボタンをクリックすると、`handleInlineFieldSave` が呼ばれ、バックエンドの `PUT /api/buyers/:id` エンドポイントが実行される。このエンドポイントは `BuyerService.updateWithSync()` を呼び出し、その中で `initSyncServices()` が毎回 Google Sheets API の JWT 認証（`sheetsClient.authenticate()` → `auth.authorize()`）を実行する。Vercel のサーバーレス環境ではリクエストごとにコールドスタートが発生しやすく、この認証処理が約5秒の遅延を引き起こしている。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN ユーザーが内覧形態ボタンをクリックする THEN システムは約5秒間フリーズし、その後ようやくボタンの選択状態が反映される

1.2 WHEN `PUT /api/buyers/:id?sync=true` が呼ばれる THEN システムは `BuyerService.updateWithSync()` 内で毎回 `initSyncServices()` を実行し、Google Sheets JWT 認証（`auth.authorize()`）に数秒を費やす

1.3 WHEN Vercel サーバーレス環境でコールドスタートが発生する THEN システムは `BuyerService` インスタンスのキャッシュが存在せず、`this.writeService` が null のため認証処理を再実行する

### 期待される動作（正常）

2.1 WHEN ユーザーが内覧形態ボタンをクリックする THEN システムは 1 秒以内にボタンの選択状態を反映し、バックグラウンドで保存処理を完了する

2.2 WHEN `PUT /api/buyers/:id?sync=true` が呼ばれる THEN システムは Google Sheets 認証の待機なしに DB 更新を即座に完了し、スプレッドシート同期は非同期で実行する

2.3 WHEN Google Sheets 認証が必要な場合 THEN システムは認証処理をバックグラウンドで非同期実行し、UI のレスポンスをブロックしない

### 変更してはいけない動作（リグレッション防止）

3.1 WHEN 内覧形態ボタンをクリックして保存が完了する THEN システムは引き続きスプレッドシートへの同期を実行する（同期の実行自体は維持する）

3.2 WHEN `viewing_mobile` または `viewing_type_general` フィールドが更新される THEN システムは引き続き DB への保存を正常に完了する

3.3 WHEN 内覧形態以外のフィールド（`viewing_date`、`latest_status` など）が更新される THEN システムは引き続き従来と同じ動作を維持する

3.4 WHEN スプレッドシート同期が失敗する THEN システムは引き続きリトライキューに追加し、エラーをユーザーに通知する
