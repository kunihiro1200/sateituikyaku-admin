# 設計書

## 概要

通話モードページの重複売主表示機能を拡張する。現在の実装では `DuplicateCard` に名前・反響日・物件情報・コメント・コミュニケーション履歴しか表示されていないが、要件で求められている「確度・状況（当社）・次電日・査定額・物件所在地」を追加表示する。

また、`DuplicateDetectionService` の `checkDuplicateByPhone` / `checkDuplicateByEmail` が `sellers` テーブルから取得するフィールドが不足しているため、これらを拡張する。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/src/services/DuplicateDetectionService.ts` | `checkDuplicateByPhone` / `checkDuplicateByEmail` のSELECTクエリに不足フィールドを追加 |
| `backend/src/types/index.ts` | `DuplicateMatch.sellerInfo` に不足フィールドを追加 |
| `frontend/frontend/src/types/index.ts` | `DuplicateMatch.sellerInfo` に不足フィールドを追加 |
| `frontend/frontend/src/components/DuplicateCard.tsx` | 不足フィールドの表示を追加、リンク先を通話モードページに変更 |

### 変更しないファイル

- `backend/src/routes/sellers.ts` の `/:id/duplicates` エンドポイント → 変更不要（`DuplicateDetectionService.checkDuplicates()` を呼ぶだけ）
- `frontend/frontend/src/components/DuplicateDetailsModal.tsx` → 変更不要
- `frontend/frontend/src/components/DuplicateIndicatorBadge.tsx` → 変更不要
- `frontend/frontend/src/pages/CallModePage.tsx` → 変更不要

---

## 詳細設計

### 1. `DuplicateMatch` 型の拡張

**対象ファイル**: `backend/src/types/index.ts`、`frontend/frontend/src/types/index.ts`

`sellerInfo` に以下のフィールドを追加する：

```typescript
export interface DuplicateMatch {
  sellerId: string;
  matchType: 'phone' | 'email' | 'both';
  sellerInfo: {
    name: string;
    phoneNumber: string;
    email?: string;
    inquiryDate?: Date;
    sellerNumber?: string;
    // 追加フィールド
    confidenceLevel?: string;   // 確度（confidence_level）
    status?: string;            // 状況（当社）（status）
    nextCallDate?: string;      // 次電日（next_call_date）
    valuationAmount1?: number;  // 査定額1（valuation_amount_1）
    valuationAmount2?: number;  // 査定額2（valuation_amount_2）
    valuationAmount3?: number;  // 査定額3（valuation_amount_3）
    propertyAddress?: string;   // 物件所在地（property_address）
    comments?: string;          // コメント（comments）
  };
  propertyInfo?: {
    address: string;
    propertyType: string;
  };
}
```

### 2. `DuplicateDetectionService` の拡張

**対象ファイル**: `backend/src/services/DuplicateDetectionService.ts`

`checkDuplicateByPhone` と `checkDuplicateByEmail` のSELECTクエリに不足フィールドを追加する。

**現在のクエリ（`checkDuplicateByPhone`）**:
```typescript
.select(`
  id,
  name,
  phone_number,
  email,
  inquiry_date,
  seller_number,
  properties (
    property_address,
    property_type
  )
`)
```

**変更後のクエリ**:
```typescript
.select(`
  id,
  name,
  phone_number,
  email,
  inquiry_date,
  seller_number,
  confidence_level,
  status,
  next_call_date,
  valuation_amount_1,
  valuation_amount_2,
  valuation_amount_3,
  property_address,
  comments
`)
```

> 注意: `properties` テーブルのJOINは削除し、`sellers` テーブルの `property_address` を直接使用する。これはステアリングドキュメント（`seller-table-column-definition.md`）の定義に従う。

**マッピング変更後**:
```typescript
return data.map((seller: any) => ({
  sellerId: seller.id,
  matchType: 'phone' as const,
  sellerInfo: {
    name: seller.name,
    phoneNumber: seller.phone_number,
    email: seller.email,
    inquiryDate: seller.inquiry_date ? new Date(seller.inquiry_date) : undefined,
    sellerNumber: seller.seller_number,
    confidenceLevel: seller.confidence_level,
    status: seller.status,
    nextCallDate: seller.next_call_date,
    valuationAmount1: seller.valuation_amount_1,
    valuationAmount2: seller.valuation_amount_2,
    valuationAmount3: seller.valuation_amount_3,
    propertyAddress: seller.property_address,
    comments: seller.comments,
  },
  // propertyInfo は sellers.property_address から構築（後方互換性のため残す）
  propertyInfo: seller.property_address
    ? {
        address: seller.property_address,
        propertyType: '',
      }
    : undefined,
}));
```

`checkDuplicateByEmail` も同様に変更する。

### 3. `DuplicateCard` の表示拡張

**対象ファイル**: `frontend/frontend/src/components/DuplicateCard.tsx`

#### 表示項目の追加

現在表示されていない以下の項目を追加する：

| 項目 | フィールド | 表示形式 |
|------|-----------|---------|
| 売主番号 | `sellerInfo.sellerNumber` | リンク（通話モードページへ） |
| 反響日 | `sellerInfo.inquiryDate` | `YYYY/MM/DD` |
| 確度 | `sellerInfo.confidenceLevel` | テキスト |
| 状況（当社） | `sellerInfo.status` | テキスト |
| 次電日 | `sellerInfo.nextCallDate` | `YYYY/MM/DD` |
| 査定額 | `sellerInfo.valuationAmount1/2/3` | `X,XXX万円`（円→万円変換） |
| コメント | `sellerInfo.comments` | 折り返しテキスト |
| 物件所在地 | `sellerInfo.propertyAddress` | テキスト |

#### リンク先の変更

現在: `/sellers/${duplicate.sellerId}`（売主詳細ページ）
変更後: `/sellers/${duplicate.sellerId}/call`（通話モードページ）

#### レイアウト設計

```
┌─────────────────────────────────────────────────┐
│ [売主番号リンク]              [重複タイプChip]    │
├─────────────────────────────────────────────────┤
│ 反響日: YYYY/MM/DD    確度: A                    │
│ 状況: 追客中          次電日: YYYY/MM/DD          │
│ 物件所在地: ○○市△△町1-1-1                       │
├─────────────────────────────────────────────────┤
│ 査定額: 1,200万円 / 1,300万円 / 1,500万円        │
├─────────────────────────────────────────────────┤
│ コメント:                                        │
│ [コメントテキスト]                               │
└─────────────────────────────────────────────────┘
```

#### 査定額の表示ロジック

```typescript
// 円単位 → 万円単位に変換して表示
const formatValuation = (amount?: number): string => {
  if (!amount) return '-';
  return `${Math.round(amount / 10000).toLocaleString()}万円`;
};

