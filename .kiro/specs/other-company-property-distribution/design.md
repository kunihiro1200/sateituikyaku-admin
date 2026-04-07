# 設計書：他社物件新着配信

## 概要

買主リスト一覧ページに「他社物件新着配信」機能を追加し、買主の希望条件（エリア、価格帯、物件種別）に基づいて配信対象の買主を絞り込み、一覧表示する機能を実装します。

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                     フロントエンド                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  BuyersPage.tsx                                      │   │
│  │  - ヘッダーに「他社物件新着配信」ボタンを追加         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          │ クリック                           │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OtherCompanyDistributionPage.tsx（新規作成）         │   │
│  │  - エリア選択ドロップダウン                           │   │
│  │  - 価格帯選択ドロップダウン                           │   │
│  │  - 物件種別選択ボタン（複数選択可）                   │   │
│  │  - 買主リスト表示（BuyerListコンポーネント再利用）    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          │ API呼び出し                        │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ GET /api/buyers/other-company-distribution
                           │ ?area=①&priceRange=~1900万円&propertyTypes=戸建,マンション
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     バックエンド                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  backend/src/routes/buyers.ts                        │   │
│  │  - GET /other-company-distribution エンドポイント追加 │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  backend/src/services/BuyerService.ts                │   │
│  │  - getOtherCompanyDistributionBuyers() メソッド追加   │   │
│  │  - エリアグループルール適用                           │   │
│  │  - フィルタリングロジック実装                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase (PostgreSQL)                               │   │
│  │  - buyers テーブル                                    │   │
│  │    - desired_area                                    │   │
│  │    - desired_property_type                           │   │
│  │    - price_range_house                               │   │
│  │    - price_range_apartment                           │   │
│  │    - price_range_land                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. ユーザーが「他社物件新着配信」ボタンをクリック
2. `/buyers/other-company-distribution` ページに遷移
3. ユーザーがエリア、価格帯、物件種別を選択
4. フロントエンドがバックエンドAPIを呼び出し
5. バックエンドがデータベースから買主を取得
6. エリアグループルール適用（①～⑧→㊵、⑨～⑮→㊶）
7. フィルタリング（エリア、価格帯、物件種別）
8. 結果をフロントエンドに返却
9. 買主リストを表示

## コンポーネントとインターフェース

### フロントエンド

#### 1. BuyersPage.tsx（既存ファイル修正）

**変更内容**: ヘッダーに「他社物件新着配信」ボタンを追加

**追加コード**:
```typescript
<Button
  variant="outlined"
  onClick={() => navigate('/buyers/other-company-distribution')}
  sx={{
    borderColor: SECTION_COLORS.buyer.main,
    color: SECTION_COLORS.buyer.main,
    '&:hover': {
      borderColor: SECTION_COLORS.buyer.dark,
      backgroundColor: `${SECTION_COLORS.buyer.main}15`,
    },
  }}
>
  他社物件新着配信
</Button>
```

**配置位置**: 「公開物件サイト」ボタンの右隣

---

#### 2. OtherCompanyDistributionPage.tsx（新規作成）

**ファイルパス**: `frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx`

**主要コンポーネント**:

