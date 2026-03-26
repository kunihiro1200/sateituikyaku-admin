# 実装計画：種別=土の場合のみ表示するフィールド追加

## 概要

`WorkTaskDetailModal.tsx` の `SiteRegistrationSection` を修正し、`property_type === '土'` の場合のみ3フィールドを表示する。変更対象は1ファイルのみ。

## タスク

- [x] 1. `CadastralMapFieldSelect` コンポーネントを追加する
  - `WorkTaskDetailModal.tsx` 内に `CadastralMapFieldSelect` コンポーネントを新規定義する
  - `button-select-layout-rule.md` のルールに従い、ラベルとボタンを横並び・各ボタンに `flex: 1` を付与して均等幅で実装する
  - 選択肢は「格納済み＆スプシに「有、無」を入力済み」「未」「不要」の3つ
  - 選択時に `handleFieldChange('cadastral_map_field', opt)` を呼び出す
  - _要件: 3.3, 3.4, 3.5_

  - [ ]* 1.1 `CadastralMapFieldSelect` のプロパティテストを書く
    - **Property 1: 種別=土の場合のみ3フィールドが表示される**
    - **Validates: 要件 1.2, 1.3, 2.1, 2.2, 3.1, 3.2**

- [x] 2. `SiteRegistrationSection` の条件分岐ブロックを修正する
  - 既存の `cadastral_map_url` の `EditableButtonSelect`（ボタン選択UI）を削除する
  - 既存の `property_type === '土'` 条件分岐ブロックを修正し、以下の順序で3フィールドをまとめる：
    1. `<EditableField label="字図、地積測量図URL*" field="cadastral_map_url" type="url" />`
    2. `<EditableField label="地積測量図・字図（営業入力）" field="cadastral_map_sales_input" />`
    3. `<CadastralMapFieldSelect />`
  - 「サイト備考」フィールドの直後に配置する
  - _要件: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1_

  - [ ]* 2.1 表示制御のプロパティテストを書く
    - **Property 1: 種別=土の場合のみ3フィールドが表示される**
    - **Validates: 要件 1.2, 1.3, 2.1, 2.2, 3.1, 3.2**

  - [ ]* 2.2 URLフィールドの「開く」リンクのプロパティテストを書く
    - **Property 2: URLフィールドに値がある場合「開く」リンクが表示される**
    - **Validates: 要件 1.5**

- [x] 3. チェックポイント - 動作確認
  - `getDiagnostics` でTypeScriptエラーがないことを確認する
  - `property_type === '土'` の場合に3フィールドが表示されること、それ以外では非表示になることを確認する
  - 表示順序が「字図、地積測量図URL」→「地積測量図・字図（営業入力）」→「地積測量図、字図」であることを確認する
  - ユーザーに質問があれば確認する

## 注意事項

- タスクに `*` が付いているものはオプションであり、スキップ可能
- 変更対象は `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の1ファイルのみ
- DBカラム・カラムマッピング・APIは変更不要（既に定義済み）
- デプロイは `git push origin main` で自動デプロイ（CLIは使わない）
