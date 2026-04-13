# 実装計画：物件一覧テーブルの列表示変更

## 概要

`PropertyListingsPage.tsx` のテーブル列を変更する。「公開URL」「格納先URL」列を削除し、「所在地」列の直後に「住居表示」列を追加する。変更はPythonスクリプトを使用してUTF-8エンコーディングを保護しながら適用する。

## タスク

- [x] 1. Pythonスクリプトで列変更を適用する
  - `frontend/frontend/src/pages/PropertyListingsPage.tsx` を対象に以下の変更をすべて1つのPythonスクリプトで適用する
  - `import PublicUrlCell from '../components/PublicUrlCell';` のインポート行を削除する
  - テーブルヘッダーから `<TableCell>公開URL</TableCell>` を削除する
  - テーブルヘッダーから `<TableCell>格納先URL</TableCell>` を削除する
  - テーブルヘッダーの「所在地」`<TableCell>` の直後に `<TableCell>住居表示</TableCell>` を追加する
  - データ行から `PublicUrlCell` を含む `<TableCell>` ブロックを削除する
  - データ行から `storage_location` を使用する `Link` を含む `<TableCell>` ブロックを削除する
  - データ行の「所在地」セルの直後に `display_address` を表示するセルを追加する（`maxWidth: 200`、`overflow: 'hidden'`、`textOverflow: 'ellipsis'`、`whiteSpace: 'nowrap'`）
  - `display_address` が null/undefined/空文字の場合は「-」を表示する（`listing.display_address || '-'`）
  - `colSpan={12}` を `colSpan={11}` に更新する（ローディング中・空データ表示の両方）
  - スクリプトは `open(..., 'rb')` で読み込み、`open(..., 'wb')` + `.encode('utf-8')` で書き込む
  - _要件: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [ ]* 1.1 display_address 表示ロジックのプロパティテストを作成する
    - **プロパティ1: display_address の値がセルに表示される**
    - fast-check で任意の非空文字列を生成し、`display_address` に設定してレンダリング、「住居表示」セルにその値が表示されることを確認する
    - **Validates: 要件 3.2**

  - [ ]* 1.2 空の display_address フォールバック表示のプロパティテストを作成する
    - **プロパティ2: 空の display_address はフォールバック表示される**
    - fast-check で null / undefined / 空文字列を生成し、「住居表示」セルに「-」が表示されることを確認する
    - **Validates: 要件 3.3**

  - [ ]* 1.3 テーブル列変更の単体テストを作成する
    - ヘッダーに「公開URL」が存在しないこと（要件 1.1）
    - ヘッダーに「格納先URL」が存在しないこと（要件 2.1）
    - ヘッダーに「住居表示」が「所在地」の直後に存在すること（要件 3.1）
    - データ行に `PublicUrlCell` が存在しないこと（要件 1.2）
    - データ行に `storage_location` を使った `Link` が存在しないこと（要件 2.2）
    - 「住居表示」セルに `maxWidth: 200` 等のスタイルが適用されていること（要件 3.4）
    - ローディング・空データ状態で `colSpan={11}` が存在すること（要件 4.1, 4.2）

- [x] 2. チェックポイント - 変更内容を確認する
  - `getDiagnostics` でTypeScriptエラーがないことを確認する
  - テーブルヘッダーが11列になっていることを確認する
  - `PublicUrlCell` のインポートが削除されていることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 3. Vercelにデプロイする
  - `frontend/frontend` ディレクトリで `vercel --prod` を実行し、`sateituikyaku-admin-frontend` プロジェクトにデプロイする
  - デプロイ完了後、本番URLで物件一覧テーブルの列が正しく表示されることを確認する
  - _要件: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

## 注意事項

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- 日本語を含む `PropertyListingsPage.tsx` の編集は必ずPythonスクリプト経由で行う（`strReplace` ツールの直接使用禁止）
- `storage_location` フィールドは `PropertyListing` インターフェースの型定義からは削除しない
