# 実装計画: 売主通話モードページ「近隣買主」テーブルへの「名前非表示」ボタンと「PDF」ボタンの追加

## 概要

`NearbyBuyersList.tsx` コンポーネントのみを変更する純粋なフロントエンド実装。
バックエンドへの変更は不要。

## タスク

- [x] 1. `buildPrintContent` 純粋関数を実装する
  - `NearbyBuyersList.tsx` と同じディレクトリに `nearbyBuyersPrintUtils.ts` を作成する
  - `buildPrintContent(buyers, selectedBuyerNumbers, isNameHidden)` 関数を実装する
  - 選択行のみをフィルタリングし、会社情報ヘッダーを含む印刷用HTMLを生成する
  - `isNameHidden` が `true` の場合、名前セルに黒塗りスタイルを適用する
  - _Requirements: 2.3, 2.4, 2.5, 2.8_

  - [ ]* 1.1 プロパティテストを書く: 印刷対象の選択フィルタリング
    - **Property 3: 印刷対象の選択フィルタリング**
    - **Validates: Requirements 2.3, 2.4**
    - fast-check で任意の買主リストと任意の選択セット（1件以上）を生成し、選択行のみが含まれ非選択行が含まれないことを検証する

  - [ ]* 1.2 プロパティテストを書く: 印刷レイアウトの会社情報
    - **Property 4: 印刷レイアウトの会社情報**
    - **Validates: Requirements 2.5**
    - fast-check で任意の選択状態を生成し、印刷用コンテンツに「株式会社いふう」「大分市舞鶴町1-3-30 STビル１F」「097-533-2022」の3項目が全て含まれることを検証する

  - [ ]* 1.3 プロパティテストを書く: 名前非表示状態での印刷
    - **Property 5: 名前非表示状態での印刷**
    - **Validates: Requirements 2.8**
    - fast-check で任意の買主リストを生成し、`isNameHidden = true` のとき印刷用コンテンツの名前セルに黒塗りスタイルが適用されていることを検証する

- [x] 2. `NearbyBuyersList.tsx` に `isNameHidden` 状態とハンドラを追加する
  - `useState<boolean>(false)` で `isNameHidden` 状態を追加する
  - `handleToggleNameHidden` ハンドラを実装する（`setIsNameHidden(prev => !prev)`）
  - `handlePrint` ハンドラを実装する（0件選択時は Snackbar 警告を表示し `window.print()` を呼ばない）
  - `handlePrint` 内で `buildPrintContent` を呼び出し、印刷用スタイルと DOM を動的に挿入・クリーンアップする
  - `afterprint` イベントリスナーで印刷後のクリーンアップを実装する
  - _Requirements: 1.1, 1.4, 1.5, 2.2, 2.7, 2.9_

- [x] 3. テーブルヘッダーに「名前非表示」ボタンと「PDF」ボタンを追加する
  - 既存のアクションボタン行（`<Box sx={{ mb: 2, display: 'flex', gap: 1 }}>` 内）に2つのボタンを追加する
  - 「名前非表示」ボタン: `isNameHidden` が `true` のとき `variant="contained" color="warning"` でラベルを「名前表示」に変更する
  - 「PDF」ボタン: `variant="outlined"` で `handlePrint` を呼び出す
  - _Requirements: 1.1, 1.5, 2.1_

  - [ ]* 3.1 ユニットテストを書く: ボタンの初期レンダリングとラベル変化
    - 「名前非表示」ボタンが初期状態でレンダリングされること（要件 1.1）
    - 「PDF」ボタンが初期状態でレンダリングされること（要件 2.1）
    - 名前非表示ボタン押下後にラベルが「名前表示」に変わること（要件 1.5）
    - _Requirements: 1.1, 1.5, 2.1_

- [x] 4. 名前セルに条件付き黒塗りスタイルを適用する
  - 既存の名前セル `<Typography variant="body2">` に `isNameHidden` に基づく条件付き `sx` スタイルを適用する
  - `isNameHidden = true` のとき `backgroundColor: 'black', color: 'black', borderRadius: '2px', userSelect: 'none'` を適用する
  - 受付日の `<Typography variant="caption">` は変更しない
  - _Requirements: 1.2, 1.3_

  - [ ]* 4.1 プロパティテストを書く: 名前非表示状態の不変条件
    - **Property 1: 名前非表示状態の不変条件**
    - **Validates: Requirements 1.2, 1.3**
    - fast-check で任意の買主リストを生成し、名前非表示ボタンクリック後に全行の名前セルが黒塗りスタイルになり、かつ受付日が変わらず表示されることを検証する

  - [ ]* 4.2 プロパティテストを書く: 名前非表示トグルのラウンドトリップ
    - **Property 2: 名前非表示トグルのラウンドトリップ**
    - **Validates: Requirements 1.4**
    - fast-check で任意の買主リストを生成し、ボタン押下→非表示確認→再押下→元の表示に戻ることを検証する

- [x] 5. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 6. 印刷レイアウトの検証とクリーンアップ動作を確認する
  - 印刷レイアウトでチェックボックス列が非表示になることを確認する（要件 2.6）
  - `afterprint` イベント後に通常表示に戻ることを確認する（要件 2.9）
  - _Requirements: 2.6, 2.9_

  - [ ]* 6.1 ユニットテストを書く: PDF印刷フロー
    - `window.print` が呼ばれること（要件 2.2）
    - 0件選択状態でPDFボタンを押すと警告が表示され `window.print` が呼ばれないこと（要件 2.7）
    - `afterprint` イベント後に通常表示に戻ること（要件 2.9）
    - _Requirements: 2.2, 2.7, 2.9_

- [x] 7. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応が明確になっている
- `buildPrintContent` を純粋関数として切り出すことでプロパティベーステストが容易になる
- プロパティベーステストには **fast-check** を使用する（TypeScript/React プロジェクトに適合）
- 日本語を含むファイルの編集は Pythonスクリプト経由で UTF-8 書き込みを行うこと（エンコーディング保護ルール参照）