```typescript
interface OtherCompanyDistributionPageProps {}

interface Buyer {
  buyer_number: string;
  name: string;
  desired_area: string;
  desired_property_type: string;
  price_range_house: string | null;
  price_range_apartment: string | null;
  price_range_land: string | null;
}

export default function OtherCompanyDistributionPage() {
  // State
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('指定なし');
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);

  // エリア選択肢（①～㊸）
  const areaOptions = [
    '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧',
    '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯',
    // ... 残りのエリア
  ];

  // 価格帯選択肢
  const priceRangeOptions = [
    '指定なし',
    '~1900万円',
    '1000万円~2999万円',
    '2000万円以上',
  ];

  // 物件種別選択肢
  const propertyTypeOptions = ['戸建', 'マンション', '土地'];

  // API呼び出し
  const fetchBuyers = async () => {
    if (!selectedArea || selectedPropertyTypes.length === 0) {
      setBuyers([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('area', selectedArea);
      params.append('priceRange', selectedPriceRange);
      selectedPropertyTypes.forEach(type => params.append('propertyTypes', type));

      const response = await api.get(`/api/buyers/other-company-distribution?${params.toString()}`);
      setBuyers(response.data.buyers);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, [selectedArea, selectedPriceRange, selectedPropertyTypes]);

  return (
    <Container maxWidth="xl">
      {/* ヘッダー */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          他社物件新着配信
        </Typography>
      </Box>

      {/* フィルター */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          {/* エリア選択 */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>希望エリア</InputLabel>
              <Select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
              >
                <MenuItem value="">未選択</MenuItem>
                {areaOptions.map(area => (
                  <MenuItem key={area} value={area}>{area}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 価格帯選択 */}
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>価格種別</InputLabel>
              <Select
                value={selectedPriceRange}
                onChange={(e) => setSelectedPriceRange(e.target.value)}
              >
                {priceRangeOptions.map(range => (
                  <MenuItem key={range} value={range}>{range}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 物件種別選択 */}
          <Grid item xs={12} md={4}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>物件種別</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {propertyTypeOptions.map(type => (
                  <Button
                    key={type}
                    variant={selectedPropertyTypes.includes(type) ? 'contained' : 'outlined'}
                    onClick={() => {
                      setSelectedPropertyTypes(prev =>
                        prev.includes(type)
                          ? prev.filter(t => t !== type)
                          : [...prev, type]
                      );
                    }}
                  >
                    {type}
                  </Button>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 買主リスト */}
      <Paper>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : buyers.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography>条件に合う買主が見つかりませんでした</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>買主番号</TableCell>
                <TableCell>氏名</TableCell>
                <TableCell>希望エリア</TableCell>
                <TableCell>希望種別</TableCell>
                <TableCell>希望価格</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buyers.map(buyer => (
                <TableRow key={buyer.buyer_number}>
                  <TableCell>{buyer.buyer_number}</TableCell>
                  <TableCell>{buyer.name}</TableCell>
                  <TableCell>{buyer.desired_area}</TableCell>
                  <TableCell>{buyer.desired_property_type}</TableCell>
                  <TableCell>
                    {buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}
```

---

#### 3. ルーティング設定（App.tsx）

**追加ルート**:
```typescript
<Route path="/buyers/other-company-distribution" element={<OtherCompanyDistributionPage />} />
```

---

### バックエンド

#### 1. backend/src/routes/buyers.ts（既存ファイル修正）

**追加エンドポイント**:
```typescript
// 他社物件新着配信用の買主取得
router.get('/other-company-distribution', authenticate, async (req: Request, res: Response) => {
  try {
    const { area, priceRange, propertyTypes } = req.query;

    // バリデーション
    if (!area || !propertyTypes) {
      return res.status(400).json({ error: 'area and propertyTypes are required' });
    }

    const propertyTypesArray = Array.isArray(propertyTypes) 
      ? propertyTypes 
      : [propertyTypes];

    const result = await buyerService.getOtherCompanyDistributionBuyers({
      area: area as string,
      priceRange: priceRange as string,
      propertyTypes: propertyTypesArray as string[],
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching other company distribution buyers:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

#### 2. backend/src/services/BuyerService.ts（既存ファイル修正）

**追加メソッド**:
```typescript
/**
 * 他社物件新着配信用の買主を取得
 */
