# 設計書: 物件リスト買付情報修正・機能追加

## 概要

物件リスト詳細画面（PropertyListingDetailPage）の買付情報セクションに関する4件の修正・機能追加を行う。

1. **バグ修正**: 買付情報全空欄保存時の500エラー（空文字列→null変換）
2. **機能追加**: 買付金額入力時の必須バリデーション＋全空欄保存時のバッジ消去
3. **機能追加**: 買付日フィールドのクリック領域拡大（カレンダー即時表示）
4. **機能追加**: 買付情報保存成功時のGoogle Chat Webhook通知（非同期）

## アーキテクチャ

```
フロントエンド (frontend/frontend/src/)
  └── pages/PropertyListingDetailPage.tsx
        ├── バリデーション処理（offer_amount起点）
        ├── 買付日フィールドのクリックハンドラ
        └── handleSaveOffer（保存後にバッジ状態を更新）

バックエンド (backend/src/)
  ├── routes/propertyListings.ts
  │     └── PUT /:propertyNumber
  │           ├── 空文字列→null変換
  │           └── 保存成功後に非同期でGoogle Chat通知
  └── services/PropertyListingService.ts
        └── update() メソッド（変換済みデータをDBに保存）
```

## コンポーネントとインターフェース

### バックエンド

#### PUT /api/property-listings/:propertyNumber の変更

現在の実装（`backend/src/routes/propertyListings.ts`）:
```typescript
router.put('/:propertyNumber', async (req, res) => {
  const updates = req.body;
  const data = await propertyListingService.update(propertyNumber, updates);
  res.json(data);
});
```

変更後:
- `updates` 内の買付フィールド（`offer_date`, `offer_status`, `offer_comment`, `offer_amount`）の空文字列を `null` に変換してから `update()` を呼び出す
- 保存成功後、`notifyGoogleChat()` を非同期で呼び出す（`await` しない）

#### Google Chat 通知関数

`backend/src/routes/propertyListings.ts` 内に追加するヘルパー関数:

```typescript
async function notifyGoogleChatOfferSaved(propertyNumber: string, offerData: {
  offer_date?: string | null;
  offer_status?: string | null;
  offer_comment?: string | null;
  offer_amount?: string | null;
}): Promise<void>
```

- Webhook URL: `https://chat.googleapis.com/v1/spaces/AAAA6iEDkiU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=azlyf21pENCpLLUdJPjnRNXOzsIAP550xebOMVxYRMQ`
- メッセージ形式: `{ text: "..." }` （Google Chat Simple Text形式）
- 失敗時: `console.error` でログ記録のみ、例外を外部に伝播させない

### フロントエンド

#### バリデーション状態

`PropertyListingDetailPage` に追加するstate:

```typescript
const [offerErrors, setOfferErrors] = useState<{
  offer_date?: string;
  offer_status?: string;
  offer_comment?: string;
}>({});
```

#### バリデーション関数

```typescript
function validateOfferFields(editedData: Record<string, any>, currentData: PropertyListing): {
  offer_date?: string;
  offer_status?: string;
  offer_comment?: string;
} | null
```

- `offer_amount` が空欄（空文字列・null・undefined）の場合: `null` を返す（エラーなし）
- `offer_amount` に値がある場合: `offer_date`・`offer_status`・`offer_comment` の未入力フィールドに `"必須項目です"` を設定して返す

#### handleSaveOffer の変更

```typescript
const handleSaveOffer = async () => {
  // 1. バリデーション実行
  const errors = validateOfferFields(editedData, data);
  if (errors && Object.keys(errors).length > 0) {
    setOfferErrors(errors);
    return; // API呼び出しをしない
  }
  setOfferErrors({});
  
  // 2. 全空欄チェック（保存後のバッジ消去用）
  // 3. API呼び出し
  // 4. 成功後にfetchPropertyData()でバッジ状態を更新
};
```

#### 買付日フィールドの変更

現在の実装:
```tsx
<TextField type="date" ... />
```

変更後:
```tsx
<TextField
  type="date"
  inputProps={{ style: { cursor: 'pointer' } }}
  onClick={(e) => {
    const input = (e.currentTarget as HTMLElement).querySelector('input');
    if (input) input.showPicker?.();
  }}
  ...
/>
```

## データモデル

### property_listings テーブル（関連カラム）

| カラム名 | 型 | 説明 |
|---|---|---|
| `offer_date` | `date \| null` | 買付日 |
| `offer_status` | `text \| null` | 買付の状況（「一般片手」等） |
| `offer_amount` | `text \| null` | 買付金額 |
| `offer_comment` | `text \| null` | 買付コメント |

### 空文字列→null 変換対象フィールド

バックエンドのルートで変換する対象:

```typescript
const OFFER_FIELDS = ['offer_date', 'offer_status', 'offer_amount', 'offer_comment'] as const;
```

変換ロジック:
```typescript
for (const field of OFFER_FIELDS) {
  if (updates[field] === '') {
    updates[field] = null;
  }
}
```

