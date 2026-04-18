# 実装計画：買主番号クリックでクリップボードコピー

## 概要

`BuyersPage.tsx` のみを変更し、買主番号クリック（タップ）でクリップボードコピーする機能を追加する。
デスクトップのテーブル表示とモバイルのカード表示の両方に対応し、MUI の `Snackbar` でコピー完了を通知する。

## タスク

- [x] 1. インポートと状態・関数の追加
  - `@mui/icons-material/ContentCopy` から `ContentCopyIcon` をインポートする
  - 既存の `@mui/material` インポートに `Snackbar` を追加する
  - `snackbarOpen`（boolean, 初期値 `false`）と `snackbarMessage`（string, 初期値 `''`）の state を追加する
  - `handleCopyBuyerNumber(buyerNumber: string, event: React.MouseEvent)` 関数を追加する
    - `event.stopPropagation()` で行クリックのページ遷移を防止する
    - `navigator.clipboard.writeText(buyerNumber)` でクリップボードに書き込む
    - 成功時は `snackbarMessage` を `"{buyerNumber} をコピーしました"` に設定し `snackbarOpen` を `true` にする
    - 失敗時は `console.error` に出力し、Snackbar は表示しない
  - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.1 プロパティテスト：コピーメッセージのフォーマット（プロパティ 1）
    - **プロパティ 1: コピーメッセージのフォーマット**
    - 任意の買主番号文字列に対して、メッセージが `"{buyerNumber} をコピーしました"` の形式になることを検証する
    - fast-check の `fc.string({ minLength: 1 })` で任意の買主番号を生成する
    - **検証対象: 要件 4.2**

  - [ ]* 1.2 プロパティテスト：連続コピー時のメッセージ更新（プロパティ 2）
    - **プロパティ 2: 連続コピー時のメッセージ更新**
    - 任意の2つの異なる買主番号を連続してコピーした場合、`snackbarMessage` が最後の買主番号のメッセージになることを検証する
    - fast-check の `fc.string({ minLength: 1 })` を2つ使い、2回目のコピー後の状態を確認する
    - **検証対象: 要件 4.4**

- [x] 2. デスクトップテーブルの買主番号セルを変更
  - テーブル行の買主番号 `<TableCell>` 内の `<Typography>` を `<Box>` でラップする
  - `<Box>` に `onClick` ハンドラ（`buyer.buyer_number && handleCopyBuyerNumber(buyer.buyer_number, e)`）を設定する
  - `<Box>` の `sx` に `display: 'inline-flex'`、`alignItems: 'center'`、`gap: 0.5`、`cursor`、`'&:hover .copy-icon': { visibility: 'visible' }` を設定する
  - `buyer.buyer_number` が存在する場合のみ `ContentCopyIcon` を `className="copy-icon"` で表示し、通常時は `visibility: 'hidden'` にする
  - _要件: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.1 ユニットテスト：デスクトップ表示のコピー動作
    - `navigator.clipboard.writeText` が正しい買主番号で呼ばれることを確認する
    - `stopPropagation` が呼ばれ、行クリックのナビゲーションが発生しないことを確認する
    - コピー成功後に Snackbar が表示されることを確認する
    - _要件: 1.1, 1.5, 2.1_

- [x] 3. モバイルカードの買主番号を変更
  - カード内の買主番号 `<Typography>` を `<Box>` でラップする
  - `<Box>` に `onClick` ハンドラ（`buyer.buyer_number && handleCopyBuyerNumber(buyer.buyer_number, e)`）を設定する
  - `<Box>` の `sx` に `display: 'inline-flex'`、`alignItems: 'center'`、`gap: 0.5`、`cursor` を設定する
  - モバイルはホバー状態がないため、`ContentCopyIcon` を常時表示する（`visibility: 'hidden'` なし）
  - _要件: 3.1, 3.2, 3.3_

  - [ ]* 3.1 ユニットテスト：モバイル表示のコピー動作
    - タップ時に `stopPropagation` が呼ばれ、カード全体のページ遷移が発生しないことを確認する
    - コピーアイコンが常時表示されることを確認する
    - _要件: 3.2, 3.3_

- [x] 4. Snackbar コンポーネントを JSX 末尾に追加
  - `</Container>` の直前に `<Snackbar>` コンポーネントを追加する
  - `open={snackbarOpen}`、`autoHideDuration={2000}`、`onClose={() => setSnackbarOpen(false)}` を設定する
  - `message={snackbarMessage}` を設定する
  - `anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}` を設定する
  - _要件: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.1 ユニットテスト：Snackbar の表示仕様
    - `autoHideDuration` が 2000ms に設定されていることを確認する
    - `anchorOrigin` が `{ vertical: 'bottom', horizontal: 'center' }` に設定されていることを確認する
    - Clipboard API 失敗時に Snackbar が表示されないことを確認する
    - _要件: 1.3, 1.4, 4.1, 4.3_

- [x] 5. チェックポイント
  - 全てのテストが通ることを確認する。疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP では省略可能
- 変更対象ファイルは `frontend/frontend/src/pages/BuyersPage.tsx` のみ
- 新規ファイルは作成しない
- プロパティテストには fast-check を使用する
