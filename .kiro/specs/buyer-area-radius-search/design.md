# 設計ドキュメント：買主エリア半径検索機能

## 概要

買主リストの「他社物件新着配信」機能を改善し、エリア選択をボタン形式からテキスト入力形式に変更します。ユーザーが住所を手入力すると、Google Maps APIを使用してその住所を地理座標に変換し、半径3km圏内で条件に合致する買主を自動的に検索・表示します。

### 主な変更点

1. **UIの変更**: エリア選択ボタン → 住所入力テキストボックス
2. **ジオコーディング**: Google Maps APIを使用して住所を緯度経度に変換
3. **半径検索**: Haversine公式を使用して半径3km圏内の買主を検索
4. **データベース最適化**: 地理座標インデックスの追加

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│  フロントエンド (React + TypeScript)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OtherCompanyDistributionPage.tsx                    │   │
│  │  - 住所入力テキストボックス                           │   │
│  │  - 物件種別・価格帯選択（既存）                       │   │
│  │  - 買主リスト表示（既存）                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ POST /api/buyers/radius-search
                           │ { address, priceRange, propertyTypes }
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  バックエンド (Node.js + Express + TypeScript)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  backend/src/routes/buyers.ts                        │   │
│  │  - POST /radius-search エンドポイント追加             │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  backend/src/services/BuyerService.ts                │   │
│  │  - getBuyersByRadiusSearch() メソッド追加            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  backend/src/services/GeocodingService.ts (新規)     │   │
│  │  - geocodeAddress(): 住所 → 緯度経度                 │   │
│  │  - calculateDistance(): Haversine公式                │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Google Maps Geocoding API                           │   │
│  │  - 住所 → 緯度経度変換                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  データベース (Supabase / PostgreSQL)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  buyers テーブル                                      │   │
│  │  - desired_area_lat (新規): DOUBLE PRECISION         │   │
│  │  - desired_area_lng (新規): DOUBLE PRECISION         │   │
│  │  - インデックス: (desired_area_lat, desired_area_lng)│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **ユーザー入力**: 住所、物件種別、価格帯を入力
2. **ジオコーディング**: バックエンドがGoogle Maps APIを呼び出して住所を緯度経度に変換
3. **半径検索**: Haversine公式を使用して半径3km圏内の買主を検索
4. **フィルタリング**: 最新状況、物件種別、価格帯でフィルタリング
5. **結果表示**: フロントエンドに買主リストを返却

---

## コンポーネントとインターフェース

### 1. フロントエンド

#### OtherCompanyDistributionPage.tsx（変更）

**変更内容**:
- エリア選択ドロップダウンを住所入力テキストボックスに変更
- APIエンドポイントを`/api/buyers/other-company-distribution`から`/api/buyers/radius-search`に変更

**新しいUI**:
```typescript
<TextField
  label="住所を入力してください（例: 大分県大分市府内町1-1-1）"
  value={address}
  onChange={(e) => setAddress(e.target.value)}
  fullWidth
  helperText="入力した住所の半径3km圏内で買主を検索します"
/>
```

**APIリクエスト**:
```typescript
const response = await api.post('/api/buyers/radius-search', {
  address: address,
  priceRange: selectedPriceRange,
  propertyTypes: selectedPropertyTypes,
});
```

### 2. バックエンド

#### backend/src/routes/buyers.ts（追加）

**新しいエンドポイント**:
```typescript
// 半径検索用の買主取得
router.post('/radius-search', authenticate, async (req: Request, res: Response) => {
  try {
    const { address, priceRange, propertyTypes } = req.body;

    // バリデーション
    if (!address || !propertyTypes || propertyTypes.length === 0) {
      return res.status(400).json({ 
        error: 'address and propertyTypes are required' 
      });
    }

    const result = await buyerService.getBuyersByRadiusSearch({
      address,
      priceRange: priceRange || '指定なし',
      propertyTypes,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching buyers by radius:', error);
    
    // ジオコーディングエラーの場合
    if (error.message.includes('geocoding')) {
      return res.status(400).json({ 
        error: '住所を地理座標に変換できませんでした。住所を確認してください。' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});
```

