# 実装計画：値下げ予約日メール配信機能

## 概要

`property_listings` テーブルの `price_reduction_scheduled_date` が当日（JST）と一致する物件を検出し、担当者へメール通知を送信する Vercel Cron Job 機能を実装する。

既存の `EmailService`（Gmail API）と `CRON_SECRET` 認証の仕組みを再利用し、`backend/src/` に新しいサービスとエンドポイントを追加する。

## Tasks

- [x] 1. `PriceReductionNotificationService` の実装
  - [x] 1.1 インターフェースと型定義を作成する
    - `PriceReductionTarget` インターフェースを定義する
    - `NotificationResult` インターフェースを定義する
    - `backend/src/services/PriceReductionNotificationService.ts` を新規作成する
    - _Requirements: 1.1, 2.1_

  - [x] 1.2 `getJSTDateString` メソッドを実装する
    - UTC日時を受け取り、JST（UTC+9）の `YYYY-MM-DD` 文字列を返す純粋関数として実装する
    - 日付境界付近（UTC 14:59 = JST 23:59、UTC 15:00 = JST 翌日 00:00）を正しく処理する
    - _Requirements: 1.3_

  - [ ]* 1.3 Property 2: JST日付変換の正確性 のプロパティテストを書く
    - **Property 2: JST日付変換の正確性**
    - **Validates: Requirements 1.3**
    - fast-check で任意のUTC日時を生成し、`getJSTDateString` の結果が UTC+9 オフセットを適用した正しい `YYYY-MM-DD` であることを検証する
    - 日付境界値（UTC 14:59、UTC 15:00）を含むケースを重点的に検証する

  - [x] 1.4 `getTodayTargets` メソッドを実装する
    - Supabase クライアントを使用して `property_listings` テーブルから当日（JST）の物件を取得する
    - `price_reduction_scheduled_date` が null の物件を除外する
    - `getJSTDateString` を使用して当日の JST 日付文字列を生成してフィルタリングする
    - _Requirements: 1.1, 1.4_

  - [ ]* 1.5 Property 1: 当日物件フィルタリングの正確性 のプロパティテストを書く
    - **Property 1: 当日物件フィルタリングの正確性**
    - **Validates: Requirements 1.1, 1.4**
    - fast-check で当日・過去・未来・null の日付を持つ物件リストを生成し、`getTodayTargets` が当日（JST）の物件のみを返すことを検証する

  - [x] 1.6 `buildEmailBody` メソッドを実装する
    - `PriceReductionTarget` を受け取り、メール本文文字列を返す純粋関数として実装する
    - 本文形式：`物件番号：{property_number}\n物件住所：{address}\n値下げ予約日：{price_reduction_scheduled_date}`
    - _Requirements: 2.3_

  - [ ]* 1.7 Property 4: メール内容の正確性 のプロパティテストを書く
    - **Property 4: メール内容の正確性**
    - **Validates: Requirements 2.2, 2.3**
    - fast-check で任意の物件データを生成し、`buildEmailBody` の結果が全フィールド値を含むことを検証する

  - [x] 1.8 `sendNotifications` メソッドを実装する
    - 対象物件リストを受け取り、各物件に対して `EmailService.sendEmail` を呼び出す
    - 送信先: `tenant@ifoo-oita.com`、件名: `本日すぐに値下げお願い致します！！`
    - 1件失敗しても残りの物件の送信を継続する
    - 各物件の送信結果（成功/失敗）をログに記録する
    - `NotificationResult`（sent, failed, details）を返す
    - _Requirements: 2.1, 2.2, 2.4, 4.3_

  - [ ]* 1.9 Property 3: メール送信件数の正確性 のプロパティテストを書く
    - **Property 3: メール送信件数の正確性**
    - **Validates: Requirements 2.1, 3.4**
    - fast-check で任意のN件物件リストを生成し（EmailServiceをモック）、`sent + failed === N` が常に成立することを検証する

  - [ ]* 1.10 Property 5: エラー時の継続処理 のプロパティテストを書く
    - **Property 5: エラー時の継続処理**
    - **Validates: Requirements 2.4**
    - fast-check でN件物件リストとK番目失敗シナリオを生成し、K番目が失敗しても残りN-1件の送信が実行され `sent + failed === N` が成立することを検証する

- [x] 2. Cron Job エンドポイントの実装
  - [x] 2.1 `backend/src/index.ts` に `GET /api/cron/price-reduction-notification` エンドポイントを追加する
    - `Authorization: Bearer {CRON_SECRET}` ヘッダーを検証する
    - 認証失敗時は HTTP 401 を返す
    - `PriceReductionNotificationService.getTodayTargets()` を呼び出す
    - 対象物件が0件の場合はメール送信をスキップして `{ success: true, sent: 0, failed: 0 }` を返す
    - `PriceReductionNotificationService.sendNotifications()` を呼び出す
    - 正常完了時は HTTP 200 で `{ success: true, sent: N, failed: M }` を返す
    - 予期しないエラー時は HTTP 500 を返す
    - 実行開始・検出件数・完了サマリーをログに記録する
    - _Requirements: 1.2, 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.4_

  - [ ]* 2.2 Property 6: 不正認証の拒否 のプロパティテストを書く
    - **Property 6: 不正認証の拒否**
    - **Validates: Requirements 3.2**
    - fast-check で任意の不正な Authorization ヘッダー値（空文字、ランダム文字列、`Bearer` プレフィックスなし、誤ったシークレット値）を生成し、エンドポイントが常に HTTP 401 を返すことを検証する

  - [ ]* 2.3 単体テストを書く
    - 対象物件0件の場合にメール送信がスキップされること
    - DB取得エラー時に HTTP 500 が返ること
    - 正常完了時に HTTP 200 と送信件数が返ること
    - _Requirements: 1.2, 3.4, 3.5_

- [ ] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 4. `vercel.json` へのCronスケジュール設定追加
  - [x] 4.1 `backend/vercel.json` の `crons` に以下を追加する
    - `path`: `/api/cron/price-reduction-notification`
    - `schedule`: `0 0 * * *`（UTC 00:00 = JST 09:00）
    - _Requirements: 3.3_

- [x] 5. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションであり、MVP実装では省略可能
- 各タスクは要件番号を参照しており、トレーサビリティを確保している
- プロパティテストは fast-check を使用し、最低100回のイテレーションで実行する
- 本機能は `backend/src/`（社内管理システム用バックエンド、ポート3000）に実装する
- 既存の `EmailService`（Gmail API）と `CRON_SECRET` 認証を再利用する