// 存在する査定額のみ「/」区切りで表示
const valuationText = [
  sellerInfo.valuationAmount1,
  sellerInfo.valuationAmount2,
  sellerInfo.valuationAmount3,
]
  .filter(Boolean)
  .map(formatValuation)
  .join(' / ');
```

---

## データフロー

```
CallModePage（マウント時）
  ↓ GET /api/sellers/:id/duplicates
backend/src/routes/sellers.ts（/:id/duplicates）
  ↓ DuplicateDetectionService.checkDuplicates()
  ↓ checkDuplicateByPhone() / checkDuplicateByEmail()
  ↓ sellers テーブルから拡張フィールドを取得
  ↓ DuplicateMatch[] を返す（sellerInfo に全フィールド含む）
CallModePage
  ↓ duplicates state に保存
  ↓ DuplicateIndicatorBadge を表示（重複数）
ユーザーが「重複」ボタンをクリック
  ↓ DuplicateDetailsModal を開く
  ↓ DuplicateCard を各重複売主ごとに表示
  ↓ 全フィールドを表示
```

---

## 正確性の検証

### 検証すべき性質

1. **重複検出の正確性**: 電話番号またはメールアドレスが一致する売主のみが返される
2. **自己除外**: 現在の売主自身が重複結果に含まれない
3. **フィールドの完全性**: 全ての必須フィールドが `DuplicateMatch` に含まれる
4. **査定額変換**: 円単位の値が正しく万円単位に変換される（例: 12,000,000 → 1,200万円）

### 境界ケース

- 査定額が全て `null` の場合 → 査定額行を非表示
- コメントが空の場合 → 「コメントなし」と表示
- 物件所在地が空の場合 → 非表示
- 次電日が未設定の場合 → `-` と表示
