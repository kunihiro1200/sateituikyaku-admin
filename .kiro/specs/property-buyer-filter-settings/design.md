# 設計ドキュメント：物件詳細ページへの買主フィルター設定機能

## 概要

売主管理システムの物件詳細ページ（`/property-listings/:propertyNumber`）に、買主絞り込み用のフィルター設定バーを追加する。

設定したフィルター値は `property_listings` テーブルに保存され、次回ページを開いた際に復元される。また、買主候補リスト・公開前メール・値下げ配信メールの各機能を開いた際に、その物件に設定されたフィルター値を使って買主を自動絞り込む。

フィルタリングロジックは既存の `BuyerService` の `filterByPet`・`filterByParking`・`filterByOnsen`・`filterByFloor` メソッドを再利用する（`private` → `public static` に変更）。

### 対象ファイル

| 種別 | ファイル | 変更内容 |
|------|---------|---------|
| フロントエンド | `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` | フィルター設定バーUI追加 |
| バックエンド | `backend/src/services/BuyerService.ts` | filterByXxx を public static に変更 |
| バックエンド | `backend/src/services/BuyerCandidateService.ts` | フィルター値を受け取り適用 |
| バックエンド | `backend/src/services/EnhancedBuyerDistributionService.ts` | フィルター値を受け取り適用 |
| バックエンド | `backend/src/routes/propertyListings.ts` | buyer-candidates・distribution-buyers-enhanced エンドポイント拡張 |
| DB | マイグレーションSQL | property_listings テーブルに4カラム追加 |

---

## アーキテクチャ

```
フロントエンド (PropertyListingDetailPage.tsx)
  │
  │  PUT /api/property-listings/:propertyNumber
  │  { buyer_filter_pet, buyer_filter_parking, buyer_filter_onsen, buyer_filter_floor }
  │  ↑ フィルター値変更時に即座に保存
  │
  │  GET /api/property-listings/:propertyNumber
  │  ← buyer_filter_pet, buyer_filter_parking, buyer_filter_onsen, buyer_filter_floor を含む
  │  ↑ ページ読み込み時にフィルター値を復元
  │
  ├─ 買主候補リストボタン
  │    GET /api/property-listings/:propertyNumber/buyer-candidates
  │    ← BuyerCandidateService がフィルター値を property_listings から取得して適用
  │
  └─ GmailDistributionButton
       GET /api/property-listings/:propertyNumber/distribution-buyers-enhanced
       ← EnhancedBuyerDistributionService がフィルター値を property_listings から取得して適用

バックエンド
  ├─ PropertyListingService: buyer_filter_* カラムを透過的に保存・取得
  ├─ BuyerCandidateService: property_listings からフィルター値を取得し BuyerService.filterByXxx を適用
  ├─ EnhancedBuyerDistributionService: property_listings からフィルター値を取得し BuyerService.filterByXxx を適用
  └─ BuyerService: filterByPet/filterByParking/filterByOnsen/filterByFloor を public static に変更

DB (Supabase)
  └─ property_listings テーブル
       buyer_filter_pet TEXT
       buyer_filter_parking TEXT
       buyer_filter_onsen TEXT
       buyer_filter_floor TEXT
```

フィルタリングロジックは `BuyerService` に集約し、`BuyerCandidateService` と `EnhancedBuyerDistributionService` の両方から再利用する。

---

## コンポーネントとインターフェース

### フロントエンド変更

#### フィルター状態の追加

```typescript
// PropertyListingDetailPage.tsx に追加する状態
const [buyerFilterPet, setBuyerFilterPet] = useState<string>('どちらでも');
const [buyerFilterParking, setBuyerFilterParking] = useState<string>('指定なし');
const [buyerFilterOnsen, setBuyerFilterOnsen] = useState<string>('どちらでも');
const [buyerFilterFloor, setBuyerFilterFloor] = useState<string>('どちらでも');
```

#### 選択肢定数

```typescript
const PET_OPTIONS = ['可', '不可', 'どちらでも'] as const;
const PARKING_OPTIONS = ['1台', '2台以上', '3台以上', '10台以上', '不要', '指定なし'] as const;
const ONSEN_OPTIONS = ['あり', 'なし', 'どちらでも'] as const;
const FLOOR_OPTIONS = ['高層階', '低層階', 'どちらでも'] as const;
```