#### backend/src/services/BuyerService.ts（追加）

**新しいメソッド**:
```typescript
/**
 * 半径検索で買主を取得
 * @param params 検索パラメータ（住所、価格帯、物件種別）
 * @returns 買主リストと総数
 */
async getBuyersByRadiusSearch(params: {
  address: string;
  priceRange: string;
  propertyTypes: string[];
}): Promise<{ buyers: any[]; total: number }> {
  const { address, priceRange, propertyTypes } = params;

  console.log('[getBuyersByRadiusSearch] params:', { address, priceRange, propertyTypes });

  // キャッシュキー生成
  const cacheKey = `radius:${address}:${priceRange}:${propertyTypes.join(',')}`;
  
  // キャッシュチェック
  const cached = distributionCache.get(cacheKey);
  if (cached) {
    console.log('[getBuyersByRadiusSearch] Cache hit');
    return cached as { buyers: any[]; total: number };
  }

  // 1. 住所を地理座標に変換
  const geocodingService = new GeocodingService();
  const coordinates = await geocodingService.geocodeAddress(address);
  
  if (!coordinates) {
    throw new Error('geocoding failed: Unable to convert address to coordinates');
  }

  console.log('[getBuyersByRadiusSearch] coordinates:', coordinates);

  // 2. 半径3km圏内の買主を検索
  // まず、全買主を取得（desired_area_lat, desired_area_lngがnullでないもの）
  const { data: allBuyers, error } = await this.supabase
    .from('buyers')
    .select('buyer_number, name, desired_area, desired_property_type, price_range_house, price_range_apartment, price_range_land, reception_date, phone_number, email, latest_status, inquiry_hearing, desired_area_lat, desired_area_lng')
    .is('deleted_at', null)
    .not('desired_area_lat', 'is', null)
    .not('desired_area_lng', 'is', null);

  if (error) {
    console.error('[getBuyersByRadiusSearch] Query error:', error);
    throw new Error(`Failed to fetch buyers: ${error.message}`);
  }

  console.log('[getBuyersByRadiusSearch] allBuyers count:', allBuyers?.length || 0);

  // 3. 半径3km圏内の買主をフィルタリング
  const RADIUS_KM = 3;
  const buyersWithinRadius = (allBuyers || []).filter(buyer => {
    const distance = geocodingService.calculateDistance(
      coordinates.lat,
      coordinates.lng,
      buyer.desired_area_lat,
      buyer.desired_area_lng
    );
    return distance <= RADIUS_KM;
  });

  console.log('[getBuyersByRadiusSearch] buyersWithinRadius count:', buyersWithinRadius.length);

  // 4. 最新状況でフィルタリング（"買"または"D"を除外）
  const statusFiltered = buyersWithinRadius.filter(buyer => {
    if (!buyer.latest_status) return true;
    return !buyer.latest_status.includes('買') && buyer.latest_status !== 'D';
  });

  console.log('[getBuyersByRadiusSearch] statusFiltered count:', statusFiltered.length);

  // 5. 物件種別でフィルタリング
  const propertyTypeFiltered = statusFiltered.filter(buyer => {
    if (!buyer.desired_property_type) return false;
    
    const dbTypes = propertyTypes.map(type => this.mapPropertyTypeToDb(type));
    return dbTypes.some(dbType => buyer.desired_property_type.includes(dbType));
  });

  console.log('[getBuyersByRadiusSearch] propertyTypeFiltered count:', propertyTypeFiltered.length);

  // 6. 価格帯でフィルタリング
  const filteredBuyers = this.filterByPriceRange(propertyTypeFiltered, priceRange, propertyTypes);

  console.log('[getBuyersByRadiusSearch] filteredBuyers count:', filteredBuyers.length);

  // 7. 距離でソート（近い順）
  const sortedBuyers = filteredBuyers.map(buyer => ({
    ...buyer,
    distance: geocodingService.calculateDistance(
      coordinates.lat,
      coordinates.lng,
      buyer.desired_area_lat,
      buyer.desired_area_lng
    ),
  })).sort((a, b) => a.distance - b.distance);

  const result = {
    buyers: sortedBuyers,
    total: sortedBuyers.length,
  };

  // キャッシュに保存（TTL: 10分）
  distributionCache.set(cacheKey, result);

  return result;
}
```

