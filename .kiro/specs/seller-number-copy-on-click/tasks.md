# 実装計画：売主番号クリックでクリップボードコピー

## 概要

`SellersPage.tsx` のみを変更し、売主番号クリック（タップ）でクリップボードコピーする機能を追加する。
デスクトップのテーブル表示とモバイルのカード表示の両方に対応し、MUI の `Snackbar` でコピー完了を通知する。

## タスク

- [x] 1. インポートと状態・関数の追加
  - `@mui/icons-material/ContentCopy` から `ContentCopyIcon` をインポートする
  - 既存の `@mui/material` インポートに `Snackbar` を追加する
  - `snackbarOpen`（boolean, 初期値 `false`）と `snackbarMessage`（string, 初期値 `''`）の state を追加する
  - `handleCopySellerNumber(sellerNumber: string, event: React.MouseEvent)` 関数を追加する
    - `event.stopPropagation()` で行クリックのページ遷移を防止する
    - `navigator.clipboard.writeText(sellerNumber)` でクリップボードに書き込む
    - 成功時は `snackbarMessage` を `"{sellerNumber} をコピーしました"` に設定し `snackbarOpen` を `true` にする
    - 失敗時は `console.error` に出力し、Snackbar は表示しない
  - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. デスクトップテーブルの売主番号セルを変更
  - テーブル行の売主番号 `<TableCell>` 内の `<Typography>` を `<Box>` でラップする
  - `<Box>` に `onClick` ハンドラ（`seller.sellerNumber && handleCopySellerNumber(seller.sellerNumber, e)`）を設定する
  - `<Box>` の `sx` に `display: 'inline-flex'`、`alignItems: 'center'`、`gap: 0.5`、`cursor`、`'&:hover .copy-icon': { visibility: 'visible' }` を設定する
  - `seller.sellerNumber` が存在する場合のみ `ContentCopyIcon` を `className="copy-icon"` で表示し、通常時は `visibility: 'hidden'` にする
  - _要件: 2.1, 2.2, 2.3, 2.4_

- [x] 3. モバイルカードの売主番号を変更
  - カード内の売主番号 `<Typography>` を `<Box>` でラップする
  - `<Box>` に `onClick` ハンドラ（`seller.sellerNumber && handleCopySellerNumber(seller.sellerNumber, e)`）を設定する
  - `<Box>` の `sx` に `display: 'inline-flex'`、`alignItems: 'center'`、`gap: 0.5`、`cursor` を設定する
  - モバイルはホバー状態がないため、`ContentCopyIcon` を常時表示する（`visibility: 'hidden'` なし）
  - _要件: 3.1, 3.2, 3.3_

- [x] 4. Snackbar コンポーネントを JSX 末尾に追加
  - `</Container>` の直前に `<Snackbar>` コンポーネントを追加する
  - `open={snackbarOpen}`、`autoHideDuration={2000}`、`onClose={() => setSnackbarOpen(false)}` を設定する
  - `message={snackbarMessage}` を設定する
  - `anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}` を設定する
  - _要件: 4.1, 4.2, 4.3, 4.4_

- [x] 5. チェックポイント
  - ビルドエラーがないことを確認する。疑問点があればユーザーに確認する。

## 備考

- 変更対象ファイルは `frontend/frontend/src/pages/SellersPage.tsx` のみ
- 新規ファイルは作成しない
- 日本語を含むファイルのため、Pythonスクリプトを使用してUTF-8で安全に編集する
