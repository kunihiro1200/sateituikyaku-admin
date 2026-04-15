# 実装計画: buyer-calendar-buyer-number-display

## 概要

買主リストの内覧日カレンダー送信時に、Googleカレンダーイベントのメモ先頭に買主番号を表示する機能。
`backend/src/routes/buyer-appointments.ts` の `defaultDescription` 先頭に1行追加するだけ。

## タスク

- [x] 1. buyer-appointments.ts の defaultDescription 先頭に買主番号を追加
  - `defaultDescription` の先頭行に `買主番号: ${buyerNumber}\n` を追加
  - `buyerNumber` はリクエストボディから取得済みで常に存在するため条件分岐不要
  - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.1 defaultDescription のプロパティテストを作成
    - **Property 1: 買主番号がメモ先頭に存在する**
    - **Validates: Requirements 1.1**
    - **Property 2: メモのフィールド順序が正しい**
    - **Validates: Requirements 1.2**
    - **Property 3: 既存フィールドが保持される**
    - **Validates: Requirements 1.3**

- [x] 2. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きタスクはオプション（スキップ可）
- デプロイは `backend/` ディレクトリで `vercel --prod` を実行
