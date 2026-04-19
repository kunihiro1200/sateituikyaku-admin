# Tasks

## Task List

- [x] 1. `WorkTaskSyncService.initSheetsClient()` を環境変数認証に修正する
  - [x] 1.1 `GOOGLE_SERVICE_ACCOUNT_JSON` 環境変数による JSON 文字列認証を追加する（最優先）
  - [x] 1.2 `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` による JWT 認証を追加する（Vercel 環境用フォールバック）
  - [x] 1.3 `GOOGLE_SERVICE_ACCOUNT_PATH` またはローカルファイルによるファイル認証をローカル開発用フォールバックとして残す
  - [x] 1.4 いずれの認証情報も存在しない場合に明確なエラーメッセージをスローする
  - [x] 1.5 認証成功・失敗時のログ出力を `GoogleSheetsClient` と同様の形式で追加する

- [x] 2. 修正後の動作を検証するユニットテストを作成する
  - [x] 2.1 `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` 環境変数で認証成功するテストを作成する（Fix Checking）
  - [x] 2.2 `GOOGLE_SERVICE_ACCOUNT_JSON` 環境変数で認証成功するテストを作成する（Fix Checking）
  - [x] 2.3 認証情報が一切ない場合にエラーをスローするテストを作成する
  - [x] 2.4 `writeBackToSpreadsheet()` 失敗時に PUT エンドポイントが 200 を返すことを確認するテストを作成する（Preservation Checking）