async getOtherCompanyDistributionBuyers(params: {
  area: string;
  priceRange: string;
  propertyTypes: string[];
}): Promise<{ buyers: any[]; total: number }> {
  const { area, priceRange, propertyTypes } = params;

  // エリアグループルール適用
  const targetAreas = this.applyAreaGroupRules(area);

  // クエリ構築
  let query = this.supabase
    .from('buyers')
    .select('buyer_number, name, desired_area, desired_property_type, price_range_house, price_range_apartment, price_range_land')
    .is('deleted_at', null);

  // エリアフィルタ
  const areaConditions = targetAreas.map(a => `desired_area.ilike.%${a}%`);
  query = query.or(areaConditions.join(','));

  // 物件種別フィルタ
  const propertyTypeConditions = propertyTypes.map(type => {
    const dbType = this.mapPropertyTypeToDb(type);
    return `desired_property_type.ilike.%${dbType}%`;
  });
  query = query.or(propertyTypeConditions.join(','));

  // データ取得
  const { data: buyers, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch buyers: ${error.message}`);
  }

  // 価格帯フィルタ（アプリケーション層）
  const filteredBuyers = this.filterByPriceRange(buyers || [], priceRange, propertyTypes);

  return {
    buyers: filteredBuyers,
    total: filteredBuyers.length,
  };
}

/**
 * エリアグループルール適用
 * ①～⑧ → ㊵も含める
 * ⑨～⑮ → ㊶も含める
 */
private applyAreaGroupRules(area: string): string[] {
  const oitaCityAreas = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
  const beppuCityAreas = ['⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮'];

  const targetAreas = [area];

  if (oitaCityAreas.includes(area)) {
    targetAreas.push('㊵');
  }

  if (beppuCityAreas.includes(area)) {
    targetAreas.push('㊶');
  }

  return targetAreas;
}

/**
 * 物件種別をDBカラム値にマッピング
 */
private mapPropertyTypeToDb(type: string): string {
  const mapping: Record<string, string> = {
    '戸建': '戸建て',
    'マンション': 'マンション',
    '土地': '土地',
  };
  return mapping[type] || type;
}

/**
 * 価格帯フィルタリング
 */
private filterByPriceRange(buyers: any[], priceRange: string, propertyTypes: string[]): any[] {
  if (priceRange === '指定なし') {
    return buyers;
  }

  return buyers.filter(buyer => {
    for (const type of propertyTypes) {
      const priceField = this.getPriceFieldForType(type);
      const buyerPrice = buyer[priceField];

      if (!buyerPrice) continue;

      if (this.matchesPriceRange(buyerPrice, priceRange)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * 物件種別に対応する価格フィールドを取得
 */
private getPriceFieldForType(type: string): string {
  const mapping: Record<string, string> = {
    '戸建': 'price_range_house',
    'マンション': 'price_range_apartment',
    '土地': 'price_range_land',
  };
  return mapping[type] || 'price_range_house';
}

/**
 * 価格帯マッチング
 */
private matchesPriceRange(buyerPrice: string, priceRange: string): boolean {
  const { min, max } = this.parsePriceRange(buyerPrice);

  switch (priceRange) {
    case '~1900万円':
      return max <= 19000000;
    case '1000万円~2999万円':
      return min >= 10000000 && max <= 29990000;
    case '2000万円以上':
      return min >= 20000000;
    default:
      return true;
  }
}

/**
 * 価格帯文字列をパース
 */
private parsePriceRange(priceStr: string): { min: number; max: number } {
  // 既存のparsePriceRangeロジックを再利用
  // 例: "1000万円〜2000万円" → { min: 10000000, max: 20000000 }
  // 実装は BuyerCandidateService.ts の parsePriceRange() を参考
}
```

---

## データモデル

### buyers テーブル（既存）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| buyer_number | TEXT | 買主番号（主キー） |
| name | TEXT | 氏名 |
| desired_area | TEXT | 希望エリア（例: "①②③㊵"） |
| desired_property_type | TEXT | 希望種別（例: "戸建て、マンション"） |
| price_range_house | TEXT | 価格帯（戸建） |
| price_range_apartment | TEXT | 価格帯（マンション） |
| price_range_land | TEXT | 価格帯（土地） |
| deleted_at | TIMESTAMP | 削除日時 |

### エリアグループルール

| 選択エリア | 追加エリア | 説明 |
|-----------|-----------|------|
| ①～⑧ | ㊵ | 大分市エリア |
| ⑨～⑮ | ㊶ | 別府市エリア |

---

## エラーハンドリング

### フロントエンド

1. **API呼び出し失敗**
   - エラーメッセージを表示
   - ローディング状態を解除

2. **必須パラメータ未入力**
   - エリアまたは物件種別が未選択の場合、空の買主リストを表示

### バックエンド

1. **必須パラメータ不足**
   - HTTPステータス: 400 Bad Request
   - エラーメッセージ: "area and propertyTypes are required"

2. **データベースエラー**
   - HTTPステータス: 500 Internal Server Error
   - エラーメッセージ: "Failed to fetch buyers: {詳細}"

---

## テスト戦略

### ユニットテスト

1. **エリアグループルール**
   - ①～⑧を選択した場合、㊵も含まれることを確認
   - ⑨～⑮を選択した場合、㊶も含まれることを確認

2. **価格帯フィルタリング**
   - "~1900万円"選択時、1900万円以下の買主のみ返却
   - "1000万円~2999万円"選択時、範囲内の買主のみ返却
   - "2000万円以上"選択時、2000万円以上の買主のみ返却

3. **物件種別フィルタリング**
   - "戸建"選択時、desired_property_typeに"戸建て"を含む買主のみ返却
   - 複数選択時、いずれかに一致する買主を返却

### 統合テスト

1. **エンドツーエンドフロー**
   - ヘッダーボタンクリック → ページ遷移
   - フィルター選択 → API呼び出し → 買主リスト表示

2. **パフォーマンステスト**
   - 2秒以内にレスポンスを返却（要件10.1）

---

## キャッシュ戦略

### バックエンドキャッシュ

**キャッシュキー**: `other-company-distribution:{area}:{priceRange}:{propertyTypes}`

**TTL**: 10分間（要件10.3）

**実装**:
```typescript
import NodeCache from 'node-cache';

const distributionCache = new NodeCache({ stdTTL: 600 }); // 10分

async getOtherCompanyDistributionBuyers(params: {
  area: string;
  priceRange: string;
  propertyTypes: string[];
}): Promise<{ buyers: any[]; total: number }> {
  const cacheKey = `${params.area}:${params.priceRange}:${params.propertyTypes.join(',')}`;
  
  const cached = distributionCache.get(cacheKey);
  if (cached) {
    return cached as { buyers: any[]; total: number };
  }

  // データ取得ロジック...

  const result = { buyers: filteredBuyers, total: filteredBuyers.length };
  distributionCache.set(cacheKey, result);
  
  return result;
}
```

---

## パフォーマンス最適化

### データベースインデックス（要件10.2）

```sql
-- desired_area カラムにGINインデックス（部分一致検索の高速化）
CREATE INDEX idx_buyers_desired_area_gin ON buyers USING gin(desired_area gin_trgm_ops);

-- desired_property_type カラムにGINインデックス
CREATE INDEX idx_buyers_desired_property_type_gin ON buyers USING gin(desired_property_type gin_trgm_ops);

-- deleted_at カラムにインデックス（削除済み除外の高速化）
CREATE INDEX idx_buyers_deleted_at ON buyers(deleted_at) WHERE deleted_at IS NULL;
```

### クエリ最適化

1. **削除済み買主の除外**: `WHERE deleted_at IS NULL`
2. **OR条件の最適化**: エリアと物件種別のOR条件を効率的に構築
3. **LIMIT句の使用**: 最大50件に制限（将来的にページネーション対応）

---

## レスポンシブデザイン（要件9）

### モバイル対応

1. **ヘッダー部分**: 縦に並べて表示
2. **買主リスト**: カード形式で表示（BuyersPage.tsxのモバイル表示を参考）

**実装例**:
```typescript
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

{isMobile ? (
  // カード形式
  <Box>
    {buyers.map(buyer => (
      <Card key={buyer.buyer_number}>
        <CardContent>
          <Typography>{buyer.name}</Typography>
          <Typography>{buyer.desired_area}</Typography>
        </CardContent>
      </Card>
    ))}
  </Box>
) : (
  // テーブル形式
  <Table>
    {/* ... */}
  </Table>
)}
```

---

## セキュリティ

### 認証・認可

- **認証**: `authenticate` ミドルウェアを使用（JWT認証）
- **認可**: 従業員のみアクセス可能

### 入力バリデーション

1. **エリア**: 有効なエリア番号（①～㊸）のみ許可
2. **価格帯**: 定義済みの選択肢のみ許可
3. **物件種別**: "戸建"、"マンション"、"土地"のみ許可

---

## デプロイ手順

### フロントエンド

1. `OtherCompanyDistributionPage.tsx` を作成
2. `App.tsx` にルートを追加
3. `BuyersPage.tsx` にボタンを追加
4. ビルド: `npm run build`
5. Vercelにデプロイ

### バックエンド

1. `backend/src/routes/buyers.ts` にエンドポイントを追加
2. `backend/src/services/BuyerService.ts` にメソッドを追加
3. データベースインデックスを作成
4. ビルド: `npm run build`
5. Vercelにデプロイ

---

## 今後の拡張

1. **ページネーション**: 買主が50件を超える場合の対応
2. **ソート機能**: 受付日、買主番号でのソート
3. **エクスポート機能**: CSV出力
4. **メール一括送信**: 選択した買主に一括でメール送信

---

## 参考資料

- 既存コード: `frontend/frontend/src/pages/BuyersPage.tsx`
- 既存コード: `backend/src/services/BuyerCandidateService.ts`（エリアフィルタリングロジック）
- 要件定義: `.kiro/specs/other-company-property-distribution/requirements.md`