#### backend/src/services/GeocodingService.ts（新規）

**新しいサービス**:
```typescript
import axios from 'axios';

export interface Coordinates {
  lat: number;
  lng: number;
}

export class GeocodingService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY!;
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not set');
    }
  }

  /**
   * 住所を地理座標に変換
   * @param address 住所（例: "大分県大分市府内町1-1-1"）
   * @returns 緯度経度、または変換失敗時はnull
   */
  async geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: address,
          key: this.apiKey,
          language: 'ja',
          region: 'jp',
        },
      });

      if (response.data.status !== 'OK' || response.data.results.length === 0) {
        console.error('[GeocodingService] Geocoding failed:', response.data.status);
        return null;
      }

      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    } catch (error: any) {
      console.error('[GeocodingService] Error calling Google Maps API:', error);
      return null;
    }
  }

  /**
   * Haversine公式を使用して2点間の距離を計算
   * @param lat1 地点1の緯度
   * @param lng1 地点1の経度
   * @param lat2 地点2の緯度
   * @param lng2 地点2の経度
   * @returns 距離（km）
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
```

---

## データモデル

### buyersテーブル（変更）

**新しいカラム**:

| カラム名 | 型 | NULL許可 | デフォルト | 説明 |
|---------|-----|---------|----------|------|
| `desired_area_lat` | DOUBLE PRECISION | YES | NULL | 希望エリアの緯度 |
| `desired_area_lng` | DOUBLE PRECISION | YES | NULL | 希望エリアの経度 |

**インデックス**:
```sql
CREATE INDEX idx_buyers_desired_area_coordinates 
ON buyers(desired_area_lat, desired_area_lng) 
WHERE desired_area_lat IS NOT NULL AND desired_area_lng IS NOT NULL;
```

**マイグレーションファイル**: `backend/migrations/XXX_add_buyer_area_coordinates.sql`

```sql
-- Migration: Add coordinates to buyers table for radius search
-- Description: Add latitude and longitude columns for desired area

-- Add columns
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS desired_area_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS desired_area_lng DOUBLE PRECISION;

-- Add index for efficient radius search
CREATE INDEX IF NOT EXISTS idx_buyers_desired_area_coordinates 
ON buyers(desired_area_lat, desired_area_lng) 
WHERE desired_area_lat IS NOT NULL AND desired_area_lng IS NOT NULL;

-- Add comments
COMMENT ON COLUMN buyers.desired_area_lat IS '希望エリアの緯度（半径検索用）';
COMMENT ON COLUMN buyers.desired_area_lng IS '希望エリアの経度（半径検索用）';
```

### 地理座標の初期データ投入

既存の買主データに対して、`desired_area`フィールドから地理座標を計算して`desired_area_lat`と`desired_area_lng`に保存するバッチ処理が必要です。

