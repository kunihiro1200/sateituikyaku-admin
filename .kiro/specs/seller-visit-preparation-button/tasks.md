# 実装計画：訪問準備ボタン（seller-visit-preparation-button）

## 概要

通話モードページのヘッダーに「訪問準備」ボタンを追加し、クリック時にMUI Dialogで6種類のリソースリンクを表示するポップアップを実装する。
フロントエンドのみの変更（TypeScript + React + MUI）。

## タスク

- [x] 1. VisitPreparationPopup コンポーネントの作成
  - `frontend/frontend/src/components/VisitPreparationPopup.tsx` を新規作成する
  - `VisitPreparationPopupProps`（`open`, `onClose`, `sellerId`, `inquiryUrl`）インターフェースを定義する
  - MUI `Dialog` を使用してポップアップを実装する
  - ポップアップ先頭に「＊準備前に必ずカレンダーに●つけてください！！」を赤色・太字で表示する
  - `FIXED_LINKS` 定数（添付資料・ぜんりん・謄本・成約事例）を定義し、番号付きリストで表示する
  - 「査定書」項目：`inquiryUrl` が存在する場合はリンク、存在しない場合は「（リンクなし）」を表示する
  - 「近隣買主」項目：`sellerId` が存在する場合は `/sellers/${sellerId}/nearby-buyers` へのリンク、存在しない場合は「（リンクなし）」を表示する
  - 表示順序：添付資料 → ぜんりん → 謄本 → 査定書 → 成約事例 → 近隣買主
  - 全ての外部リンクに `target="_blank"` と `rel="noopener noreferrer"` を設定する
  - 近隣買主リンクに `target="_blank"` を設定する
  - 閉じるボタンとダイアログ外クリックで `onClose` を呼び出す
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [ ]* 1.1 プロパティテスト：外部リンクのセキュリティ属性（Property 1）
    - **Property 1: 外部リンクのセキュリティ属性**
    - fast-check で任意の `inquiryUrl`（null含む）と `sellerId`（undefined含む）を生成し、`target="_blank"` を持つ全アンカー要素に `rel="noopener noreferrer"` が設定されていることを検証する
    - **Validates: Requirements 3.5, 4.3**

  - [ ]* 1.2 プロパティテスト：近隣買主URLの動的生成（Property 2）
    - **Property 2: 近隣買主URLの動的生成**
    - fast-check で任意の非空文字列 `sellerId` を生成し、近隣買主リンクの `href` が `/sellers/${sellerId}/nearby-buyers` の形式であることを検証する
    - **Validates: Requirements 5.1**

  - [ ]* 1.3 ユニットテスト：VisitPreparationPopup の表示ロジック
    - `inquiryUrl` あり → 「査定書」リンクが表示される
    - `inquiryUrl` なし（null/空文字）→ 「（リンクなし）」が表示される
    - `sellerId` あり → 「近隣買主」リンクが表示される
    - `sellerId` なし → 「（リンクなし）」が表示される
    - 6項目全てが表示される
    - 注意メッセージが表示される
    - _Requirements: 2.2, 2.3, 2.4, 4.1, 4.2, 5.1, 5.3_

- [x] 2. VisitPreparationButton コンポーネントの作成
  - `frontend/frontend/src/components/VisitPreparationButton.tsx` を新規作成する
  - `VisitPreparationButtonProps`（`sellerId`, `inquiryUrl`）インターフェースを定義する
  - MUI `Button`（`variant="outlined"`, `size="small"`）を使用して「訪問準備」ボタンを実装する
  - `open` 状態を内部で管理し、ボタンクリックで `true`、`onClose` で `false` にする
  - `VisitPreparationPopup` をインポートして `open`, `onClose`, `sellerId`, `inquiryUrl` を渡す
  - _Requirements: 1.3, 1.4, 2.1_

  - [ ]* 2.1 ユニットテスト：VisitPreparationButton の開閉動作
    - ボタンクリック → ダイアログが開く
    - 閉じるボタンクリック → ダイアログが閉じる
    - _Requirements: 2.1, 2.5_

- [x] 3. CallModePage.tsx への組み込み
  - `frontend/frontend/src/pages/CallModePage.tsx` を編集する
  - `VisitPreparationButton` をインポートする
  - `seller?.phoneNumber` が存在する条件ブロック内の「画像」ボタンの左側に `<VisitPreparationButton sellerId={seller?.id} inquiryUrl={inquiryUrl} />` を追加する
  - _Requirements: 1.1, 1.2_

  - [ ]* 3.1 インテグレーションテスト：CallModePage への組み込み確認
    - `seller?.phoneNumber` がある場合に `VisitPreparationButton` が表示される
    - `seller?.phoneNumber` がない場合に `VisitPreparationButton` が表示されない
    - _Requirements: 1.1, 1.2_

- [x] 4. 最終チェックポイント
  - 全てのテストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは前のタスクの成果物を前提として構築される
- プロパティテストには fast-check（TypeScript向け）を使用し、最低100回のイテレーションで実行する
- 外部リンクの `rel="noopener noreferrer"` はセキュリティ上必須
