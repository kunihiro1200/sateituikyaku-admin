# 設計ドキュメント：買主リスト「他社物件新着配信」フィルター追加

## 概要

「他社物件新着配信」ページ（`/buyers/other-company-distribution`）のヘッダー選択バーに、「ペット」「P台数」「温泉」「高層階」の4つのフィルターを追加する。

フロントエンドはフィルター値をAPIリクエストに含めて送信し、バックエンドがマッチングロジックを適用して買主を絞り込む。

### 対象ファイル

- **フロントエンド**: `frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx`
- **バックエンド**: `backend/src/routes/buyers.ts`、`backend/src/services/BuyerService.ts`

### 既存のDBカラム（buyersテーブル）

| フィルター | DBカラム名 | スプレッドシート列名 |
|-----------|-----------|-------------------|
| ペット | `pet_allowed_required` | `★ペット可` |
| P台数 | `parking_spaces` | `●P台数` |
| 温泉 | `hot_spring_required` | `★温泉あり` |
| 高層階 | `high_floor_required` | `★高層階` |

---

## アーキテクチャ

```
フロントエンド (OtherCompanyDistributionPage.tsx)
  │
  │  POST /api/buyers/radius-search
  │  { address, priceRange, propertyTypes, pet, parking, onsen, floor }
  │
  ▼
バックエンド (buyers.ts route)
  │
  ▼
BuyerService.getBuyersByRadiusSearch()
  │  既存フィルター（半径・ステータス・物件種別・価格帯）の後に
  │  新規フィルター（ペット・P台数・温泉・高層階）を適用
  │
  ▼
Supabase (buyersテーブル)
```

フィルタリングは全てバックエンドで実施する。フロントエンドはフィルター値をAPIに渡すだけで、マッチングロジックはバックエンドに集約する。

---

## コンポーネントとインターフェース

### フロントエンド変更

#### 新規フィルター状態

```typescript
// OtherCompanyDistributionPage.tsx に追加する状態
const [selectedPet, setSelectedPet] = useState<string>('どちらでも');
const [selectedParking, setSelectedParking] = useState<string>('指定なし');
const [selectedOnsen, setSelectedOnsen] = useState<string>('どちらでも');
const [selectedFloor, setSelectedFloor] = useState<string>('どちらでも');
```

#### 選択肢定数

```typescript
const PET_OPTIONS = ['可', '不可', 'どちらでも'] as const;
const PARKING_OPTIONS = ['1台', '2台以上', '3台以上', '10台以上', '不要', '指定なし'] as const;
const ONSEN_OPTIONS = ['あり', 'なし', 'どちらでも'] as const;
const FLOOR_OPTIONS = ['高層階', '低層階', 'どちらでも'] as const;
```

#### マンション選択時のリセット処理

物件種別からマンションが除外された場合、ペットと高層階フィルターを「どちらでも」にリセットする。

```typescript
// togglePropertyType 内に追加
const togglePropertyType = (type: string) => {
  setSelectedPropertyTypes(prev => {
    const next = prev.includes(type)
      ? prev.filter(t => t !== type)
      : [...prev, type];
    // マンションが含まれなくなった場合はリセット
    if (!next.includes('マンション')) {
      setSelectedPet('どちらでも');
      setSelectedFloor('どちらでも');
    }
    return next;
  });
};
```

#### APIリクエスト変更

```typescript
const response = await api.post('/api/buyers/radius-search', {
  address: address.trim(),
  priceRange: selectedPriceRange,
  propertyTypes: selectedPropertyTypes,
  pet: selectedPet,
  parking: selectedParking,
  onsen: selectedOnsen,
  floor: selectedFloor,
});
```

#### フィルターUIの配置

既存の「物件種別」フィルターの下に新規フィルターを追加する。ペットと高層階はマンション選択時のみ表示する。

```tsx
{/* ペットフィルター（マンション選択時のみ） */}
{selectedPropertyTypes.includes('マンション') && (
  <Grid item xs={12} md={3}>
    {/* ボタン選択UI */}
  </Grid>
)}

{/* P台数フィルター（常時表示） */}
<Grid item xs={12} md={3}>
  {/* ボタン選択UI */}
</Grid>

{/* 温泉フィルター（常時表示） */}
<Grid item xs={12} md={3}>
  {/* ボタン選択UI */}
</Grid>

{/* 高層階フィルター（マンション選択時のみ） */}
{selectedPropertyTypes.includes('マンション') && (
  <Grid item xs={12} md={3}>
    {/* ボタン選択UI */}
  </Grid>
)}
```

