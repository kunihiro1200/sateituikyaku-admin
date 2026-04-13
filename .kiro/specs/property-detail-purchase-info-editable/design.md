# 設計書: 買付情報セクション編集機能

## 概要

`PropertyListingDetailPage` の「買付情報」セクションに、他のセクション（価格情報・よく聞かれる項目・内覧情報など）と同一の `EditableSection` コンポーネントパターンを適用し、全フィールドをインライン編集可能にする。

バックエンドの `PUT /api/property-listings/:propertyNumber` エンドポイントおよびスプレッドシートへのカラムマッピングは実装済みのため、フロントエンドの編集 UI 追加が主な実装範囲となる。

## アーキテクチャ

### 既存パターンの踏襲

本機能は既存の編集セクションパターンを完全に踏襲する。

```
PropertyListingDetailPage
  └── EditableSection (title="買付情報", isEditMode={isOfferEditMode}, ...)
        ├── [表示モード] Typography（読み取り専用テキスト）
        └── [編集モード] TextField / Select（入力コントロール）
```

既存の他セクションとの対応：

| セクション | state 変数 | 保存ハンドラ | キャンセルハンドラ |
|---|---|---|---|
| 価格情報 | `isPriceEditMode` | `handleSavePrice` | `handleCancelPrice` |
| よく聞かれる項目 | `isFrequentlyAskedEditMode` | `handleSaveFrequentlyAsked` | `handleCancelFrequentlyAsked` |
| 内覧情報 | `isViewingInfoEditMode` | `handleSaveViewingInfo` | `handleCancelViewingInfo` |
| **買付情報（新規）** | **`isOfferEditMode`** | **`handleSaveOffer`** | **`handleCancelOffer`** |

### データフロー

```
[編集ボタンクリック]
  → isOfferEditMode = true
  → フィールドが入力コントロールに切り替わる

[フィールド変更]
  → handleFieldChange(key, value)
  → editedData = { ...editedData, [key]: value }

[保存ボタンクリック]
  → handleSaveOffer()
  → PUT /api/property-listings/:propertyNumber (editedData)
  → 成功: スナックバー表示 + isOfferEditMode = false + fetchPropertyData()
  → 失敗: エラースナックバー表示 + 編集モード維持

[キャンセルボタンクリック]
  → handleCancelOffer()
  → editedData = {} + isOfferEditMode = false
```

## コンポーネントとインターフェース

### EditableSection コンポーネント（既存）

```typescript
interface EditableSectionProps {
  title: string;
  isEditMode: boolean;
  onEditToggle: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  hasChanges?: boolean;
}
```

### 追加する state

```typescript
const [isOfferEditMode, setIsOfferEditMode] = useState(false);
```

既存の `editedData` state（`Record<string, any>`）を共有して使用する（他セクションと同様）。

### 追加するハンドラ

```typescript
const handleSaveOffer = async () => {
  if (!propertyNumber || Object.keys(editedData).length === 0) return;
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, editedData);
    setSnackbar({ open: true, message: '買付情報を保存しました', severity: 'success' });
    await fetchPropertyData();
    setEditedData({});
  } catch (error) {
    setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    throw error;
  }
};

const handleCancelOffer = () => {
  setEditedData({});
  setIsOfferEditMode(false);
};
```

## データモデル

### 対象フィールド

| フィールド名 | DB カラム | 入力コントロール | 選択肢 |
|---|---|---|---|
| 買付日 | `offer_date` | `TextField` (type="date") | - |
| 買付 | `offer_status` | `Select` | 一般片手・専任片手・専任両手・一般両手・一般他決（5択） |
| 状況 | `status` | `Select` | 19択（下記参照） |
| 金額 | `offer_amount` | `TextField` | - |
| 会社名 | `company_name` | `TextField` | - |
| 買付コメント | `offer_comment` | `TextField` (multiline) | - |

**「状況」フィールドの選択肢（19択）:**
専任両手・専任片手・一般両手・一般片手・一般他決・他社物件片手・自社買取（リースバック）・非公開→公開・一般媒介解除・専任解除・売止め・国広収益・自社買取（転売）・買取紹介（片手）・買取紹介（両手）・契約書作成済み・自社売主（元リースバック）・自社売主（元転売目的）・専任→一般媒介

### スプレッドシートカラムマッピング（実装済み）

`property-listing-column-mapping.json` に既に定義済み：