### Google Chat メッセージ形式

```
【買付情報更新】
物件番号: {propertyNumber}
買付日: {offer_date ?? '未設定'}
状況: {offer_status ?? '未設定'}
買付コメント: {offer_comment ?? '未設定'}
```

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において成立すべき特性または振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 空文字列フィールドはnullに変換される

*任意の* 買付フィールド（offer_date, offer_status, offer_amount, offer_comment）に空文字列が含まれる更新データに対して、変換処理後のデータではそのフィールドが `null` になる

**Validates: Requirements 1.2**

### プロパティ2: offer_amount が非空のとき未入力フィールドはエラーになる

*任意の* 非空文字列の offer_amount と、空の offer_date・offer_status・offer_comment の組み合わせに対して、バリデーション関数は各空フィールドに「必須項目です」エラーを返す

**Validates: Requirements 2.1**

### プロパティ3: offer_amount が空のときバリデーションエラーは発生しない

*任意の* offer_date・offer_status・offer_comment の値（空・非空を問わず）に対して、offer_amount が空の場合、バリデーション関数はエラーを返さない

**Validates: Requirements 2.2**

### プロパティ4: エラーフィールドに値を入力するとエラーが消える

*任意の* エラー状態のフィールドに対して、非空文字列を入力したとき、そのフィールドのエラーメッセージが消去される

**Validates: Requirements 2.5**

### プロパティ5: 通知メッセージには必須情報が含まれる

*任意の* 物件番号・買付日・状況・コメントの組み合わせに対して、buildNotificationMessage 関数の出力文字列にはそれらの値がすべて含まれる

**Validates: Requirements 4.2**

## エラーハンドリング

### バックエンド

| シナリオ | 処理 |
|---|---|
| 買付フィールドが空文字列 | `null` に変換してDB保存（500エラーを防止） |
| DB保存エラー | 既存の `catch` ブロックで500を返す（変更なし） |
| Google Chat通知失敗 | `console.error` でログ記録、保存結果には影響しない |
| Google Chat通知タイムアウト | 同上（非同期なので保存レスポンスには影響しない） |

### フロントエンド

| シナリオ | 処理 |
|---|---|
| offer_amount あり・他フィールド空 | バリデーションエラー表示、API呼び出しをブロック |
| バリデーション通過後の保存失敗 | 既存のsnackbarエラー表示（変更なし） |
| 全空欄保存成功 | fetchPropertyData()でoffer_statusがnullになり、PurchaseStatusBadgeが自動的に非表示になる |

## テスト戦略

### ユニットテスト（例示ベース）

**バックエンド**:
- 空文字列→null変換: `offer_date: ''` → `offer_date: null` になることを確認
- DB保存エラー時に500が返ることを確認（モック使用）
- Google Chat通知失敗時に保存結果が200であることを確認（モック使用）
- 保存成功後にWebhook URLへPOSTが呼ばれることを確認（モック使用）

**フロントエンド**:
- offer_amountが空のとき、handleSaveOfferがAPIを呼び出すことを確認
- バリデーションエラー時にAPIが呼ばれないことを確認
- 「必須項目です」テキストがエラーフィールドの下に表示されることを確認
- type="date"のinput要素が存在することを確認
- 全空欄保存後にPurchaseStatusBadgeが非表示になることを確認

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript/JavaScript向け）を使用する。各テストは最低100回のイテレーションを実行する。

**プロパティ1のテスト実装例**:
```typescript
// Feature: property-listing-purchase-info-fix, Property 1: 空文字列フィールドはnullに変換される
fc.assert(fc.property(
  fc.record({
    offer_date: fc.oneof(fc.constant(''), fc.string()),
    offer_status: fc.oneof(fc.constant(''), fc.string()),
    offer_amount: fc.oneof(fc.constant(''), fc.string()),
    offer_comment: fc.oneof(fc.constant(''), fc.string()),
  }),
  (updates) => {
    const converted = convertEmptyStringsToNull(updates);
    for (const field of OFFER_FIELDS) {
      if (updates[field] === '') {
        expect(converted[field]).toBe(null);
      }
    }
  }
), { numRuns: 100 });
```

**プロパティ2・3のテスト実装例**:
```typescript
// Feature: property-listing-purchase-info-fix, Property 2: offer_amountが非空のとき未入力フィールドはエラーになる
fc.assert(fc.property(
  fc.string({ minLength: 1 }), // 非空のoffer_amount
  (offerAmount) => {
    const errors = validateOfferFields({ offer_amount: offerAmount, offer_date: '', offer_status: '', offer_comment: '' }, mockData);
    expect(errors?.offer_date).toBe('必須項目です');
    expect(errors?.offer_status).toBe('必須項目です');
    expect(errors?.offer_comment).toBe('必須項目です');
  }
), { numRuns: 100 });
```

### 統合テスト

- PUT `/api/property-listings/:propertyNumber` に全空欄データを送信して200が返ることを確認
- 保存後にDBのoffer_dateがnullになっていることを確認