**バッチ処理スクリプト**: `backend/scripts/backfill-buyer-coordinates.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { GeocodingService } from '../src/services/GeocodingService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const geocodingService = new GeocodingService();

async function backfillBuyerCoordinates() {
  console.log('[backfillBuyerCoordinates] Starting...');

  // desired_areaが存在し、座標が未設定の買主を取得
  const { data: buyers, error } = await supabase
    .from('buyers')
    .select('buyer_number, desired_area')
    .not('desired_area', 'is', null)
    .is('desired_area_lat', null);

  if (error) {
    console.error('[backfillBuyerCoordinates] Error fetching buyers:', error);
    return;
  }

  console.log(`[backfillBuyerCoordinates] Found ${buyers.length} buyers to process`);

  let successCount = 0;
  let failCount = 0;

  for (const buyer of buyers) {
    try {
      // desired_areaから住所を抽出（例: "①中学校（王子、碩田学園、大分西）" → "大分県大分市王子"）
      const address = extractAddress(buyer.desired_area);
      
      if (!address) {
        console.log(`[backfillBuyerCoordinates] Skipping buyer ${buyer.buyer_number}: Unable to extract address`);
        failCount++;
        continue;
      }

      // ジオコーディング
      const coordinates = await geocodingService.geocodeAddress(address);
      
      if (!coordinates) {
        console.log(`[backfillBuyerCoordinates] Skipping buyer ${buyer.buyer_number}: Geocoding failed`);
        failCount++;
        continue;
      }

      // データベース更新
      const { error: updateError } = await supabase
        .from('buyers')
        .update({
          desired_area_lat: coordinates.lat,
          desired_area_lng: coordinates.lng,
        })
        .eq('buyer_number', buyer.buyer_number);

      if (updateError) {
        console.error(`[backfillBuyerCoordinates] Error updating buyer ${buyer.buyer_number}:`, updateError);
        failCount++;
      } else {
        console.log(`[backfillBuyerCoordinates] Updated buyer ${buyer.buyer_number}: ${coordinates.lat}, ${coordinates.lng}`);
        successCount++;
      }

      // レート制限対策（Google Maps APIは1秒あたり50リクエストまで）
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[backfillBuyerCoordinates] Error processing buyer ${buyer.buyer_number}:`, error);
      failCount++;
    }
  }

  console.log(`[backfillBuyerCoordinates] Completed: ${successCount} success, ${failCount} failed`);
}

/**
 * desired_areaから住所を抽出
 * 例: "①中学校（王子、碩田学園、大分西）" → "大分県大分市王子"
 */
function extractAddress(desiredArea: string): string | null {
  // エリア番号と中学校名を除去して、最初の地名を抽出
  const match = desiredArea.match(/（([^、）]+)/);
  if (match && match[1]) {
    return `大分県大分市${match[1]}`;
  }
  
  // ㊵大分、㊶別府の場合
  if (desiredArea.includes('㊵大分')) {
    return '大分県大分市';
  }
  if (desiredArea.includes('㊶別府')) {
    return '大分県別府市';
  }
  
  return null;
}

backfillBuyerCoordinates();
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械が検証できる正確性保証の橋渡しをします。*


### プロパティリフレクション

prework分析の結果、以下のプロパティが特定されました：

**PROPERTY分類された要件**:
- 1.2: 日本語住所文字列の受け入れ
- 2.1: ジオコーディング成功
- 3.1: 半径3km圏内の買主検索
- 3.2: 距離計算の実行
- 3.3: Haversine公式の正確性
- 3.4: 距離順ソート
- 4.1: "買"を含む買主の除外
- 4.2: "D"の買主の除外
- 4.3: 空白/nullの買主の包含
- 5.3: 物件種別フィルタリング
- 6.2: 価格範囲の受け入れ
- 6.3: 価格帯フィルタリング
- 6.5: 価格範囲の重複判定

**冗長性の確認**:

1. **4.1, 4.2, 4.3は統合可能**: これらは全て最新状況フィールドによるフィルタリングに関するものです。1つの包括的なプロパティ「最新状況フィルタリング」に統合できます。

2. **3.1と3.2は統合可能**: 半径3km圏内の検索は距離計算に依存しています。これらは1つのプロパティ「半径検索」に統合できます。

3. **6.2と6.3は統合可能**: 価格範囲の受け入れと価格帯フィルタリングは密接に関連しています。1つのプロパティ「価格帯フィルタリング」に統合できます。

**最終的なプロパティリスト**:

1. ジオコーディング成功（2.1）
2. Haversine公式の正確性（3.3）
3. 半径検索（3.1 + 3.2統合）
4. 距離順ソート（3.4）
5. 最新状況フィルタリング（4.1 + 4.2 + 4.3統合）
6. 物件種別フィルタリング（5.3）
7. 価格帯フィルタリング（6.2 + 6.3 + 6.5統合）

---

### プロパティ1: ジオコーディング成功

*任意の*有効な日本の住所文字列に対して、ジオコーディングサービスは緯度経度の座標を返すべきである

**検証要件**: 2.1

