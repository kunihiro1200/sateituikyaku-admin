# 実装計画: business-detail-spreadsheet-link

## 概要

`WorkTaskDetailModal` のヘッダーに「スプシ」ボタンを追加する。
フロントエンドのみの変更（新規ファイル1件、既存ファイル1件の修正）。

## タスク

- [x] 1. `spreadsheetUrl.ts` ユーティリティ関数の実装
  - `frontend/frontend/src/utils/spreadsheetUrl.ts` を新規作成する
  - `LEDGER_SHEET_GID = '78322744'` 定数をエクスポートする
  - `buildLedgerSheetUrl(spreadsheetUrl: string): string` 関数を実装する
    - ハッシュ（`#gid=...`）を除去
    - クエリパラメータ（`?gid=...`）を除去
    - パスを `/edit` で正規化
    - `#gid=78322744` を付加して返す
    - URL解析失敗時は元の文字列をそのまま返す（try-catch）
  - _Requirements: 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 1.1 `buildLedgerSheetUrl` のユニットテストを作成する
    - 設計書のテーブルに記載された4ケースを例示テストとして実装する
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 1.2 Property 3: URL生成の冪等性（gid付加の一意性）のプロパティテストを作成する
    - **Property 3: URL生成の冪等性（gid付加の一意性）**
    - fast-check を使用し、有効なスプレッドシートURLの任意の組み合わせに対して `buildLedgerSheetUrl` の結果が `#gid=78322744` で終わり、かつ `#gid=` が1つだけ含まれることを検証する
    - **Validates: Requirements 3.2, 3.3, 4.1, 4.2, 4.3, 4.4**

  - [ ]* 1.3 Property 4: URL生成の冪等性（二重適用）のプロパティテストを作成する
    - **Property 4: URL生成の冪等性（二重適用）**
    - fast-check を使用し、`buildLedgerSheetUrl` を2回適用した結果が1回適用した結果と等しいことを検証する
    - **Validates: Requirements 3.2, 3.3**

- [x] 2. `WorkTaskDetailModal.tsx` へのスプシボタン追加
  - `buildLedgerSheetUrl` を `../utils/spreadsheetUrl` からインポートする
  - `DialogTitle` 内のヘッダー行に「スプシ」ボタンを追加する
    - `tabIndex === 2 || tabIndex === 3` のときのみ表示（条件付きレンダリング）
    - `spreadsheet_url` が null / 空文字のとき `disabled` にする
    - クリック時に `window.open(buildLedgerSheetUrl(url), '_blank', 'noopener,noreferrer')` で新しいタブを開く
    - `variant="outlined"`, `size="small"`, `sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1_

  - [ ]* 2.1 Property 1: タブインデックスによるボタン表示制御のコンポーネントテストを作成する
    - **Property 1: タブインデックスによるボタン表示制御**
    - React Testing Library を使用し、tabIndex 0・1 でボタン非表示、tabIndex 2・3 でボタン表示を検証する
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 2.2 Property 2: spreadsheet_url の有無によるボタン活性制御のコンポーネントテストを作成する
    - **Property 2: spreadsheet_url の有無によるボタン活性制御**
    - React Testing Library を使用し、`spreadsheet_url` あり → enabled、なし → disabled を検証する
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. 最終チェックポイント
  - すべてのテストが通ることを確認する。疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号でトレーサビリティを確保
- プロパティテストには fast-check を使用（設計書に明記）
- バックエンド・DB変更は一切不要
