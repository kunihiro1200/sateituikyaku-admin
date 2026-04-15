# 実装計画：PriceSection Chat送信時の確認フィールド自動リセット

## 概要

`PropertyListingDetailPage.tsx` の `onChatSendSuccess` インラインコールバックを `handlePriceChatSendSuccess` に切り出し、確認フィールドのリセット処理（ローカルステート更新・API呼び出し・イベント発火）を追加する。

## タスク

- [x] 1. handlePriceChatSendSuccess ハンドラーを実装して PriceSection に接続する
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` を編集する
  - 既存のインラインコールバック `(message) => setSnackbar(...)` を `handlePriceChatSendSuccess` に切り出す
  - ハンドラー内に `setConfirmation('未')` を追加する（要件 1.1）
  - ハンドラー内に `api.put('/api/property-listings/:propertyNumber/confirmation', { confirmation: '未' })` を追加する（要件 1.2）
  - ハンドラー内に `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', ...))` を追加する（要件 1.3）
  - `pageDataCache.invalidate` と `sessionStorage.setItem('propertyListingsNeedsRefresh', 'true')` も追加する
  - `PriceSection` の `onChatSendSuccess` prop に `handlePriceChatSendSuccess` を渡す（要件 2.1, 2.2, 2.3）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [ ]* 1.1 Property 1 のプロパティテストを作成する
    - **Property 1: Chat送信成功時の確認フィールドリセット**
    - `fc.constantFrom(null, '未', '済')` で任意の初期 `confirmation` 状態から `onChatSendSuccess` を呼び出した後、`confirmation` が `'未'` になることを検証する
    - **Validates: Requirements 1.1**

  - [ ]* 1.2 Property 2 のプロパティテストを作成する
    - **Property 2: Chat送信失敗時の確認フィールド不変**
    - `fc.constantFrom(null, '未', '済')` で任意の初期 `confirmation` 状態で Chat送信が失敗した場合、`confirmation` が変化しないことを検証する
    - **Validates: Requirements 1.4**

  - [ ]* 1.3 Property 3 のプロパティテストを作成する
    - **Property 3: 確認フィールドリセット時のイベント発火**
    - `fc.string({ minLength: 1 })` で任意の物件番号に対して `onChatSendSuccess` を呼び出した後、`propertyConfirmationUpdated` イベントが `{ propertyNumber, confirmation: '未' }` の `detail` を持って発火されることを検証する
    - **Validates: Requirements 1.3**

  - [ ]* 1.4 ユニットテストを作成する
    - `handlePriceChatSendSuccess` 呼び出し後に `api.put` が正しいエンドポイントとパラメータで呼ばれることを検証する
    - Chat送信失敗時（`onChatSendError` 呼び出し時）に `confirmation` が変化しないことを検証する
    - _Requirements: 1.2, 1.4_

- [x] 2. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- 変更対象ファイルは `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` のみ
- `PriceSection.tsx` は変更不要（既存の `onChatSendSuccess` 呼び出しをそのまま活用）
- プロパティテストには `fast-check` を使用する
