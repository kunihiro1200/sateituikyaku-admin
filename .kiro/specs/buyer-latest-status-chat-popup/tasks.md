# 実装計画：buyer-latest-status-chat-popup

## 概要

買主詳細ページの「★最新状況」フィールドで"買"を含む選択肢が保存された際に、Chat送信を促すモーダルポップアップを表示する機能を実装する。変更はフロントエンドのみ（`frontend/frontend/src/`）。

## タスク

- [x] 1. `ChatNavigationPopup` コンポーネントの新規作成
  - `frontend/frontend/src/components/ChatNavigationPopup.tsx` を新規作成する
  - MUI の `Dialog`, `DialogContent`, `DialogActions`, `Button` を使用する
  - Props: `open: boolean`, `onNavigate: () => void`, `onClose: () => void`
  - メッセージ「Chat送信のため　内覧ページに飛んでください」を表示する
  - 「内覧ページ」ボタン: `variant="contained"` / `color="primary"`（推奨・強調）
  - 「ここにとどまる」ボタン: `variant="outlined"` / `color="inherit"`（控えめ）
  - _要件: 1.1, 1.2, 1.3, 1.4, 2.3_

- [x] 2. `BuyerDetailPage` への `isBuyingStatus` 関数と状態管理の追加
  - [x] 2.1 `isBuyingStatus` 判定関数の実装
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` に `isBuyingStatus` 関数を追加する
    - `value.includes('買')` で判定するシンプルな純粋関数として実装する
    - _要件: 3.1, 3.2, 3.3_

  - [ ]* 2.2 `isBuyingStatus` のプロパティベーステストを作成する
    - **プロパティ1: BuyingStatus判定の正確性**
    - `fast-check` の `fc.string()` で任意文字列を生成し、`"買"` を含む場合は `true`、含まない場合は `false` を検証する
    - 最低100回実行する
    - **Validates: 要件3.1, 3.2, 3.3**

  - [x] 2.3 `chatPopupOpen` 状態変数の追加
    - `const [chatPopupOpen, setChatPopupOpen] = useState(false);` を追加する
    - _要件: 1.1_

  - [x] 2.4 `latest_status` フィールドの `handleFieldSave` にポップアップ表示ロジックを追加する
    - `handleInlineFieldSave` 呼び出し後に `isBuyingStatus` チェックを追加する
    - `newValue && isBuyingStatus(String(newValue))` が真の場合に `setChatPopupOpen(true)` を呼ぶ
    - _要件: 1.1, 1.5, 3.1, 3.2_

  - [ ]* 2.5 ポップアップ表示条件のプロパティベーステストを作成する
    - **プロパティ2: ナビゲーション先の正確性**
    - 任意の `buyer_number` に対して、「内覧ページ」ボタン押下時のナビゲーション先が必ず `/buyers/{buyer_number}/viewing-result` となることを検証する
    - **Validates: 要件2.1**

- [x] 3. `BuyerDetailPage` へのナビゲーションハンドラーと `ChatNavigationPopup` の組み込み
  - `handleChatNavigate` 関数を追加する（`setChatPopupOpen(false)` → `navigate(\`/buyers/${buyer_number}/viewing-result\`)` の順で実行）
  - `ChatNavigationPopup` コンポーネントを `BuyerDetailPage` の JSX に追加する
  - Props: `open={chatPopupOpen}`, `onNavigate={handleChatNavigate}`, `onClose={() => setChatPopupOpen(false)}`
  - _要件: 1.1, 2.1, 2.2, 2.3_

- [x] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- 日本語を含むファイルの編集は Pythonスクリプト経由で UTF-8 書き込みを行うこと（`file-encoding-protection.md` 参照）
- バックエンド変更は不要（フロントエンドのみ）
