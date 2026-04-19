# 実装計画：viewing-result-chat-sent-popup

## 概要

内覧ページ（`BuyerViewingResultPage`）の「買付ハズレチャット送信」ボタン押下後、Chat送信APIが成功した際に、担当者へ「★最新状況」の更新を促すリマインダーポップアップ（`OfferFailedChatSentPopup`）を表示する機能を実装する。変更はフロントエンドのみ（`frontend/frontend/src/`）。

## タスク

- [x] 1. `OfferFailedChatSentPopup` コンポーネントの新規作成
  - `frontend/frontend/src/components/OfferFailedChatSentPopup.tsx` を新規作成する
  - MUI の `Dialog`, `DialogContent`, `DialogActions`, `Button` を使用する
  - Props: `open: boolean`, `onOk: () => void`
  - メッセージ「正確な★最新状況を入力してください。注意！！ 『買付外れました』以外です！！」を表示する
  - 「OK」ボタン: `variant="contained"` / `color="primary"`（1つのみ）
  - `ChatNavigationPopup.tsx` と同様のパターンで実装する
  - _要件: 1.1, 1.2, 1.3_

- [-] 2. `BuyerViewingResultPage` への状態管理とロジックの追加
  - [x] 2.1 `offerFailedChatSentPopupOpen` 状態変数の追加
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` に `const [offerFailedChatSentPopupOpen, setOfferFailedChatSentPopupOpen] = useState(false);` を追加する
    - _要件: 1.1_

  - [x] 2.2 `handleOfferChatSend` の API成功時ロジックを修正する
    - 既存の `handleOfferChatSend` 関数内、`response.data.success` が `true` の分岐に `isOfferFailed()` 判定を追加する
    - `isOfferFailed()` が `true` の場合: `setOfferFailedChatSentPopupOpen(true)` を呼ぶ
    - `isOfferFailed()` が `false` の場合: 既存のスナックバー成功表示のみ（変更なし）
    - API失敗時はポップアップを表示しない（既存の `.catch` 処理は変更なし）
    - _要件: 1.1, 1.4, 1.5_

  - [ ]* 2.3 ポップアップ表示条件のプロパティベーステストを作成する
    - **プロパティ1: API成功時のポップアップ表示条件**
    - `fast-check` の `fc.string()` で任意の買主番号・物件番号を生成し、`isOfferFailed()` が `true` かつ API成功の場合のみ `offerFailedChatSentPopupOpen` が `true` になることを検証する
    - 最低100回実行する
    - **Validates: 要件1.1, 1.4, 1.5**

- [x] 3. `BuyerViewingResultPage` へのナビゲーションハンドラーと `OfferFailedChatSentPopup` の組み込み
  - `handleOfferFailedChatSentPopupOk` 関数を追加する（`setOfferFailedChatSentPopupOpen(false)` → `navigate(\`/buyers/${buyer_number}\`)` の順で実行）
  - `OfferFailedChatSentPopup` コンポーネントを `BuyerViewingResultPage` の JSX に追加する（既存の `<Dialog>` や `<Snackbar>` と並べて配置）
  - Props: `open={offerFailedChatSentPopupOpen}`, `onOk={handleOfferFailedChatSentPopupOk}`
  - _要件: 2.1, 2.2, 2.3_

  - [ ]* 3.1 ナビゲーション先のプロパティベーステストを作成する
    - **プロパティ2: OKボタン押下時のナビゲーション先**
    - `fast-check` の `fc.string()` で任意の `buyer_number` を生成し、OKボタン押下時のナビゲーション先が必ず `/buyers/{buyer_number}` となることを検証する
    - 最低100回実行する
    - **Validates: 要件2.1, 2.2**

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- 日本語を含むファイルの編集は Pythonスクリプト経由で UTF-8 書き込みを行うこと（`file-encoding-protection.md` 参照）
- バックエンド変更は不要（フロントエンドのみ）