#### フィルター値の読み込み（ページ初期化時）

```typescript
// fetchPropertyData 内で data を取得後
setBuyerFilterPet(data.buyer_filter_pet || 'どちらでも');
setBuyerFilterParking(data.buyer_filter_parking || '指定なし');
setBuyerFilterOnsen(data.buyer_filter_onsen || 'どちらでも');
setBuyerFilterFloor(data.buyer_filter_floor || 'どちらでも');
```

#### フィルター値の保存（変更時に即座に保存）

```typescript
const handleBuyerFilterChange = async (field: string, value: string) => {
  // ローカル状態を更新
  if (field === 'buyer_filter_pet') setBuyerFilterPet(value);
  if (field === 'buyer_filter_parking') setBuyerFilterParking(value);
  if (field === 'buyer_filter_onsen') setBuyerFilterOnsen(value);
  if (field === 'buyer_filter_floor') setBuyerFilterFloor(value);

  // DBに即座に保存
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, { [field]: value });
  } catch (error) {
    setSnackbar({ open: true, message: 'フィルター設定の保存に失敗しました', severity: 'error' });
  }
};
```

#### 物件種別変更時のリセット処理

物件種別フィールドが変更されてマンション以外になった場合、Pet_Filter と Floor_Filter をリセットする。

```typescript
// handleFieldChange 内に追加
if (field === 'property_type' && value !== 'マンション') {
  setBuyerFilterPet('どちらでも');
  setBuyerFilterFloor('どちらでも');
  // DBにも保存
  await api.put(`/api/property-listings/${propertyNumber}`, {
    buyer_filter_pet: 'どちらでも',
    buyer_filter_floor: 'どちらでも',
  });
}
```

#### フィルターバーのUI配置

物件情報セクション（sticky ヘッダー）内の物件番号の右隣に配置する。

```tsx
{/* 物件番号の右隣にフィルター設定バーを配置 */}
<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
  {/* 物件番号 + コピーボタン（既存） */}
  <Typography variant="h6" fontWeight="bold" color="primary.main">
    {data.property_number}
  </Typography>
  <IconButton ...>{/* コピーボタン */}</IconButton>

  {/* フィルター設定バー */}
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', ml: 1 }}>
    {/* P台数フィルター（常時表示） */}
    <FilterButtonGroup
      label="P台数"
      options={PARKING_OPTIONS}
      value={buyerFilterParking}
      onChange={(v) => handleBuyerFilterChange('buyer_filter_parking', v)}
    />
    {/* 温泉フィルター（常時表示） */}
    <FilterButtonGroup
      label="温泉"
      options={ONSEN_OPTIONS}
      value={buyerFilterOnsen}
      onChange={(v) => handleBuyerFilterChange('buyer_filter_onsen', v)}
    />
    {/* ペットフィルター（マンション選択時のみ） */}
    {(editedData.property_type ?? data?.property_type) === 'マンション' && (
      <FilterButtonGroup
        label="ペット"
        options={PET_OPTIONS}
        value={buyerFilterPet}
        onChange={(v) => handleBuyerFilterChange('buyer_filter_pet', v)}
      />
    )}
    {/* 高層階フィルター（マンション選択時のみ） */}
    {(editedData.property_type ?? data?.property_type) === 'マンション' && (
      <FilterButtonGroup
        label="高層階"
        options={FLOOR_OPTIONS}
        value={buyerFilterFloor}
        onChange={(v) => handleBuyerFilterChange('buyer_filter_floor', v)}
      />
    )}
  </Box>
</Box>
```

`FilterButtonGroup` は既存の `OtherCompanyDistributionPage.tsx` のボタン選択UIパターンをインラインで実装する（新規コンポーネントは作成しない）。

### バックエンド変更

#### BuyerService: filterByXxx を public static に変更

```typescript
// backend/src/services/BuyerService.ts
// private → public static に変更
public static filterByPet(buyers: any[], pet: string): any[] { ... }
public static filterByParking(buyers: any[], parking: string): any[] { ... }
public static filterByOnsen(buyers: any[], onsen: string): any[] { ... }
public static filterByFloor(buyers: any[], floor: string): any[] { ... }
```

