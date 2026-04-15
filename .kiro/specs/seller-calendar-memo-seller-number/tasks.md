# 実装計画: seller-calendar-memo-seller-number

## 概要

カレンダーイベントのメモ先頭に売主番号を表示する機能。
`CalendarService.supabase.ts` と `appointments.ts` の2ファイルのみを変更する。

## タスク

- [x] 1. CalendarService の formatEventDescription に sellerNumber 引数を追加
  - `formatEventDescription` のシグネチャに `sellerNumber?: string` を末尾に追加
  - `sellerNumber` が存在する場合、メモの先頭行に `売主番号: {sellerNumber}\n` を追加
  - `sellerNumber` が `undefined` / `null` / 空文字の場合は何も出力しない
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 formatEventDescription のプロパティテストを作成
    - **Property 1: 売主番号が先頭に表示される**
    - **Validates: Requirements 1.1**
    - **Property 2: 売主番号なしの場合は既存構造を維持する**
    - **Validates: Requirements 1.2**
    - **Property 3: メモのフォーマット順序が正しい**
    - **Validates: Requirements 1.3, 1.4**

- [x] 2. CalendarService の createAppointment に sellerNumber 引数を追加
  - `createAppointment` のシグネチャに `sellerNumber?: string` を末尾に追加
  - 内部の `formatEventDescription` 呼び出しに `sellerNumber` を渡す
  - _Requirements: 2.2_

- [x] 3. AppointmentRoute の createAppointment 呼び出しに seller.sellerNumber を追加
  - `backend/src/routes/appointments.ts` の `calendarService.createAppointment` 呼び出しに `seller.sellerNumber` を第6引数として追加
  - `seller.sellerNumber` が未設定でも既存フローに影響しないことを確認
  - _Requirements: 2.1, 2.3_

- [x] 4. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きタスクはオプション（スキップ可）
- デプロイは `backend/` ディレクトリで `vercel --prod` を実行