| スプレッドシート列名 | DB カラム |
|---|---|
| 買付日 | `offer_date` |
| 買付 | `offer_status` |
| 状況 | `status` |
| 金額（満額⇒〇〇円） | `offer_amount` |
| 会社名（連絡先も） | `company_name` |
| 買付コメント | `offer_comment` |

### PropertyListing インターフェース（既存）

対象フィールドはすべて既存の `PropertyListing` インターフェースに定義済み：

```typescript
interface PropertyListing {
  // ...
  status?: string;
  offer_date?: string;
  offer_status?: string;
  offer_amount?: string;
  offer_comment?: string;
  company_name?: string;
  // ...
}
```

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性または動作のことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: フィールド変更の editedData 反映

*For any* 買付情報フィールド（offer_date・offer_status・status・offer_amount・company_name・offer_comment）と任意の有効な入力値に対して、フィールドの値を変更した後、`editedData` の対応するキーが変更後の値と等しくなること。

**Validates: Requirements 2.2, 3.3, 4.3, 5.2, 6.2, 7.2**

### Property 2: セクション常時表示

*For any* `offer_date`・`offer_status`・`offer_amount` の値の組み合わせ（null・undefined・空文字列を含む）に対して、買付情報セクションが常にレンダリングされること。

**Validates: Requirements 9.1**

## エラーハンドリング

| シナリオ | 処理 |
|---|---|
| API 保存失敗（ネットワークエラー・5xx） | エラースナックバー表示、編集モード維持（`isOfferEditMode = true`） |
| `editedData` が空の状態で保存ボタンクリック | 保存処理をスキップ（API 呼び出しなし） |
| `propertyNumber` が未定義 | 保存処理をスキップ |

エラーハンドリングは既存の他セクション（`handleSaveViewingInfo` 等）と同一パターンを使用する。

## テスト戦略

### ユニットテスト（例ベース）

以下の具体的なシナリオをカバーする：

- 非編集モードで編集ボタンが表示されること（要件 1.1）
- 編集ボタンクリック後に全フィールドが入力コントロールに切り替わること（要件 1.2）
- 編集モードで保存・キャンセルボタンが表示されること（要件 1.3）
- キャンセルクリック後に `editedData` がリセットされ `isOfferEditMode` が false になること（要件 1.4）
- 編集モードで各フィールドが正しいコントロールタイプで表示されること（要件 2.1, 3.1, 4.1, 5.1, 6.1, 7.1）
- 非編集モードで各フィールドが読み取り専用テキストで表示されること（要件 2.3, 3.4, 4.4, 5.3, 6.3, 7.3）
- 「買付」フィールドの選択肢が5択であること（要件 3.2）
- 「状況」フィールドの選択肢が19択であること（要件 4.2）
- 保存ボタンクリック時に PUT API が呼ばれること（要件 8.1）
- 保存成功後にスナックバーが表示され編集モードが終了すること（要件 8.2）
- 全フィールドが空の場合に各フィールドに「-」が表示されること（要件 9.2）

### エッジケーステスト

- 保存失敗時にエラースナックバーが表示され編集モードが維持されること（要件 8.3）
- `editedData` が空の場合に保存処理がスキップされること（要件 8.4）

### プロパティベーステスト（Vitest + fast-check）

**Property 1: フィールド変更の editedData 反映**

```typescript
// Feature: property-detail-purchase-info-editable, Property 1: フィールド変更のeditedData反映
fc.assert(fc.property(
  fc.record({
    field: fc.constantFrom('offer_date', 'offer_status', 'status', 'offer_amount', 'company_name', 'offer_comment'),
    value: fc.string(),
  }),
  ({ field, value }) => {
    // handleFieldChange(field, value) を呼び出した後、
    // editedData[field] === value であることを確認
  }
), { numRuns: 100 });
```

**Property 2: セクション常時表示**

```typescript
// Feature: property-detail-purchase-info-editable, Property 2: セクション常時表示
fc.assert(fc.property(
  fc.record({
    offer_date: fc.option(fc.string(), { nil: undefined }),
    offer_status: fc.option(fc.string(), { nil: undefined }),
    offer_amount: fc.option(fc.string(), { nil: undefined }),
  }),
  (offerData) => {
    // 任意のoffer関連データでレンダリングした場合、
    // 買付情報セクションが存在することを確認
  }
), { numRuns: 100 });
```

テストファイルの配置先: `frontend/frontend/src/pages/__tests__/PropertyListingDetailPage.purchase-info.test.tsx`