既存の `getOtherCompanyDistributionBuyers` 内での呼び出しは `BuyerService.filterByPet(...)` に変更する。

#### BuyerCandidateService: フィルター値を取得して適用

```typescript
// getCandidatesForProperty の末尾でフィルタリングを追加
async getCandidatesForProperty(propertyNumber: string): Promise<BuyerCandidateResponse> {
  // ... 既存の処理 ...

  // フィルター値を property から取得
  const pet = property.buyer_filter_pet || 'どちらでも';
  const parking = property.buyer_filter_parking || '指定なし';
  const onsen = property.buyer_filter_onsen || 'どちらでも';
  const floor = property.buyer_filter_floor || 'どちらでも';

  // 既存のフィルタリング後に追加フィルターを適用
  let filtered = candidates;
  filtered = BuyerService.filterByPet(filtered, pet);
  filtered = BuyerService.filterByParking(filtered, parking);
  filtered = BuyerService.filterByOnsen(filtered, onsen);
  filtered = BuyerService.filterByFloor(filtered, floor);

  const limitedCandidates = filtered.slice(0, 50);
  // ...
}
```

#### EnhancedBuyerDistributionService: フィルター値を取得して適用

```typescript
// getQualifiedBuyersWithAllCriteria 内でフィルタリングを追加
async getQualifiedBuyersWithAllCriteria(
  criteria: EnhancedFilterCriteria
): Promise<EnhancedBuyerFilterResult> {
  // ... 既存の処理 ...

  // フィルター値を property から取得
  const pet = property.buyer_filter_pet || 'どちらでも';
  const parking = property.buyer_filter_parking || '指定なし';
  const onsen = property.buyer_filter_onsen || 'どちらでも';
  const floor = property.buyer_filter_floor || 'どちらでも';

  // 既存のフィルタリング後に追加フィルターを適用
  let qualifiedBuyers = filteredBuyers;
  qualifiedBuyers = BuyerService.filterByPet(qualifiedBuyers, pet);
  qualifiedBuyers = BuyerService.filterByParking(qualifiedBuyers, parking);
  qualifiedBuyers = BuyerService.filterByOnsen(qualifiedBuyers, onsen);
  qualifiedBuyers = BuyerService.filterByFloor(qualifiedBuyers, floor);
  // ...
}
```

#### propertyListings ルート: 変更なし

`PUT /:propertyNumber` は `req.body` をそのまま `propertyListingService.update()` に渡す実装のため、`buyer_filter_*` フィールドは追加変更なしで透過的に保存される。

`GET /:propertyNumber` も `select('*')` で全カラムを取得するため、追加変更なしで `buyer_filter_*` フィールドが返される。

---

## データモデル

### DBマイグレーション

```sql
-- add-buyer-filter-columns.sql
ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS buyer_filter_pet TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_filter_parking TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_filter_onsen TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_filter_floor TEXT DEFAULT NULL;
```

### property_listings テーブルの新規カラム

| カラム名 | 型 | デフォルト | 説明 |
|---------|-----|---------|------|
| `buyer_filter_pet` | TEXT | NULL | ペットフィルター値（可/不可/どちらでも） |
| `buyer_filter_parking` | TEXT | NULL | P台数フィルター値（1台/2台以上/3台以上/10台以上/不要/指定なし） |
| `buyer_filter_onsen` | TEXT | NULL | 温泉フィルター値（あり/なし/どちらでも） |
| `buyer_filter_floor` | TEXT | NULL | 高層階フィルター値（高層階/低層階/どちらでも） |

NULL の場合はデフォルト値（`どちらでも` / `指定なし`）として扱い、フィルターを適用しない。

### フィルター値とデフォルト値

| フィルター | NULL時のデフォルト | 意味 |
|-----------|----------------|------|
| `buyer_filter_pet` | `どちらでも` | 全件対象 |
| `buyer_filter_parking` | `指定なし` | 全件対象 |
| `buyer_filter_onsen` | `どちらでも` | 全件対象 |
| `buyer_filter_floor` | `どちらでも` | 全件対象 |

### マッチングロジック（既存 BuyerService から再利用）

#### ペット（`pet_allowed_required` カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `可` | `不可` 以外（null・空欄を含む） |
| `不可` | `不可`・null・空欄 |
| `どちらでも` | 全件 |

