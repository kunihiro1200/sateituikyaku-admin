# 実装計画: business-detail-tab-spreadsheet-link

## 概要

`WorkTaskDetailModal` の「媒介契約」タブ（tabIndex=0）および「サイト登録」タブ（tabIndex=1）のヘッダーにスプシボタンを追加する。
`spreadsheetUrl.ts` に汎用関数 `buildSheetUrl` と新定数を追加し、既存の `buildLedgerSheetUrl` をリファクタリングした上で、`WorkTaskDetailModal.tsx` に新しいスプシボタンの表示条件を追加する。

## タスク

- [x] 1. `spreadsheetUrl.ts` の拡張とリファクタリング
  - `frontend/frontend/src/utils/spreadsheetUrl.ts` に以下を追加・変更する
  - 定数 `MEDIATION_REQUEST_SHEET_GID = '1819926492'` を追加する
  - 定数 `ATHOME_SHEET_GID = '1725934947'` を追加する
  - 汎用関数 `buildSheetUrl(spreadsheetUrl: string, gid: string): string` を追加する（既存の `buildLedgerSheetUrl` のURL正規化ロジックをそのまま移植し、gidを引数化する）
  - 既存の `buildLedgerSheetUrl` を `buildSheetUrl(spreadsheetUrl, LEDGER_SHEET_GID)` を呼び出す形にリファクタリングする（外部インターフェース・戻り値は変更しない）
  - _要件: 1.4, 2.4, 4.1, 5.1_

  - [ ]* 1.1 `buildSheetUrl` のユニットテストを作成する
    - `frontend/frontend/src/utils/spreadsheetUrl.test.ts` を作成する
    - 以下のケースをテストする：
      - `#gid=` なしのURL → 指定gidで正しくURL生成
      - `#gid=` ありのURL → 既存gidを除去して指定gidで上書き
      - `?gid=` クエリパラメータありのURL → 除去して指定gidで付加
      - 解析不能なURL（`not-a-url`）→ 元の文字列をそのまま返す
      - `buildLedgerSheetUrl` の後方互換性（gid=78322744 が付加されること）
    - _要件: 1.3, 2.3, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 1.2 `buildSheetUrl` のプロパティテストを作成する（fast-check）
    - **Property 3: tabIndexに応じた正しいgidのURL生成**
    - **Validates: 要件 1.3, 2.3, 4.1**
    - 有効なGoogleスプレッドシートURLに対して、`buildSheetUrl(url, MEDIATION_REQUEST_SHEET_GID)` の結果が `#gid=1819926492` で終わり、`buildSheetUrl(url, ATHOME_SHEET_GID)` の結果が `#gid=1725934947` で終わることを検証する（numRuns: 100）

  - [ ]* 1.3 `buildSheetUrl` の冪等性プロパティテストを作成する（fast-check）
    - **Property 4: URL生成の冪等性（二重適用）**
    - **Validates: 要件 4.2, 4.3, 4.4**
    - 有効なGoogleスプレッドシートURL（`#gid=` あり・なし・`?gid=` あり・なし の任意の組み合わせ）と任意のgid文字列に対して、`buildSheetUrl(url, gid)` を2回適用した結果が1回適用した結果と等しいことを検証する（numRuns: 100）

- [x] 2. `WorkTaskDetailModal.tsx` へのスプシボタン追加
  - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` を変更する
  - インポート文を `import { buildLedgerSheetUrl, buildSheetUrl, MEDIATION_REQUEST_SHEET_GID, ATHOME_SHEET_GID } from '../utils/spreadsheetUrl';` に更新する
  - 既存の `(tabIndex === 2 || tabIndex === 3)` のスプシボタンの直前に、`(tabIndex === 0 || tabIndex === 1)` 用のスプシボタンを追加する
  - tabIndex=0 のとき `buildSheetUrl(url, MEDIATION_REQUEST_SHEET_GID)` でURL生成する
  - tabIndex=1 のとき `buildSheetUrl(url, ATHOME_SHEET_GID)` でURL生成する
  - `disabled` 制御・`sx` スタイル・`window.open` の呼び出しパターンは既存（tabIndex=2・3）と同一にする
  - _要件: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 5.2, 5.3_

  - [ ]* 2.1 スプシボタン表示条件のコンポーネントテストを作成する
    - **Property 1: tabIndex=0・1 のときスプシボタンが表示される**
    - **Validates: 要件 1.1, 2.1**
    - tabIndex=0・1 のとき新スプシボタンが表示され、tabIndex=2・3 のとき既存スプシボタンが表示されることを検証する

  - [ ]* 2.2 スプシボタンの disabled 制御のコンポーネントテストを作成する
    - **Property 2: spreadsheet_url の有無による disabled 制御**
    - **Validates: 要件 3.1, 3.2**
    - `spreadsheet_url` が有効なURLのとき disabled=false、null または空文字のとき disabled=true になることを検証する

- [x] 3. 最終チェックポイント
  - ビルドエラーがないことを確認する（`getDiagnostics` で `spreadsheetUrl.ts` と `WorkTaskDetailModal.tsx` を検査する）
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件番号でトレーサビリティを確保している
- バックエンド・DB変更は一切不要
- `buildLedgerSheetUrl` の外部インターフェースは変更しない（既存の tabIndex=2・3 のスプシボタンへの影響なし）
- プロパティテストは `fast-check` ライブラリを使用する
