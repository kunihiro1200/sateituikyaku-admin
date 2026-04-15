# 要件定義書

## はじめに

物件リスト詳細画面（`PropertyListingDetailPage`）には、「事務CHAT」送信時に「確認」フィールドを自動で"未"にリセットする機能がすでに存在する。

今回の新機能として、`PriceSection` コンポーネント内の「売買価格」フィールドを変更して「Chat送信」ボタンを押した際にも、同様に「確認」フィールドを"未"にリセットする。

### 既存の動作（参考）

- `handleSendChatToOffice`（事務CHAT送信）実行時：
  - `setConfirmation('未')` でローカルステートを更新
  - `api.put(/.../confirmation, { confirmation: '未' })` でDBを更新
  - `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', ...))` でサイドバーに通知

### 今回追加する動作

- `PriceSection` の「Chat送信」ボタン（`handleSendPriceReductionChat`）実行成功時：
  - 上記と同様に「確認」フィールドを"未"にリセットする

---

## 用語集

- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **PriceSection**: 売買価格・値下げ履歴を表示するコンポーネント（`frontend/frontend/src/components/PriceSection.tsx`）
- **確認フィールド（confirmation）**: 物件リストの確認状態を示すフィールド。値は `'未'` または `'済'`
- **Chat送信ボタン**: `PriceSection` 内の値下げ通知をGoogle Chatに送信するボタン
- **事務CHAT**: `PropertyListingDetailPage` 内の事務担当者へのCHAT送信機能

---

## 要件

### 要件1：Chat送信成功時の確認フィールド自動リセット

**ユーザーストーリー：** 担当者として、売買価格を変更してChat送信ボタンを押した際に、確認フィールドが自動で"未"になってほしい。これにより、事務担当者が変更内容を確認すべき状態であることが明示される。

#### 受け入れ基準

1. WHEN `PriceSection` の「Chat送信」ボタンが押されてGoogle Chatへの送信が成功した場合、THE `PropertyListingDetailPage` SHALL `confirmation` フィールドのローカルステートを `'未'` に更新する

2. WHEN `PriceSection` の「Chat送信」が成功した場合、THE `PropertyListingDetailPage` SHALL バックエンドAPI（`PUT /api/property-listings/:propertyNumber/confirmation`）を呼び出して `confirmation` を `'未'` に保存する

3. WHEN `PriceSection` の「Chat送信」が成功した場合、THE `PropertyListingDetailPage` SHALL `propertyConfirmationUpdated` カスタムイベントを `window` に発火してサイドバーの未完了カウントを即座に更新する

4. IF `PriceSection` の「Chat送信」が失敗した場合、THEN THE `PropertyListingDetailPage` SHALL `confirmation` フィールドを変更しない

5. THE `PriceSection` SHALL `onChatSendSuccess` コールバックを通じて Chat送信成功を `PropertyListingDetailPage` に通知する（既存の仕組みを活用）

### 要件2：コールバック拡張による疎結合設計

**ユーザーストーリー：** 開発者として、`PriceSection` コンポーネントが `PropertyListingDetailPage` の内部状態に直接依存しない設計を維持したい。これにより、コンポーネントの再利用性と保守性が保たれる。

#### 受け入れ基準

1. THE `PriceSection` SHALL `onChatSendSuccess` コールバックの呼び出しのみで Chat送信成功を通知し、`confirmation` の更新処理は `PropertyListingDetailPage` 側で行う

2. THE `PropertyListingDetailPage` SHALL `onChatSendSuccess` コールバックの実装内で、既存の `handleSendChatToOffice` と同等の確認フィールドリセット処理（ローカルステート更新・API呼び出し・イベント発火）を実行する

3. WHERE 既存の `onChatSendSuccess` コールバックが `setSnackbar` のみを呼び出している場合、THE `PropertyListingDetailPage` SHALL 確認フィールドリセット処理を追加する形で拡張する
