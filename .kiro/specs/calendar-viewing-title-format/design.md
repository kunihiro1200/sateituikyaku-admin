# 設計ドキュメント: カレンダー内覧タイトル形式

## Overview

`BuyerViewingResultPage.tsx` のカレンダーイベント生成ロジックを変更し、内覧形態フィールドの値をそのままタイトルに使用する形式に更新する。また、「立会」を含む場合は買主氏名を末尾に追加し、説明欄に買主詳細URLを追加する。

変更対象は以下の2箇所：
1. `handleCalendarButtonClick` 関数内のタイトル・説明生成ロジック
2. `calendarConfirmDialog` の初期値設定箇所（同関数内）

## Architecture

変更はフロントエンドのみ。バックエンドへの変更は不要。

```
BuyerViewingResultPage.tsx
  └── generateCalendarTitle(viewingType, propertyAddress, name) → string
  └── generateCalendarDescription(property, buyer) → string
```

タイトル生成ロジックと説明生成ロジックを純粋関数として切り出すことで、テスト容易性を高める。

## Components and Interfaces

### タイトル生成ロジック

```typescript
// 内覧形態を取得（viewing_type優先、なければviewing_type_general）
const viewingTypeValue = buyer.viewing_type || buyer.viewing_type_general || '';
// 物件所在地
const propertyAddr = property?.address || '';
// 「立会」を含み「立会不要」を含まない場合は買主氏名を追加
const isRittai = viewingTypeValue.includes('立会') && !viewingTypeValue.includes('立会不要');
const buyerNameSuffix = isRittai && buyer.name ? `（${buyer.name}）` : '';
const title = `${viewingTypeValue}${propertyAddr}${buyerNameSuffix}`.trim();
```

### 説明生成ロジック

```typescript
const description =
  `物件住所: ${property?.address || 'なし'}\n` +
  `GoogleMap: ${property?.google_map_url || 'なし'}\n` +
  `\n` +
  `お客様名: ${buyer.name || buyer.buyer_number}\n` +
  `電話番号: ${buyer.phone_number || 'なし'}\n` +
  `問合時ヒアリング: ${buyer.inquiry_hearing || 'なし'}\n` +
  `買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/${buyer.buyer_number}`;
```

### 適用箇所

`handleCalendarButtonClick` 関数内の2箇所（Googleカレンダー直接オープン用と `calendarConfirmDialog` 初期値設定用）に同じロジックを適用する。

## Data Models

既存の `buyer` オブジェクトのフィールドを使用：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `viewing_type` | string | 専任物件用内覧形態 |
| `viewing_type_general` | string | 一般媒介物件用内覧形態 |
| `name` | string | 買主氏名 |
| `buyer_number` | string | 買主番号 |
| `phone_number` | string | 電話番号 |
| `inquiry_hearing` | string | 問合時ヒアリング |

`property` オブジェクト：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `address` | string | 物件所在地 |
| `google_map_url` | string | GoogleマップURL |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: タイトル基本形式

*For any* viewing_type（または viewing_type_general）と property_address の組み合わせに対して、生成されるタイトルは `{viewingTypeValue}{propertyAddr}` で始まる（立会の場合は末尾に買主氏名が追加される）

**Validates: Requirements 1.1, 1.5**

### Property 2: viewing_type の優先順位

*For any* viewing_type が空でない値と viewing_type_general の組み合わせに対して、生成されるタイトルは viewing_type の値を先頭に使用し、viewing_type_general は使用しない。viewing_type が空で viewing_type_general が空でない場合は viewing_type_general を使用する。

**Validates: Requirements 1.2, 1.3**

### Property 3: 立会判定による買主氏名追加

*For any* 内覧形態の値と買主氏名に対して、「立会」を含み「立会不要」を含まない場合かつ名前が空でない場合のみ `（{name}）` がタイトル末尾に追加される。「立会不要」を含む場合、または「立会」を含まない場合は買主氏名が追加されない。

**Validates: Requirements 2.1, 2.2, 2.4**

### Property 4: 説明欄の買主詳細URL

*For any* buyer_number に対して、生成される説明欄の末尾行は `買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/{buyer_number}` の形式になる。

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

## Error Handling

- `viewing_type` と `viewing_type_general` が両方空の場合：`viewingTypeValue` が空文字になり、`propertyAddr` のみのタイトルが生成される（要件 1.4）
- `property` が null の場合：`property?.address || ''` で空文字にフォールバック
- `buyer.name` が空の場合：立会であっても `buyerNameSuffix` は空文字になり `（）` は付かない（要件 2.3）

## Testing Strategy

### ユニットテスト（具体例）

要件 3.1〜3.4 の具体例を直接検証する：

- `【内覧_専（自社物件）】` + `大分市中央町1-1-1` → `【内覧_専（自社物件）】大分市中央町1-1-1`
- `準不【内覧_一般（立会不要）】` + `別府市光町8-7（海月不動産）` → `準不【内覧_一般（立会不要）】別府市光町8-7（海月不動産）`（買主氏名なし）
- `準不【内覧_専（立会）】` + `大分市中央町1-1-1` + `山田太郎` → `準不【内覧_専（立会）】大分市中央町1-1-1（山田太郎）`
- `準不【内覧_一般（立会）】` + `別府市光町8-7` + `田中花子` → `準不【内覧_一般（立会）】別府市光町8-7（田中花子）`

エッジケース：
- viewing_type と viewing_type_general が両方空 → property_address のみ
- 立会だが name が空 → `（）` を付けない

### プロパティベーステスト（fast-check）

各プロパティを fast-check で検証する。最低100回のイテレーションを実行。

```typescript
// Feature: calendar-viewing-title-format, Property 1: タイトル基本形式
// Feature: calendar-viewing-title-format, Property 2: viewing_type優先順位
// Feature: calendar-viewing-title-format, Property 3: 立会判定による買主氏名追加
// Feature: calendar-viewing-title-format, Property 4: 説明欄の買主詳細URL
```

テスト対象は純粋関数として切り出したタイトル生成・説明生成ロジック。UIコンポーネントのテストは行わない。