### バックエンド変更

#### APIエンドポイント（buyers.ts）

```typescript
router.post('/radius-search', authenticate, async (req: Request, res: Response) => {
  const { address, priceRange, propertyTypes, pet, parking, onsen, floor } = req.body;
  
  const result = await buyerService.getBuyersByRadiusSearch({
    address,
    priceRange: priceRange || '指定なし',
    propertyTypes,
    pet: pet || 'どちらでも',
    parking: parking || '指定なし',
    onsen: onsen || 'どちらでも',
    floor: floor || 'どちらでも',
  });
  // ...
});
```

#### BuyerService メソッドシグネチャ変更

```typescript
async getBuyersByRadiusSearch(params: {
  address: string;
  priceRange: string;
  propertyTypes: string[];
  pet?: string;
  parking?: string;
  onsen?: string;
  floor?: string;
}): Promise<{ buyers: any[]; total: number }>
```

---

## データモデル

### リクエストパラメーター

| パラメーター | 型 | デフォルト | 説明 |
|------------|-----|---------|------|
| `pet` | string | `'どちらでも'` | ペットフィルター値 |
| `parking` | string | `'指定なし'` | P台数フィルター値 |
| `onsen` | string | `'どちらでも'` | 温泉フィルター値 |
| `floor` | string | `'どちらでも'` | 高層階フィルター値 |

### マッチングロジック

#### ペット（`pet_allowed_required`カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `可` | `null`、空欄、`不可`以外の全ての値 |
| `不可` | `不可` のみ |
| `どちらでも` | 全件 |

#### P台数（`parking_spaces`カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `不要` | `null`、空欄、`1台`、`2台`、`不要` |
| `1台` | `null`、空欄、`不要`、`1台` |
| `2台以上` | `2台以上`、`3台以上`、`10台以上` |
| `3台以上` | `3台以上`、`10台以上` |
| `10台以上` | `10台以上` のみ |
| `指定なし` | 全件 |

#### 温泉（`hot_spring_required`カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `あり` | `あり` のみ |
| `なし` | `null`、空欄、`なし` |
| `どちらでも` | 全件 |

#### 高層階（`high_floor_required`カラム）

| フィルター値 | マッチする買主のDB値 |
|------------|------------------|
| `高層階` | `null`、空欄、`高層階`、`どちらでも` |
| `低層階` | `null`、空欄、`低層階`、`どちらでも` |
| `どちらでも` | 全件 |

### キャッシュキー変更

既存のキャッシュキーに新規フィルターを追加する。

```typescript
const cacheKey = `radius:${address}:${priceRange}:${propertyTypes.join(',')}:${pet}:${parking}:${onsen}:${floor}`;
```

### Supabaseクエリ変更

`getBuyersByRadiusSearch`内のSupabaseクエリに新規カラムを追加する。