#### P台数（`parking_spaces` カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `不要` | null・空欄・`1台`・`2台`・`不要` |
| `1台` | null・空欄・`不要`・`1台` |
| `2台以上` | `2台以上`・`3台以上`・`10台以上` |
| `3台以上` | `3台以上`・`10台以上` |
| `10台以上` | `10台以上` のみ |
| `指定なし` | 全件 |

#### 温泉（`hot_spring_required` カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `あり` | `あり` のみ |
| `なし` | null・空欄・`なし` |
| `どちらでも` | 全件 |

#### 高層階（`high_floor_required` カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `高層階` | null・空欄・`高層階`・`どちらでも` |
| `低層階` | null・空欄・`低層階`・`どちらでも` |
| `どちらでも` | 全件 |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: マンション以外の物件種別でPet_FilterとFloor_Filterが非表示になる

*任意の* マンション以外の物件種別（戸建・土地・その他）において、Filter_Bar に Pet_Filter と Floor_Filter が表示されない。

**Validates: Requirements 1.4**

### プロパティ2: 物件種別に関わらずParking_FilterとOnsen_Filterが常時表示される

*任意の* 物件種別において、Filter_Bar に Parking_Filter と Onsen_Filter が常に表示される。

**Validates: Requirements 1.5**

### プロパティ3: フィルター値変更時にDBへ保存される

*任意の* フィルター値（Pet/Parking/Onsen/Floor）の変更に対して、PUT `/api/property-listings/:propertyNumber` が変更後の値で呼ばれる。

**Validates: Requirements 2.1**

### プロパティ4: 保存済みフィルター値がFilter_Barに復元される

*任意の* 保存済みフィルター値（buyer_filter_pet/buyer_filter_parking/buyer_filter_onsen/buyer_filter_floor）を持つ物件において、ページ読み込み時にFilter_Barの各フィルターが保存済みの値を反映する。

**Validates: Requirements 2.2**

### プロパティ5: マンション以外への変更でPet_FilterとFloor_Filterがリセットされる

*任意の* Pet_Filter値とFloor_Filter値が設定された状態で、物件種別がマンション以外に変更されると、Pet_FilterとFloor_Filterの値が「どちらでも」にリセットされ、DBにも保存される。

**Validates: Requirements 3.1, 3.2, 3.3**

### プロパティ6: 買主候補リストへのフィルター適用

*任意の* フィルター値（Pet/Parking/Onsen/Floor）が設定された物件において、買主候補リストを取得すると、各フィルターのマッチングロジックに従って買主が絞り込まれる。

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### プロパティ7: 配信買主リストへのフィルター適用

*任意の* フィルター値（Pet/Parking/Onsen/Floor）が設定された物件において、配信買主リストを取得すると、各フィルターのマッチングロジックに従って買主が絞り込まれる。

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### プロパティ8: ペットフィルターのマッチングロジック

*任意の* 買主リストとペットフィルター値に対して、`BuyerService.filterByPet` のフィルタリング結果は以下の条件を満たす：
- `可` を選択した場合、結果に `pet_allowed_required = '不可'` の買主が含まれない
- `不可` を選択した場合、結果は全て `pet_allowed_required` が `不可`・null・空欄の買主のみである
- `どちらでも` を選択した場合、結果は入力リストと同一である

**Validates: Requirements 6.1, 6.2, 6.3**

### プロパティ9: P台数フィルターのマッチングロジック

*任意の* 買主リストとP台数フィルター値に対して、`BuyerService.filterByParking` のフィルタリング結果は仕様のマッチング条件を正確に満たす（`指定なし`は全件、`10台以上`は`10台以上`のみ、`3台以上`は`3台以上`と`10台以上`、`2台以上`は`2台以上`・`3台以上`・`10台以上`、`1台`はnull・空欄・`不要`・`1台`、`不要`はnull・空欄・`1台`・`2台`・`不要`）。

**Validates: Requirements 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

### プロパティ10: 温泉フィルターのマッチングロジック

*任意の* 買主リストと温泉フィルター値に対して、`BuyerService.filterByOnsen` のフィルタリング結果は以下の条件を満たす：
- `あり` を選択した場合、結果は全て `hot_spring_required = 'あり'` の買主のみである
- `なし` を選択した場合、結果に `hot_spring_required = 'あり'` の買主が含まれない
- `どちらでも` を選択した場合、結果は入力リストと同一である

