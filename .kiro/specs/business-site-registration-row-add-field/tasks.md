# 実装計画：業務リスト サイト登録タブ「物件一覧に行追加」フィールド移動と条件付き必須バリデーション

## 概要

`WorkTaskDetailModal.tsx` 内の `SiteRegistrationSection` コンポーネントを対象に、以下の変更を実装する。

1. `EditableButtonSelect` に `labelColor` プロパティを追加してラベル色の動的切り替えを可能にする
2. 「物件一覧に行追加」フィールドを【確認後処理】セクションから【図面作成依頼】セクション直下に移動する
3. `cw_request_email_site` の値に応じてラベル色をリアルタイムで切り替える
4. 保存時の条件付きバリデーションPOPUP（`RowAddWarningDialog`）を実装する

## タスク

- [x] 1. `EditableButtonSelect` コンポーネントに `labelColor` プロパティを追加する
  - `WorkTaskDetailModal.tsx` 内の `EditableButtonSelect` の型定義に `labelColor?: 'error' | 'text.secondary'` を追加する
  - `Typography` の `color` プロパティに `labelColor || 'text.secondary'` を渡す
  - `labelColor === 'error'` の場合に `fontWeight: 700` を適用する
  - _Requirements: 2.1, 2.2_

- [x] 2. 「物件一覧に行追加」フィールドを【図面作成依頼】セクション直下に移動する
  - [x] 2.1 【図面作成依頼】セクション（`#e8f5e9`背景）の末尾に `bgcolor: '#fce4ec'` の `Box` でラップした `EditableButtonSelect` を追加する
    - `label="物件一覧に行追加*"`、`field="property_list_row_added"`、`options={['追加済', '未']}` を設定する
    - `labelColor` に `getValue('cw_request_email_site') ? 'error' : 'text.secondary'` を渡す
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3_
  - [x] 2.2 【確認後処理】セクションから「物件一覧に行追加」フィールドを削除する
    - 既存の `EditableButtonSelect label="物件一覧に行追加*"` の記述を削除する
    - 【確認後処理】セクションの他のフィールド（配信日、物件ファイル、公開予定日、メール配信、サイト登録締め日v）は変更しない
    - _Requirements: 1.3, 4.1_

- [x] 3. チェックポイント - ここまでの変更を確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. `RowAddWarningDialog` コンポーネントを実装する
  - [x] 4.1 `RowAddWarningDialog` コンポーネントを `WorkTaskDetailModal.tsx` 内に追加する
    - `open`、`onConfirm`、`onCancel` の3プロパティを持つインターフェースを定義する
    - MUI の `Dialog` / `DialogTitle` / `DialogContent` / `DialogActions` / `Button` を使用する
    - タイトルに「確認」、本文に「物件一覧に行追加が未入力です。このまま保存しますか？」を表示する
    - 「このまま保存」ボタン（`onConfirm`）と「キャンセル」ボタン（`onCancel`）を配置する
    - _Requirements: 3.2, 3.3_
  - [x] 4.2 `rowAddWarningDialog` stateを追加し、`RowAddWarningDialog` をJSXに組み込む
    - `const [rowAddWarningDialog, setRowAddWarningDialog] = useState<{ open: boolean }>({ open: false })` を追加する
    - `onConfirm` で `setRowAddWarningDialog({ open: false })` を呼び出した後 `executeSave()` を実行する
    - `onCancel` で `setRowAddWarningDialog({ open: false })` を呼び出す
    - _Requirements: 3.4, 3.5_

- [x] 5. `handleSave` を `handleSave` + `executeSave` に分割し、保存前バリデーションを追加する
  - [x] 5.1 既存の `handleSave` の保存処理本体を `executeSave` 関数として切り出す
    - `setSaving`、`api.put`、`setSnackbar`、`fetchData`、`setEditedData`、`onUpdate` の処理を `executeSave` に移動する
    - _Requirements: 4.2_
  - [x] 5.2 `handleSave` に条件付きバリデーションロジックを追加する
    - `getValue('cw_request_email_site')` が truthy かつ `getValue('property_list_row_added')` が falsy の場合に `setRowAddWarningDialog({ open: true })` を呼び出して `return` する
    - 上記条件に該当しない場合は `executeSave()` を呼び出す
    - _Requirements: 3.1, 3.6, 3.7_

- [x] 6. チェックポイント - 全機能の動作を確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 7. ユニットテストとプロパティベーステストを作成する
  - [ ]* 7.1 フィールド配置・背景色・選択肢のユニットテストを作成する
    - 「物件一覧に行追加」が【図面作成依頼】セクション直下に存在し、【確認後処理】セクションに存在しないことを確認する
    - ラッパー `Box` に `bgcolor: '#fce4ec'` が適用されていることを確認する
    - 「追加済」「未」ボタンが存在し `property_list_row_added` フィールドに紐付いていることを確認する
    - 【確認後処理】セクションに配信日・物件ファイル・公開予定日・メール配信・サイト登録締め日vが存在することを確認する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_
  - [ ]* 7.2 POPUPメッセージ・ボタン・動作のユニットテストを作成する
    - POPUPに「物件一覧に行追加が未入力です。このまま保存しますか？」が表示されることを確認する
    - 「このまま保存」クリック後にAPIが呼ばれることを確認する
    - 「キャンセル」クリック後にAPIが呼ばれず、POPUPが閉じることを確認する
    - `isSiteDueDateRequired` ロジックが維持されていることを確認する
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.3_
  - [ ]* 7.3 Property 1: ラベル色の切り替えプロパティテストを作成する（fast-check使用）
    - **Property 1: ラベル色の切り替え**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - `cw_request_email_site` が非空（`'Y'`、`'N'`、任意の非空文字列）の場合、「物件一覧に行追加」ラベルの color が `error` であることを検証する
    - `cw_request_email_site` が空（`null`、`''`、`undefined`）の場合、ラベルの color が `text.secondary` であることを検証する
  - [ ]* 7.4 Property 2: 保存時のPOPUP表示条件プロパティテストを作成する（fast-check使用）
    - **Property 2: 保存時のPOPUP表示条件**
    - **Validates: Requirements 3.1, 3.6, 3.7**
    - `cw_request_email_site` が非空かつ `property_list_row_added` が空の場合のみ保存時にPOPUPが表示されることを検証する
    - `cw_request_email_site` が空の場合、保存時にPOPUPが表示されないことを検証する
    - `property_list_row_added` に値（`'追加済'`、`'未'`）がある場合、保存時にPOPUPが表示されないことを検証する

- [x] 8. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 変更対象ファイルは `frontend/frontend/src/components/WorkTaskDetailModal.tsx` のみ（バックエンド変更不要）
- プロパティベーステストには **fast-check** ライブラリを使用する
- 既存の `handleSave` のロジックは `executeSave` として維持し、バリデーション層のみ追加する
