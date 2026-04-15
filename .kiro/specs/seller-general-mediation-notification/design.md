# 設計ドキュメント

## 概要

本機能は以下の2点を実装する：

1. `situation_company` が「一般媒介」の場合に「専任（他決）決定日」フィールドをステータスセクションに表示する
2. `situation_company` が「一般媒介」の場合に「Google Chat通知」セクション内の既存「一般媒介通知」ボタンをオレンジ系で強調表示する

既存の `handleSendChatNotification('general_contract')` と `/api/chat-notifications/general-contract/:sellerId` エンドポイントはすでに実装済みのため、**バックエンドへの変更は不要**。フロントエンドの表示ロジックとバックエンドの `decryptSeller` マッピングのみ変更する。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/src/services/SellerService.supabase.ts` | `decryptSeller` に `situation_company` フィールドのマッピングを追加 |
| `frontend/frontend/src/types/index.ts` | `Seller` 型に `situation_company` が既に定義済み（変更不要） |
| `frontend/frontend/src/pages/SellerDetailPage.tsx` | ①「専任（他決）決定日」の条件表示、②「一般媒介通知」ボタンの条件付き強調スタイル |

---

## 詳細設計

### 1. バックエンド：`situation_company` フィールドのマッピング追加

**ファイル**: `backend/src/services/SellerService.supabase.ts`

`decryptSeller` メソッドの返却オブジェクトに `situation_company` を追加する。

```typescript
// 追加箇所（既存の currentStatus の近く）
situation_company: seller.situation_company,  // 状況（当社）
```

これにより、フロントエンドの `seller.situation_company` が正しく参照できるようになる。

### 2. フロントエンド：「専任（他決）決定日」の条件表示

**ファイル**: `frontend/frontend/src/pages/SellerDetailPage.tsx`

`situation_company === '一般媒介'` の場合のみ「専任（他決）決定日」フィールドを表示する。

表示場所は既存の `contractYearMonth` フィールドが編集されている箇所（ステータスセクション）。

```tsx
{seller.situation_company === '一般媒介' && (
  <Box sx={{ mb: 1 }}>
    <Typography variant="caption" color="text.secondary">
      専任（他決）決定日
    </Typography>
    <Typography variant="body2">
      {seller.contractYearMonth || '未設定'}
    </Typography>
  </Box>
)}
```

### 3. フロントエンド：「一般媒介通知」ボタンの条件付き強調スタイル

**ファイル**: `frontend/frontend/src/pages/SellerDetailPage.tsx`

`situation_company === '一般媒介'` の場合、既存の「一般媒介通知」ボタンに強調スタイルを適用する。

```tsx
<Button
  variant={seller.situation_company === '一般媒介' ? 'contained' : 'outlined'}
  onClick={() => handleSendChatNotification('general_contract')}
  disabled={sendingChatNotification}
  sx={seller.situation_company === '一般媒介' ? {
    backgroundColor: '#FF6D00',
    color: '#fff',
    fontWeight: 'bold',
    '&:hover': { backgroundColor: '#E65100' },
    '&:disabled': { backgroundColor: '#FFAB76', color: '#fff' },
  } : {}}
>
  一般媒介通知
</Button>
```

---

## データフロー

```
[DB: sellers.situation_company]
        ↓
[SellerService.decryptSeller()]  ← situation_company を追加マッピング
        ↓
[GET /api/sellers/:id レスポンス]
        ↓
[SellerDetailPage: seller.situation_company]
        ↓
  ┌─────────────────────────────────────────┐
  │ situation_company === '一般媒介' ?       │
  ├─────────────────────────────────────────┤
  │ YES → 「専任（他決）決定日」表示         │
  │ YES → 「一般媒介通知」ボタン強調表示     │
  │ NO  → 通常表示                          │
  └─────────────────────────────────────────┘
```

---

## 既存実装との関係

### 変更不要な既存実装

- `handleSendChatNotification('general_contract')` — 既存のまま使用
- `POST /api/chat-notifications/general-contract/:sellerId` — 既存のまま使用
- `ChatNotificationService.sendGeneralContractNotification()` — 既存のまま使用
- `Seller` 型の `situation_company?: string | null` — 既に定義済み

### 変更が必要な箇所

- `decryptSeller` の返却オブジェクトに `situation_company` が含まれていない → 追加が必要
- `SellerDetailPage` の「一般媒介通知」ボタンに条件付きスタイルがない → 追加が必要
- `SellerDetailPage` に「専任（他決）決定日」の条件表示がない → 追加が必要

---

## UI仕様

### 「一般媒介通知」ボタンの強調スタイル

| 状態 | スタイル |
|------|---------|
| `situation_company !== '一般媒介'` | `variant="outlined"` （既存のまま） |
| `situation_company === '一般媒介'` | `variant="contained"`, 背景色 `#FF6D00`（オレンジ）, 白文字, 太字 |
| 送信中（disabled） | 背景色 `#FFAB76`（薄いオレンジ） |

### 「専任（他決）決定日」フィールド

- 表示条件: `seller.situation_company === '一般媒介'`
- 表示値: `seller.contractYearMonth`（null/空の場合は「未設定」）
- 表示場所: ステータスセクション内（既存の `contractYearMonth` 編集フィールドの近く）

---

## 正確性プロパティ

### テスト方針

本機能は純粋なUI条件分岐であり、以下の方針でテストする：

1. `situation_company === '一般媒介'` の場合にボタンが強調スタイルになること（例示テスト）
2. `situation_company !== '一般媒介'` の場合にボタンが通常スタイルになること（例示テスト）
3. `situation_company === '一般媒介'` の場合に「専任（他決）決定日」が表示されること（例示テスト）
4. `situation_company !== '一般媒介'` の場合に「専任（他決）決定日」が非表示になること（例示テスト）
5. ボタン押下時に `handleSendChatNotification('general_contract')` が呼ばれること（例示テスト）

プロパティベーステストは不要（外部サービス呼び出しを含み、UIの条件分岐は入力値の変動で追加バグを発見しにくい）。