**Validates: Requirements 6.10, 6.11, 6.12**

### プロパティ11: 高層階フィルターのマッチングロジック

*任意の* 買主リストと高層階フィルター値に対して、`BuyerService.filterByFloor` のフィルタリング結果は以下の条件を満たす：
- `高層階` を選択した場合、結果に `high_floor_required = '低層階'` の買主が含まれない
- `低層階` を選択した場合、結果に `high_floor_required = '高層階'` の買主が含まれない
- `どちらでも` を選択した場合、結果は入力リストと同一である

**Validates: Requirements 6.13, 6.14, 6.15**

**プロパティ反映（冗長性の排除）**: プロパティ8〜11はそれぞれ異なるフィルター関数を対象としており、独立したテストが必要。プロパティ6・7はサービス層の統合テストであり、プロパティ8〜11の単体テストとは別の価値を持つ。プロパティ3・4・5はフロントエンドのUI動作テストであり、バックエンドのテストとは独立している。冗長性なし。

---

## エラーハンドリング

### フロントエンド

- フィルター値の保存に失敗した場合、スナックバーでエラーメッセージを表示する（既存パターンと同様）
- ページ読み込み時にフィルター値が取得できない場合、デフォルト値（`どちらでも`/`指定なし`）を使用する
- フィルター値の変更は楽観的更新（ローカル状態を先に更新し、API失敗時にエラー表示）

### バックエンド

- `buyer_filter_*` カラムが NULL の場合、デフォルト値（`どちらでも`/`指定なし`）として扱い、フィルターを適用しない（全件対象）
- 不正なフィルター値が渡された場合、`BuyerService.filterByXxx` のフォールバック処理（全件返却）に委ねる
- `BuyerCandidateService` と `EnhancedBuyerDistributionService` でのフィルター適用エラーは既存のエラーハンドリングに委ねる

---

## テスト戦略

### ユニットテスト

各フィルターのマッチングロジック関数を独立してテストする（`BuyerService.filterByXxx` が `public static` になるため直接テスト可能）。

- `BuyerService.filterByPet(buyers, petValue)` - ペットフィルター
- `BuyerService.filterByParking(buyers, parkingValue)` - P台数フィルター
- `BuyerService.filterByOnsen(buyers, onsenValue)` - 温泉フィルター
- `BuyerService.filterByFloor(buyers, floorValue)` - 高層階フィルター

具体的なテストケース：
- 各フィルター値のデフォルト動作（全件返却）
- 境界値（空欄・null・`どちらでも`/`指定なし`）
- 各フィルター値の正常動作

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript向け）を使用する。各プロパティテストは最低100回実行する。

```typescript
// 例: ペットフィルターのマッチングロジック（プロパティ8）
// Feature: property-buyer-filter-settings, Property 8: ペットフィルターのマッチングロジック
fc.assert(
  fc.property(
    fc.array(buyerArbitrary),
    fc.constantFrom('可', '不可', 'どちらでも'),
    (buyers, petFilter) => {
      const result = BuyerService.filterByPet(buyers, petFilter);
      if (petFilter === '可') {
        return result.every(b => b.pet_allowed_required !== '不可');
      }
      if (petFilter === '不可') {
        return result.every(b => !b.pet_allowed_required || b.pet_allowed_required === '' || b.pet_allowed_required === '不可');
      }
      return result.length === buyers.length;
    }
  ),
  { numRuns: 100 }
);
```

各プロパティに対して1つのプロパティベーステストを実装する（プロパティ1〜11）。

### 統合テスト

- `GET /api/property-listings/:propertyNumber/buyer-candidates` でフィルター値が適用されることを確認
- `GET /api/property-listings/:propertyNumber/distribution-buyers-enhanced` でフィルター値が適用されることを確認
- フィルター値が NULL の場合に全件が返されることを確認
- `PUT /api/property-listings/:propertyNumber` で `buyer_filter_*` フィールドが保存されることを確認
- `GET /api/property-listings/:propertyNumber` のレスポンスに `buyer_filter_*` フィールドが含まれることを確認