**テスト戦略**: 
- ランダムな有効な日本の住所を生成（都道府県、市区町村、町名を組み合わせ）
- ジオコーディングサービスを呼び出す（Google Maps APIをモック）
- 緯度経度が返されることを確認
- 緯度が-90〜90、経度が-180〜180の範囲内であることを確認

---

### プロパティ2: Haversine公式の正確性

*任意の*2点の地理座標（緯度経度）に対して、Haversine公式で計算された距離は、既知の距離と一致するべきである（誤差±1%以内）

**検証要件**: 3.3

**テスト戦略**:
- 既知の距離を持つ2点の座標ペアを生成（例: 東京駅と大阪駅の距離は約400km）
- Haversine公式で距離を計算
- 計算結果が既知の距離と一致することを確認（誤差±1%以内）
- 距離は常に非負であることを確認

---

### プロパティ3: 半径検索

*任意の*検索座標と買主リストに対して、半径3km圏内の買主のみが検索結果に含まれるべきである

**検証要件**: 3.1, 3.2

**テスト戦略**:
- ランダムな検索座標を生成
- ランダムな買主リストを生成（各買主に希望エリア座標を設定）
- 半径検索を実行
- 結果に含まれる全ての買主の距離が3km以下であることを確認
- 結果に含まれない買主の距離が3kmより大きいことを確認

---

### プロパティ4: 距離順ソート

*任意の*買主リストに対して、検索結果は距離の近い順にソートされるべきである

**検証要件**: 3.4

**テスト戦略**:
- ランダムな買主リストを生成（各買主に距離を設定）
- 検索結果を取得
- 結果がソート済みであることを確認（i番目の距離 ≤ i+1番目の距離）

---

### プロパティ5: 最新状況フィルタリング

*任意の*買主リストに対して、検索結果は以下の条件を満たすべきである：
- 最新状況に"買"を含む買主は除外される
- 最新状況が"D"の買主は除外される
- 最新状況が空白またはnullの買主は含まれる

**検証要件**: 4.1, 4.2, 4.3

**テスト戦略**:
- ランダムな買主リストを生成（最新状況に"買"、"D"、空白、nullを含む）
- 検索結果を取得
- 結果に"買"を含む買主が含まれないことを確認
- 結果に"D"の買主が含まれないことを確認
- 結果に空白またはnullの買主が含まれることを確認

---

### プロパティ6: 物件種別フィルタリング

*任意の*買主リストと選択された物件種別に対して、検索結果は選択された種別を希望する買主のみを含むべきである

**検証要件**: 5.3

**テスト戦略**:
- ランダムな買主リストを生成（各買主に希望物件種別を設定）
- ランダムな物件種別を選択（戸建、マンション、土地）
- 検索結果を取得
- 結果に含まれる全ての買主が選択された種別を希望していることを確認

---

### プロパティ7: 価格帯フィルタリング

*任意の*買主リストと指定された価格帯に対して、検索結果は以下の条件を満たすべきである：
- 買主の希望価格範囲と指定価格帯が重複する場合、その買主は結果に含まれる
- 買主の希望価格範囲と指定価格帯が重複しない場合、その買主は結果に含まれない

**検証要件**: 6.2, 6.3, 6.5

**テスト戦略**:
- ランダムな買主リストを生成（各買主に希望価格範囲を設定）
- ランダムな価格帯を指定（例: 1000万円〜2999万円）
- 検索結果を取得
- 結果に含まれる全ての買主の希望価格範囲が指定価格帯と重複することを確認
- 結果に含まれない買主の希望価格範囲が指定価格帯と重複しないことを確認

---

## エラーハンドリング

### 1. ジオコーディングエラー

**エラーケース**:
- 無効な住所が入力された場合
- Google Maps APIがエラーを返した場合
- APIレート制限に達した場合

**エラーメッセージ**:
```
住所を地理座標に変換できませんでした。住所を確認してください。
```

**処理**:
- フロントエンドにエラーメッセージを表示
- エラーログに記録
- ユーザーに住所の再入力を促す

### 2. データベース接続エラー

