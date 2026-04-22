# 実装計画: 業務詳細サイト登録・間取図納期通知機能

## 概要

`BusinessSiteDeadlineHourlyNotificationService` を新規作成し、Vercel Cron Job（毎時0分）から呼び出されるエンドポイントを追加する。サイト登録納期・間取図完了予定の約1時間前に自動メール通知を送信する。

## タスク

- [-] 1. BusinessSiteDeadlineHourlyNotificationService の実装
  - `backend/src/services/BusinessSiteDeadlineHourlyNotificationService.ts` を新規作成する
  - `HourlyNotificationTarget` および `HourlyNotificationResult` インターフェースを定義する
  - `parseDueDateAsJST(dateStr: string): Date | null` を実装する（YYYY-MM-DD → `new Date(dateStr + 'T00:00:00+09:00')`、無効値は `null`）
  - `isInNotificationWindow(dueDateTime: Date, nowJST: Date): boolean` を実装する（nowJST+30分 ≤ dueDateTime ≤ nowJST+90分）
  - `formatRemainingTime(minutes: number): string` を実装する（60未満→「あと約N分」、60の倍数→「あと約N時間」、端数あり→「あと約H時間M分」）
  - `getTargets()` を実装する（`work_tasks` 全件取得 → サイト登録・間取図それぞれフィルタリング）
    - サイト登録: `site_registration_deadline` が通知ウィンドウ内 かつ `site_registration_ok_sent` が空欄
    - 間取図: `floor_plan_due_date` が通知ウィンドウ内 かつ `floor_plan_ok_sent` が空欄
  - `sendNotifications(targets)` を実装する（`EmailService.sendEmailWithCcAndAttachments()` 使用、エラー時は継続）
  - _Requirements: 1.1〜1.10, 2.1〜2.10, 4.1〜4.5, 5.1〜5.3_

  - [x] 1.1 `formatRemainingTime` の実装
    - 60未満: `あと約${minutes}分`
    - 60の倍数: `あと約${minutes/60}時間`
    - 端数あり: `あと約${h}時間${m}分`
    - _Requirements: 4.5_

  - [ ]* 1.2 プロパティテスト: formatRemainingTime の一貫性（Property 1）
    - **Property 1: 残り時間フォーマットの一貫性**
    - **Validates: Requirements 4.5**
    - `fc.integer({ min: 0, max: 10000 })` で任意の非負整数を生成し、フォーマット結果が仕様に一致することを検証

  - [x] 1.3 `parseDueDateAsJST` の実装
    - 有効なYYYY-MM-DD → `new Date(dateStr + 'T00:00:00+09:00')`
    - 空文字・null・不正フォーマット → `null`
    - _Requirements: 4.2, 4.3_

  - [ ]* 1.4 プロパティテスト: parseDueDateAsJST のラウンドトリップ（Property 3）
    - **Property 3: 日付解釈のラウンドトリップ**
    - **Validates: Requirements 4.2, 4.3, 1.9, 2.9**
    - `fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })` で任意の日付を生成し、JST 00:00:00に一致することを検証

  - [x] 1.5 `isInNotificationWindow` の実装
    - `nowJST + 30分 <= dueDateTime <= nowJST + 90分` の場合のみ `true`
    - _Requirements: 1.2, 2.2, 4.1_

  - [ ]* 1.6 プロパティテスト: isInNotificationWindow の正確性（Property 2）
    - **Property 2: 通知ウィンドウ判定の正確性**
    - **Validates: Requirements 1.2, 2.2, 4.1**
    - `fc.integer({ min: -200, max: 200 })` でオフセット分を生成し、30〜90の範囲のみ `true` になることを検証

  - [x] 1.7 `getTargets()` の実装
    - `work_tasks` 全件取得
    - サイト登録・間取図それぞれの通知対象をフィルタリング
    - _Requirements: 1.1〜1.3, 1.8〜1.9, 2.1〜2.3, 2.8〜2.9_

  - [x] 1.8 `sendNotifications()` の実装
    - 件名・本文を要件通りに生成（`Remaining_Time` を動的に埋め込む）
    - `EmailService.sendEmailWithCcAndAttachments()` で `tenant@ifoo-oita.com` に送信
    - エラー時はログ記録して次のレコードへ継続
    - _Requirements: 1.4〜1.7, 1.10, 2.4〜2.7, 2.10, 3.4_

- [x] 2. Cron Jobエンドポイントの追加（backend/src/index.ts）
  - `/api/cron/business-site-deadline-hourly-notification` エンドポイントを追加する
  - 既存の `work-task-deadline-notification` エンドポイントのパターンを踏襲する
  - `CRON_SECRET` による認証チェックを実装する
  - `BusinessSiteDeadlineHourlyNotificationService` を動的インポートして呼び出す
  - 送信件数・スキップ件数・失敗件数をレスポンスとして返す
  - _Requirements: 3.1〜3.5, 5.3_

- [x] 3. vercel.json への Cron Job 設定追加
  - `backend/vercel.json` の `crons` 配列に以下を追加する：
    ```json
    {
      "path": "/api/cron/business-site-deadline-hourly-notification",
      "schedule": "0 * * * *"
    }
    ```
  - _Requirements: 3.1, 3.2_

- [x] 4. チェックポイント — 全テストがパスすることを確認
  - 全テストがパスすることを確認し、疑問点があればユーザーに確認する。

- [ ]* 5. ユニットテストの実装
  - `backend/src/services/__tests__/BusinessSiteDeadlineHourlyNotificationService.test.ts` を新規作成する
  - `formatRemainingTime` のユニットテスト（0分、30分、60分、90分、120分）
  - `parseDueDateAsJST` のユニットテスト（有効日付、空文字、"invalid"、null）
  - `isInNotificationWindow` のユニットテスト（境界値: 29分後→false、30分後→true、60分後→true、90分後→true、91分後→false）
  - _Requirements: 1.2, 1.9, 2.2, 2.9, 4.1〜4.5_

## 注意事項

- タスクに `*` が付いているものはオプションであり、MVPとして省略可能
- 各タスクは前のタスクの成果物を前提として積み上げる
- プロパティテストは `fast-check` ライブラリを使用する
- `site_registration_deadline` は日付のみ（YYYY-MM-DD）のため `T00:00:00+09:00` を付加してJST 00:00:00として解釈する
- 間取図の確認チェックは `floor_plan_ok_sent`（空欄かどうか）を使用する