```typescript
const { data: allBuyers, error } = await this.supabase
  .from('buyers')
  .select(`
    buyer_number, name, desired_area, desired_property_type,
    price_range_house, price_range_apartment, price_range_land,
    reception_date, phone_number, email, latest_status, inquiry_hearing,
    desired_area_lat, desired_area_lng,
    pet_allowed_required, parking_spaces, hot_spring_required, high_floor_required
  `)
  .is('deleted_at', null)
  .not('desired_area_lat', 'is', null)
  .not('desired_area_lng', 'is', null);
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: マンション選択状態と条件付きフィルター表示の対応

*任意の* 物件種別の選択状態において、マンションが含まれる場合はペットフィルターと高層階フィルターが表示され、マンションが含まれない場合はこれらのフィルターが非表示になる。

**Validates: Requirements 1.1, 1.2, 4.1, 4.2, 5.1, 5.2**

### プロパティ2: マンション非選択時の条件付きフィルターリセット

*任意の* ペットフィルター値と高層階フィルター値が設定された状態で、物件種別からマンションが除外されると、ペットフィルターと高層階フィルターの値が「どちらでも」にリセットされる。

**Validates: Requirements 1.8, 4.8, 5.4**

### プロパティ3: ペットフィルターのマッチングロジック

*任意の* 買主リストとペットフィルター値に対して、フィルタリング結果は以下の条件を満たす：
- `可` を選択した場合、結果に `pet_allowed_required = '不可'` の買主が含まれない
- `不可` を選択した場合、結果は全て `pet_allowed_required = '不可'` の買主のみである
- `どちらでも` を選択した場合、結果は入力リストと同一である

**Validates: Requirements 1.5, 1.6, 1.7**

### プロパティ4: P台数フィルターのマッチングロジック

*任意の* 買主リストとP台数フィルター値に対して、フィルタリング結果は仕様のマッチング条件を正確に満たす（`指定なし`は全件、`10台以上`は`10台以上`のみ、`3台以上`は`3台以上`と`10台以上`、`2台以上`は`2台以上`・`3台以上`・`10台以上`、`1台`は`null`・空欄・`不要`・`1台`、`不要`は`null`・空欄・`1台`・`2台`・`不要`）。

**Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

### プロパティ5: 温泉フィルターのマッチングロジック

*任意の* 買主リストと温泉フィルター値に対して、フィルタリング結果は以下の条件を満たす：
- `あり` を選択した場合、結果は全て `hot_spring_required = 'あり'` の買主のみである
- `なし` を選択した場合、結果に `hot_spring_required = 'あり'` の買主が含まれない
- `どちらでも` を選択した場合、結果は入力リストと同一である

**Validates: Requirements 3.4, 3.5, 3.6**

### プロパティ6: 高層階フィルターのマッチングロジック

*任意の* 買主リストと高層階フィルター値に対して、フィルタリング結果は以下の条件を満たす：
- `高層階` を選択した場合、結果に `high_floor_required = '低層階'` の買主が含まれない
- `低層階` を選択した場合、結果に `high_floor_required = '高層階'` の買主が含まれない
- `どちらでも` を選択した場合、結果は入力リストと同一である

**Validates: Requirements 4.5, 4.6, 4.7**

### プロパティ7: 複数フィルターのAND結合

*任意の* 複数フィルター値の組み合わせに対して、フィルタリング結果は各フィルターを個別に適用した結果の積集合と一致する（AND条件）。

**Validates: Requirements 6.1, 6.2**

---

## エラーハンドリング

### フロントエンド

- 新規フィルターはオプションパラメーターとして扱う。APIエラー時の挙動は既存と同様（エラーメッセージ表示）。
- フィルター値の変更は即座にAPIを再呼び出しする（既存の`useEffect`に依存配列を追加）。

### バックエンド

- 新規フィルターパラメーターが省略された場合はデフォルト値（`どちらでも`/`指定なし`）を使用し、全件を対象とする。
- 不正なフィルター値が渡された場合は全件を対象とする（フォールバック）。

---

## テスト戦略

### ユニットテスト

各フィルターのマッチングロジック関数を独立してテストする。

- `filterByPet(buyers, petValue)` - ペットフィルター
- `filterByParking(buyers, parkingValue)` - P台数フィルター
- `filterByOnsen(buyers, onsenValue)` - 温泉フィルター
- `filterByFloor(buyers, floorValue)` - 高層階フィルター

具体的なテストケース：
- 各フィルター値のデフォルト動作（全件返却）
- 境界値（空欄・null・`どちらでも`）
- 複数フィルターのAND結合

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript向け）を使用する。各プロパティテストは最低100回実行する。

```typescript
// 例: ペットフィルターのマッチングロジック（プロパティ3）
// Feature: buyer-distribution-filter-enhancement, Property 3: ペットフィルターのマッチングロジック
fc.assert(
  fc.property(
    fc.array(buyerArbitrary),
    fc.constantFrom('可', '不可', 'どちらでも'),
    (buyers, petFilter) => {
      const result = filterByPet(buyers, petFilter);
      if (petFilter === '可') {
        return result.every(b => b.pet_allowed_required !== '不可');
      }
      if (petFilter === '不可') {
        return result.every(b => b.pet_allowed_required === '不可');
      }
      return result.length === buyers.length;
    }
  ),
  { numRuns: 100 }
);
```

各プロパティに対して1つのプロパティベーステストを実装する（プロパティ1〜7）。

### 統合テスト

- `/api/buyers/radius-search` エンドポイントに新規パラメーターを渡した場合の動作確認
- フィルターパラメーター省略時の全件返却確認
- 既存フィルター（住所・価格種別・物件種別）との組み合わせ動作確認