**エラーケース**:
- データベース接続が失敗した場合
- クエリ実行中にエラーが発生した場合

**エラーメッセージ**:
```
データベース接続エラーが発生しました。しばらくしてから再度お試しください。
```

**処理**:
- フロントエンドにエラーメッセージを表示
- エラーログに記録
- リトライ機能を提供

### 3. ネットワークエラー

**エラーケース**:
- Google Maps APIへの接続が失敗した場合
- バックエンドAPIへの接続が失敗した場合

**エラーメッセージ**:
```
ネットワークエラーが発生しました。インターネット接続を確認してください。
```

**処理**:
- フロントエンドにエラーメッセージを表示
- エラーログに記録
- リトライ機能を提供

### 4. バリデーションエラー

**エラーケース**:
- 住所が空文字の場合
- 物件種別が未選択の場合

**エラーメッセージ**:
```
住所と物件種別を入力してください。
```

**処理**:
- フロントエンドにエラーメッセージを表示
- 入力フィールドをハイライト

### エラーロギング

全てのエラーは以下の情報と共にログに記録されます：

```typescript
{
  timestamp: '2026-04-10T12:34:56.789Z',
  level: 'error',
  message: 'Geocoding failed',
  context: {
    address: '大分県大分市府内町1-1-1',
    errorCode: 'ZERO_RESULTS',
    userId: 'user-123',
  },
}
```

---

## テスト戦略

### 1. 単体テスト（Unit Tests）

**対象**:
- GeocodingService.geocodeAddress()
- GeocodingService.calculateDistance()
- BuyerService.getBuyersByRadiusSearch()
- フィルタリングロジック

**ツール**: Jest

**カバレッジ目標**: 80%以上

**テストケース例**:
```typescript
describe('GeocodingService', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const service = new GeocodingService();
      const distance = service.calculateDistance(
        33.2382, 131.6126, // 大分市
        33.2795, 131.6128  // 別府市
      );
      expect(distance).toBeCloseTo(4.6, 1); // 約4.6km
    });

    it('should return 0 for same coordinates', () => {
      const service = new GeocodingService();
      const distance = service.calculateDistance(
        33.2382, 131.6126,
        33.2382, 131.6126
      );
      expect(distance).toBe(0);
    });
  });
});
```

### 2. プロパティベーステスト（Property-Based Tests）

**対象**:
- ジオコーディング成功（プロパティ1）
- Haversine公式の正確性（プロパティ2）
- 半径検索（プロパティ3）
- 距離順ソート（プロパティ4）
- 最新状況フィルタリング（プロパティ5）
- 物件種別フィルタリング（プロパティ6）
- 価格帯フィルタリング（プロパティ7）

**ツール**: fast-check（TypeScript用プロパティベーステストライブラリ）

**イテレーション数**: 最低100回

**テストケース例**:
```typescript
import fc from 'fast-check';

describe('Property-Based Tests', () => {
  describe('Property 3: Radius Search', () => {
    it('should only return buyers within 3km radius', () => {
      // Feature: buyer-area-radius-search, Property 3: 半径検索
      fc.assert(
        fc.property(
          fc.record({
            lat: fc.double({ min: -90, max: 90 }),
            lng: fc.double({ min: -180, max: 180 }),
          }),
          fc.array(
            fc.record({
              buyer_number: fc.string(),
              desired_area_lat: fc.double({ min: -90, max: 90 }),
              desired_area_lng: fc.double({ min: -180, max: 180 }),
            })
          ),
          async (searchCoords, buyers) => {
            const service = new BuyerService();
            const geocodingService = new GeocodingService();
            
            // モック: ジオコーディングは常に成功
            jest.spyOn(geocodingService, 'geocodeAddress').mockResolvedValue(searchCoords);
            
            const result = await service.getBuyersByRadiusSearch({
              address: 'test address',
              priceRange: '指定なし',
              propertyTypes: ['戸建'],
            });
            
            // 全ての結果が3km以内であることを確認
            for (const buyer of result.buyers) {
              const distance = geocodingService.calculateDistance(
                searchCoords.lat,
                searchCoords.lng,
                buyer.desired_area_lat,
                buyer.desired_area_lng
              );
              expect(distance).toBeLessThanOrEqual(3);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
```

