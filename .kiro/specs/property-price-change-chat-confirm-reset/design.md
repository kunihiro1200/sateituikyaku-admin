# 設計書：PriceSection Chat送信時の確認フィールド自動リセット

## Overview

`PropertyListingDetailPage` の `PriceSection` コンポーネントにある「Chat送信」ボタン（`handleSendPriceReductionChat`）が成功した際に、既存の「事務CHAT送信」と同様に「確認」フィールドを `'未'` にリセットする機能を追加する。

### 背景

現在、`handleSendChatToOffice`（事務CHAT送信）では送信成功時に以下の3つの処理を行っている：

1. `setConfirmation('未')` でローカルステートを更新
2. `api.put(/.../confirmation, { confirmation: '未' })` でDBを更新
3. `window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', ...))` でサイドバーに通知

`PriceSection` の Chat送信成功時にも同等の処理を追加する。

---

## Architecture

### 変更方針

`PriceSection` は `PropertyListingDetailPage` の内部状態（`confirmation`）に直接依存しない設計を維持する。既存の `onChatSendSuccess` コールバックを拡張することで、疎結合を保ちながら機能を追加する。

```
PriceSection
  └─ handleSendPriceReductionChat() 成功
       └─ onChatSendSuccess(message) を呼び出す
            └─ PropertyListingDetailPage の handlePriceChatSendSuccess()
                 ├─ setSnackbar(...)          // 既存処理
                 ├─ setConfirmation('未')     // 追加
                 ├─ api.put(.../confirmation) // 追加
                 └─ window.dispatchEvent(...) // 追加
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` | `onChatSendSuccess` コールバックを拡張して確認フィールドリセット処理を追加 |
| `frontend/frontend/src/components/PriceSection.tsx` | 変更なし（既存の `onChatSendSuccess` 呼び出しをそのまま活用） |

---

## Components and Interfaces

### PriceSection（変更なし）

既存の `onChatSendSuccess: (message: string) => void` インターフェースをそのまま使用する。`PriceSection` 側のコードは変更不要。

### PropertyListingDetailPage（変更あり）

`PriceSection` に渡している `onChatSendSuccess` コールバックを、インライン関数から名前付きハンドラー関数に切り出して拡張する。

**変更前：**
```tsx
onChatSendSuccess={(message) => setSnackbar({ open: true, message, severity: 'success' })}
```

**変更後：**
```tsx
onChatSendSuccess={handlePriceChatSendSuccess}
```

**追加するハンドラー関数：**
```tsx
const handlePriceChatSendSuccess = async (message: string) => {
  // スナックバー表示（既存処理）
  setSnackbar({ open: true, message, severity: 'success' });

  // 確認フィールドを「未」にリセット（追加処理）
  setConfirmation('未');

  // DBを更新
  try {
    await api.put(`/api/property-listings/${propertyNumber}/confirmation`, { confirmation: '未' });
  } catch (error) {
    console.error('[PropertyListingDetailPage] 確認フィールドの更新に失敗しました:', error);
  }

  // キャッシュをクリア
  pageDataCache.invalidate(CACHE_KEYS.PROPERTY_LISTINGS);
  sessionStorage.setItem('propertyListingsNeedsRefresh', 'true');

  // サイドバーに即座に通知
  window.dispatchEvent(new CustomEvent('propertyConfirmationUpdated', {
    detail: { propertyNumber, confirmation: '未' }
  }));
};
```

---

## Data Models

変更なし。既存の `confirmation: '未' | '済' | null` フィールドをそのまま使用する。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Chat送信成功時の確認フィールドリセット

*For any* 初期の `confirmation` 状態（`null`、`'済'`、`'未'` のいずれか）において、`onChatSendSuccess` コールバックが呼び出された後、`confirmation` ステートは必ず `'未'` になる。

**Validates: Requirements 1.1**

### Property 2: Chat送信失敗時の確認フィールド不変

*For any* 初期の `confirmation` 状態において、`handleSendPriceReductionChat` がエラーをスローした場合、`confirmation` ステートは変化しない。

**Validates: Requirements 1.4**

### Property 3: 確認フィールドリセット時のイベント発火

*For any* 物件番号において、`onChatSendSuccess` コールバックが呼び出された後、`propertyConfirmationUpdated` カスタムイベントが `{ propertyNumber, confirmation: '未' }` の `detail` を持って `window` に発火される。

**Validates: Requirements 1.3**

---

## Error Handling

| エラーケース | 対応 |
|------------|------|
| Google Chat への送信失敗 | `PriceSection` 内で `onChatSendError` を呼び出す。`confirmation` は変更しない（要件 1.4） |
| `api.put(.../confirmation)` の失敗 | コンソールにエラーを出力する。ローカルステートは既に `'未'` に更新済みのため、ユーザー体験への影響を最小化する。スナックバーでのエラー通知は行わない（Chat送信自体は成功しているため） |

---

## Testing Strategy

### ユニットテスト（例ベース）

- `handlePriceChatSendSuccess` が呼ばれた後、`confirmation` ステートが `'未'` になること
- `handlePriceChatSendSuccess` が呼ばれた後、`api.put` が正しいエンドポイントとパラメータで呼ばれること
- `handlePriceChatSendSuccess` が呼ばれた後、`propertyConfirmationUpdated` イベントが発火されること
- Chat送信失敗時（`onChatSendError` 呼び出し時）に `confirmation` が変化しないこと

### プロパティベーステスト

`fast-check` を使用して以下のプロパティを検証する（最低100回実行）：

**Property 1: Chat送信成功時の確認フィールドリセット**
```
// Feature: property-price-change-chat-confirm-reset, Property 1: Chat送信成功時の確認フィールドリセット
fc.property(
  fc.constantFrom(null, '未', '済'),
  async (initialConfirmation) => {
    // 任意の初期confirmation状態でonChatSendSuccessを呼び出す
    // → confirmationが'未'になることを検証
  }
)
```

**Property 2: Chat送信失敗時の確認フィールド不変**
```
// Feature: property-price-change-chat-confirm-reset, Property 2: Chat送信失敗時の確認フィールド不変
fc.property(
  fc.constantFrom(null, '未', '済'),
  async (initialConfirmation) => {
    // 任意の初期confirmation状態でChat送信が失敗する
    // → confirmationが変化しないことを検証
  }
)
```

**Property 3: 確認フィールドリセット時のイベント発火**
```
// Feature: property-price-change-chat-confirm-reset, Property 3: 確認フィールドリセット時のイベント発火
fc.property(
  fc.string({ minLength: 1 }),
  async (propertyNumber) => {
    // 任意の物件番号でonChatSendSuccessを呼び出す
    // → propertyConfirmationUpdatedイベントが正しいdetailで発火されることを検証
  }
)
```

### 統合テスト

- `api.put(.../confirmation)` が実際のバックエンドに対して正しく動作すること（1-2例）
