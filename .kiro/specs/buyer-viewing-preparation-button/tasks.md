# 実装計画：内覧準備ボタン（buyer-viewing-preparation-button）

## 概要

買主詳細画面（`/buyers/:buyer_number`）のヘッダーに「内覧準備」ボタンを追加し、クリック時にMUI Dialogで買主番号・物件番号のコピー機能と固定リンク2件を表示するポップアップを実装する。
フロントエンドのみの変更（TypeScript + React + MUI）。

## タスク

- [x] 1. ViewingPreparationPopup コンポーネントの作成
  - `frontend/frontend/src/components/ViewingPreparationPopup.tsx` を新規作成する
  - `ViewingPreparationPopupProps`（`open`, `onClose`, `buyerNumber`, `propertyNumber`）インターフェースを定義する
  - MUI `Dialog`（`maxWidth="sm"` / `fullWidth`）を使用してポップアップを実装する
  - `DialogTitle` に「内覧準備資料」を表示する
  - タイトル直下に「※準備前にカレンダーに●をつけてください」を赤色・太字で表示する
  - 買主番号コピーエリアを実装する（`ContentCopyIcon` 付き、コピー後 `CheckIcon` に変化、1500ms後に元に戻る）
  - 物件番号コピーエリアを実装する（`ContentCopyIcon` 付き、コピー後 `CheckIcon` に変化、1500ms後に元に戻る）
  - `buyerNumber` / `propertyNumber` が `null` / `undefined` / 空文字の場合は「（未設定）」を表示しコピーボタンを非表示にする
  - `navigator.clipboard` が使用不可の場合は `document.execCommand('copy')` にフォールバックする
  - `FIXED_LINKS` 定数（スプシの資料・ATBB）を定義し番号付きリストで表示する
  - スプシの資料リンク URL: `https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=195766785#gid=195766785`
  - ATBBリンクに「①詳細ページと②地図③インフォシートを印刷」というラベルを付ける
  - ATBBリンク URL: `https://atbb.athome.jp/`
  - 全ての外部リンクに `target="_blank"` と `rel="noopener noreferrer"` を設定する
  - 閉じるボタンとダイアログ外クリックで `onClose` を呼び出す
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 1.1 プロパティテスト：コピー可能な値の表示（Property 1）
    - **Property 1: コピー可能な値の表示**
    - fast-check で任意の非空文字列 `buyerNumber` と `propertyNumber` を生成し、「買主番号」「物件番号」ラベルとともに値が表示されることを検証する
    - **Validates: Requirements 3.1, 4.1**

  - [ ]* 1.2 プロパティテスト：クリップボードへのコピー（Property 2）
    - **Property 2: クリップボードへのコピー**
    - fast-check で任意の非空文字列 `buyerNumber` / `propertyNumber` を生成し、対応するコピーエリアをクリックすると `navigator.clipboard.writeText` がその値で呼び出されることを検証する
    - **Validates: Requirements 3.2, 4.2**

  - [ ]* 1.3 プロパティテスト：外部リンクのセキュリティ属性（Property 3）
    - **Property 3: 外部リンクのセキュリティ属性**
    - fast-check で任意の `buyerNumber`（null含む）と `propertyNumber`（null含む）を生成し、`target="_blank"` を持つ全アンカー要素に `rel="noopener noreferrer"` が設定されていることを検証する
    - **Validates: Requirements 5.3, 6.3**

  - [ ]* 1.4 ユニットテスト：ViewingPreparationPopup の表示ロジック
    - `buyerNumber` あり → 値が表示される
    - `buyerNumber` なし（null/undefined）→ 「（未設定）」が表示される
    - `propertyNumber` あり → 値が表示される
    - `propertyNumber` なし（null/undefined）→ 「（未設定）」が表示される
    - タイトルに「内覧準備資料」が表示される
    - 注意書きが表示される
    - スプシの資料リンクが表示される
    - ATBBリンクが表示される
    - コピー成功後にアイコンが変化する
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.4, 4.1, 4.5, 5.1, 6.1_

- [x] 2. ViewingPreparationButton コンポーネントの作成
  - `frontend/frontend/src/components/ViewingPreparationButton.tsx` を新規作成する
  - `ViewingPreparationButtonProps`（`buyerNumber`, `propertyNumber`）インターフェースを定義する
  - MUI `Button`（`variant="outlined"`, `size="small"`）を使用して「内覧準備」ボタンを実装する
  - `open` 状態を内部で管理し、ボタンクリックで `true`、`onClose` で `false` にする
  - `ViewingPreparationPopup` をインポートして `open`, `onClose`, `buyerNumber`, `propertyNumber` を渡す
  - _Requirements: 1.2, 1.3, 2.1_

  - [ ]* 2.1 ユニットテスト：ViewingPreparationButton の開閉動作
    - ボタンクリック → ダイアログが開く
    - 閉じるボタンクリック → ダイアログが閉じる
    - _Requirements: 1.2, 2.1, 2.5_

- [x] 3. BuyerDetailPage.tsx への組み込み
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を編集する
  - `ViewingPreparationButton` をインポートする
  - 「近隣物件」ボタンの左側に `<ViewingPreparationButton buyerNumber={buyer?.buyer_number} propertyNumber={linkedProperties[0]?.property_number} />` を追加する
  - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 3.1 インテグレーションテスト：BuyerDetailPage への組み込み確認
    - `BuyerDetailPage` に `ViewingPreparationButton` が表示される
    - `linkedProperties[0]?.property_number` が正しく `ViewingPreparationButton` に渡される
    - _Requirements: 1.1_

- [x] 4. 最終チェックポイント
  - 全てのテストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは前のタスクの成果物を前提として構築される
- プロパティテストには fast-check（TypeScript向け）を使用し、最低100回のイテレーションで実行する
- 外部リンクの `rel="noopener noreferrer"` はセキュリティ上必須
- 売主版（`VisitPreparationButton` / `VisitPreparationPopup`）を参考に実装する