### 3. 統合テスト（Integration Tests）

**対象**:
- Google Maps API統合
- データベースクエリ
- エンドツーエンドの検索フロー

**ツール**: Jest + Supertest

**テストケース例**:
```typescript
describe('POST /api/buyers/radius-search', () => {
  it('should return buyers within 3km radius', async () => {
    const response = await request(app)
      .post('/api/buyers/radius-search')
      .send({
        address: '大分県大分市府内町1-1-1',
        priceRange: '指定なし',
        propertyTypes: ['戸建'],
      })
      .expect(200);

    expect(response.body.buyers).toBeInstanceOf(Array);
    expect(response.body.total).toBeGreaterThanOrEqual(0);
  });

  it('should return 400 for invalid address', async () => {
    const response = await request(app)
      .post('/api/buyers/radius-search')
      .send({
        address: '',
        priceRange: '指定なし',
        propertyTypes: ['戸建'],
      })
      .expect(400);

    expect(response.body.error).toContain('address');
  });
});
```

### 4. E2Eテスト（End-to-End Tests）

**対象**:
- ユーザーが住所を入力して検索結果を取得するフロー
- エラーハンドリング

**ツール**: Playwright

**テストケース例**:
```typescript
test('should search buyers by address', async ({ page }) => {
  await page.goto('/buyers/other-company-distribution');
  
  // 住所を入力
  await page.fill('input[label="住所を入力してください"]', '大分県大分市府内町1-1-1');
  
  // 物件種別を選択
  await page.click('button:has-text("戸建")');
  
  // 検索結果を待つ
  await page.waitForSelector('table tbody tr');
  
  // 結果が表示されることを確認
  const rows = await page.locator('table tbody tr').count();
  expect(rows).toBeGreaterThan(0);
});
```

### テスト実行順序

1. 単体テスト（最速）
2. プロパティベーステスト（中速）
3. 統合テスト（中速）
4. E2Eテスト（最遅）

### CI/CDパイプライン

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:property
      - run: npm run test:integration
      - run: npm run test:e2e
```

---

## パフォーマンス最適化

### 1. データベースインデックス

**インデックス**:
```sql
CREATE INDEX idx_buyers_desired_area_coordinates 
ON buyers(desired_area_lat, desired_area_lng) 
WHERE desired_area_lat IS NOT NULL AND desired_area_lng IS NOT NULL;
```

**効果**: 地理座標による検索が高速化（O(n) → O(log n)）

### 2. キャッシュ戦略

**キャッシュキー**: `radius:{address}:{priceRange}:{propertyTypes}`

**TTL**: 10分間

**キャッシュライブラリ**: node-cache

**実装**:
```typescript
const distributionCache = new NodeCache({ stdTTL: 600 });

// キャッシュチェック
const cacheKey = `radius:${address}:${priceRange}:${propertyTypes.join(',')}`;
const cached = distributionCache.get(cacheKey);
if (cached) {
  return cached as { buyers: any[]; total: number };
}

// ... 検索処理 ...

// キャッシュに保存
distributionCache.set(cacheKey, result);
```

### 3. ジオコーディングAPIのレート制限対策

**Google Maps APIレート制限**: 1秒あたり50リクエスト

**対策**:
- バッチ処理時は100msの遅延を挿入
- エラー時は指数バックオフでリトライ
- キャッシュを活用して重複リクエストを削減

**実装**:
```typescript
// バッチ処理時の遅延
await new Promise(resolve => setTimeout(resolve, 100));

// 指数バックオフ
let retries = 0;
while (retries < 3) {
  try {
    const result = await geocodingService.geocodeAddress(address);
    return result;
  } catch (error) {
    retries++;
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
  }
}
```

### 4. クエリ最適化

**最適化前**:
```sql
SELECT * FROM buyers WHERE deleted_at IS NULL;
-- 全買主を取得してアプリケーション層でフィルタリング
```

**最適化後**:
```sql
SELECT * FROM buyers 
WHERE deleted_at IS NULL 
  AND desired_area_lat IS NOT NULL 
  AND desired_area_lng IS NOT NULL;
