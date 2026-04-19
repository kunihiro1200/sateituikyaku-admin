# 実装計画：業務リスト一覧の物件番号ワンクリックコピー機能

## 概要

`WorkTasksPage.tsx` に物件番号のワンクリッククリップボードコピー機能を追加する。
既存の `BuyersPage.tsx` のコピー実装パターンを踏襲し、単一ファイルへの最小限の変更で実現する。

## タスク

- [x] 1. WorkTasksPage.tsx にコピー機能を実装する
  - [x] 1.1 必要なインポートを追加する
    - `ContentCopy as ContentCopyIcon` を `@mui/icons-material` からインポート
    - `Snackbar` を既存の `@mui/material` インポートに追加
    - `frontend/frontend/src/pages/WorkTasksPage.tsx` を編集
    - _要件: 1.1, 2.1_

  - [x] 1.2 Snackbar 用の状態変数を追加する
    - `snackbarOpen: boolean`（初期値 `false`）を追加
    - `snackbarMessage: string`（初期値 `''`）を追加
    - _要件: 2.1, 2.2_

  - [x] 1.3 `handleCopyPropertyNumber` 関数を実装する
    - `event.stopPropagation()` で行クリックへの伝播を防止
    - `navigator.clipboard.writeText(propertyNumber)` でクリップボードにコピー
    - 成功時に `snackbarMessage` を `"{物件番号} をコピーしました"` 形式で設定し `snackbarOpen` を `true` にする
    - 失敗時は `console.error` に出力し Snackbar は表示しない
    - _要件: 1.1, 2.1, 2.3, 3.1_

  - [ ]* 1.4 プロパティテストを書く：コピー関数は正しい値をクリップボードに書き込む
    - **プロパティ 1: コピー関数は正しい値をクリップボードに書き込む**
    - **検証対象: 要件 1.1**
    - fast-check で任意の非空文字列に対して `navigator.clipboard.writeText` が同じ値で呼ばれることを検証

  - [ ]* 1.5 プロパティテストを書く：コピーボタンのクリックはイベント伝播を停止する
    - **プロパティ 4: コピーボタンのクリックはイベント伝播を停止する**
    - **検証対象: 要件 3.1**
    - fast-check で任意の物件番号に対して `event.stopPropagation()` が必ず1回呼ばれることを検証

  - [ ]* 1.6 プロパティテストを書く：コピー成功時のメッセージフォーマット
    - **プロパティ 3: コピー成功時のメッセージフォーマット**
    - **検証対象: 要件 2.1**
    - fast-check で任意の物件番号に対して `snackbarMessage` が `"{物件番号} をコピーしました"` 形式になることを検証

- [x] 2. 物件番号セルの表示を変更する
  - [x] 2.1 物件番号セルに Box とコピーアイコンを追加する
    - `<TableCell>` 内の `<Typography>` を `<Box>` でラップ
    - `task.property_number` が存在する場合のみ `<ContentCopyIcon>` を表示
    - ホバー時にアイコンが表示される CSS（`visibility: 'hidden'` / `'&:hover .copy-icon': { visibility: 'visible' }`）を設定
    - `task.property_number` が存在する場合のみ `handleCopyPropertyNumber` を呼び出す
    - _要件: 1.1, 1.2, 1.3_

  - [ ]* 2.2 プロパティテストを書く：空の物件番号ではコピーボタンを表示しない
    - **プロパティ 2: 空の物件番号ではコピーボタンを表示しない**
    - **検証対象: 要件 1.2**
    - fast-check で `null`・`undefined`・空文字列に対して `ContentCopyIcon` がレンダリングされないことを検証

  - [ ]* 2.3 ユニットテストを書く：物件番号セルの表示
    - コピーアイコンのクリックで `navigator.clipboard.writeText` が正しい物件番号で呼ばれること
    - コピー成功後に Snackbar が表示されること
    - `stopPropagation` が呼ばれ、行クリックの詳細モーダルが開かないこと
    - Clipboard API 失敗時に Snackbar が表示されないこと
    - 物件番号テキスト部分をクリックした場合に `handleRowClick` が呼ばれること
    - _要件: 1.1, 1.2, 1.3, 2.3, 3.1, 3.2_

- [x] 3. Snackbar コンポーネントを追加する
  - [x] 3.1 JSX 末尾に Snackbar を追加する
    - `</Container>` の直前に `<Snackbar>` を配置
    - `open={snackbarOpen}`、`autoHideDuration={2000}`、`onClose={() => setSnackbarOpen(false)}`
    - `anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}`
    - _要件: 2.1, 2.2_

  - [ ]* 3.2 ユニットテストを書く：Snackbar の設定
    - `autoHideDuration` が 2000ms に設定されていること
    - `anchorOrigin` が `{ vertical: 'bottom', horizontal: 'center' }` に設定されていること
    - _要件: 2.1, 2.2_

- [x] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP では省略可能
- 変更対象ファイルは `frontend/frontend/src/pages/WorkTasksPage.tsx` のみ
- 新規ファイル・新規コンポーネントは作成しない
- 既存の `BuyersPage.tsx` のコピー実装パターンを参考にすること
- 各タスクは要件との対応が明確になるよう実装すること