-- 地理座標が設定されている買主のみを取得
```

**効果**: データ転送量が削減され、検索速度が向上

---

## セキュリティ考慮事項

### 1. APIキーの保護

**Google Maps API Key**:
- 環境変数に保存（`.env`ファイル）
- Vercelの環境変数に設定
- フロントエンドには公開しない（バックエンドのみで使用）

**設定例**:
```bash
# .env
GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 2. 入力検証

**住所入力**:
- 最大文字数制限（200文字）
- SQLインジェクション対策（パラメータ化クエリ）
- XSS対策（エスケープ処理）

**実装**:
```typescript
// バリデーション
if (!address || address.length > 200) {
  return res.status(400).json({ error: 'Invalid address' });
}

// パラメータ化クエリ（Supabaseが自動的に処理）
const { data } = await supabase
  .from('buyers')
  .select('*')
  .eq('buyer_number', buyerNumber);
```

### 3. レート制限

**APIエンドポイント**:
- 1ユーザーあたり1分間に10リクエストまで
- IPアドレスベースのレート制限

**実装**:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10, // 10リクエスト
  message: 'Too many requests, please try again later.',
});

router.post('/radius-search', limiter, authenticate, async (req, res) => {
  // ...
});
```

### 4. 認証・認可

**認証**: JWT認証（既存の`authenticate`ミドルウェア）

**認可**: ログインユーザーのみがアクセス可能

---

## デプロイ手順

### 1. データベースマイグレーション

```bash
# マイグレーションファイルを作成
cd backend/migrations
touch XXX_add_buyer_area_coordinates.sql

# マイグレーションを実行
npm run migrate
```

### 2. 環境変数の設定

```bash
# Vercelに環境変数を設定
vercel env add GOOGLE_MAPS_API_KEY
```

### 3. バックエンドのデプロイ

```bash
cd backend
vercel --prod
```

### 4. フロントエンドのデプロイ

```bash
cd frontend/frontend
vercel --prod
```

### 5. 地理座標の初期データ投入

```bash
# バッチ処理スクリプトを実行
cd backend
npm run backfill-buyer-coordinates
```

### 6. 動作確認

- 他社物件新着配信ページにアクセス
- 住所を入力して検索
- 検索結果が表示されることを確認

---

## モニタリング

### 1. ログ監視

**監視対象**:
- ジオコーディングAPIエラー
- データベース接続エラー
- 検索実行時間

**ツール**: Vercel Logs

### 2. パフォーマンス監視

**監視対象**:
- 検索実行時間（目標: 3秒以内）
- APIレスポンスタイム
- キャッシュヒット率

**ツール**: Vercel Analytics

### 3. エラー監視

**監視対象**:
- ジオコーディング失敗率
- データベースエラー率
- ネットワークエラー率

**ツール**: Sentry

---

## 今後の拡張

### 1. 複数エリア検索

現在は1つの住所のみを検索できますが、将来的には複数の住所を同時に検索できるようにする。

### 2. 半径のカスタマイズ

現在は半径3kmに固定されていますが、ユーザーが半径を指定できるようにする（1km、3km、5km、10km）。

### 3. 地図表示

検索結果を地図上に表示し、視覚的に確認できるようにする。

### 4. 保存された検索条件

ユーザーが検索条件を保存し、後で再利用できるようにする。

---

## まとめ

この設計では、買主エリア半径検索機能を実装するための包括的なアプローチを提供しました。主な変更点は以下の通りです：

1. **UIの変更**: エリア選択ボタンから住所入力テキストボックスへ
2. **ジオコーディング**: Google Maps APIを使用した住所→緯度経度変換
3. **半径検索**: Haversine公式を使用した半径3km圏内の買主検索
4. **データベース最適化**: 地理座標インデックスの追加
5. **プロパティベーステスト**: 7つの正確性プロパティによる包括的なテスト

この設計により、ユーザーは任意の住所を入力して、その周辺の買主を効率的に検索できるようになります。
