# 買主エリア半径検索機能ガイド

## 概要

物件所在地または住所を入力して、その半径3km圏内で問い合わせてきた買主を検索する機能です。

---

## 機能仕様

### 検索条件

1. **住所または物件番号**: 
   - 住所（例: `大分市大津町`）
   - 物件番号（例: `AA9926`）
2. **価格帯**: 指定なし、~1900万円、1000万円~2999万円、2000万円以上
3. **物件種別**: 戸建、マンション、土地（複数選択可）

### フィルタリング条件

以下の条件を満たす買主のみ表示：

1. **座標データあり**: `desired_area_lat`, `desired_area_lng`が設定されている
2. **半径3km圏内**: 入力した住所/物件番号から3km以内
3. **最新状況**: 「買」を含まない、かつ「D」で始まらない
4. **物件種別**: 選択した種別を含む
5. **価格帯**: 選択した価格帯に該当

### ソート順

受付日の新しい順（`reception_date DESC`）

---

## データベース構造

### 買主テーブル（`buyers`）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `desired_area_lat` | DECIMAL(10, 8) | 希望エリアの緯度 |
| `desired_area_lng` | DECIMAL(11, 8) | 希望エリアの経度 |

**インデックス**: `idx_buyers_area_coordinates` (desired_area_lat, desired_area_lng)

### 物件リストテーブル（`property_listings`）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `latitude` | DECIMAL(10, 8) | 物件の緯度 |
| `longitude` | DECIMAL(11, 8) | 物件の経度 |

**インデックス**: `idx_property_listings_coordinates` (latitude, longitude)

---

## 座標取得ロジック

### 1. 物件番号の場合（優先）

物件番号（`AA9926`など）を入力した場合：

```typescript
// property_listingsテーブルから座標を取得
const { data: property } = await supabase
  .from('property_listings')
  .select('latitude, longitude')
  .eq('property_number', propertyNumber)
  .single();
```

**メリット**: 物件リストのGoogleMapから取得した正確な座標を使用

### 2. 住所の場合（フォールバック）

住所を入力した場合、またはproperty_listingsに座標がない場合：

```typescript
// Google Maps Geocoding APIで座標を取得
const geocodingService = new GeocodingService();
const coordinates = await geocodingService.geocodeAddress(address);
```

**自動補完**: 「大分市大津町」→「大分県大分市大津町」

---

## 距離計算

Haversine公式を使用して2点間の距離を計算：

```typescript
const distance = geocodingService.calculateDistance(
  searchLat,
  searchLng,
  buyerLat,
  buyerLng
);
```

**単位**: km（小数点第2位まで表示）

---

## バッチ処理

### 座標バックフィル

既存の買主の`desired_area`から座標を取得して保存：

```bash
npx tsx backend/scripts/backfill-buyer-coordinates.ts
```

**処理内容**:
1. `desired_area`があり、座標がない買主を取得
2. 実際の住所が含まれている買主のみフィルタリング（3文字以上、漢字・ひらがな・カタカナを含む）
3. Google Maps Geocoding APIで座標を取得
4. `desired_area_lat`, `desired_area_lng`に保存

**レート制限対策**: 200msの遅延

---

## API仕様

### エンドポイント

```
POST /api/buyers/radius-search
```

### リクエスト

```json
{
  "address": "大分市大津町",
  "priceRange": "1000万円~2999万円",
  "propertyTypes": ["マンション"]
}
```

### レスポンス

```json
{
  "buyers": [
    {
      "buyer_number": "7291",
      "name": "まつもと　よしたか",
      "desired_area": "①中学校（王子、碩田学園、大分西）",
      "desired_property_type": "戸建、マンション",
      "price_range_apartment": "~1900万円",
      "latest_status": "C:希望の物件があれば時期関係なくすぐに購入したい方",
      "reception_date": "2024-01-15",
      "distance": 1.66,
      "inquired_property_address": "大分市大津町1-1-1"
    }
  ],
  "total": 1
}
```

---

## フロントエンド

### ページ

`frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx`

### 表示項目

| カラム | 説明 |
|--------|------|
| 買主番号 | クリックで買主詳細ページを開く |
| 氏名 | 買主名 |
| 距離 | 検索地点からの距離（km） |
| 希望エリア | 買主の希望エリア |
| 問合せ物件所在地 | 最新の問い合わせ物件の所在地 |
| 希望種別 | 希望物件種別 |
| 希望価格 | 物件種別に応じた価格帯 |
| 最新状況 | 最初のアルファベットのみ表示 |
| ヒアリング項目 | 問い合わせ時のヒアリング内容 |
| 受付日 | 問い合わせ受付日 |

---

## 環境変数

### バックエンド（`.env.local`）

```env
# Google Maps API（Geocoding API用）
GOOGLE_MAPS_API_KEY=AIzaSyCjK1gbrfWUQ5uuvd_3VOZVvTFjQVmxP3E

# Supabase
SUPABASE_URL=https://krxhrbtlgfjzsseegaqq.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### フロントエンド（`.env.local`）

```env
VITE_API_URL=https://sateituikyaku-admin-backend.vercel.app
```

---

## トラブルシューティング

### 買主が表示されない

**原因1**: 座標データがない

```sql
-- 座標がない買主を確認
SELECT buyer_number, name, desired_area, desired_area_lat, desired_area_lng
FROM buyers
WHERE desired_area IS NOT NULL
  AND (desired_area_lat IS NULL OR desired_area_lng IS NULL)
  AND deleted_at IS NULL;
```

**解決策**: バッチ処理を実行、または手動で座標を設定

**原因2**: 希望エリアが実際の住所でない

例: 「①中学校（王子、碩田学園、大分西）」

**解決策**: 手動で座標を設定

```typescript
// 大分市役所の座標を使用
const { error } = await supabase
  .from('buyers')
  .update({
    desired_area_lat: 33.2382,
    desired_area_lng: 131.6126,
  })
  .eq('buyer_number', '7291');
```

### ジオコーディングエラー

**エラー**: `geocoding failed: Unable to convert address to coordinates`

**原因**: Google Maps APIで住所が見つからない

**解決策**:
1. 住所を詳しく入力（例: 「大分市大津町」→「大分県大分市大津町1-1-1」）
2. 物件番号を使用（例: `AA9926`）

---

## キャッシュ

検索結果は10分間キャッシュされます（`NodeCache`, TTL: 600秒）

**キャッシュキー**: `radius:{address}:{priceRange}:{propertyTypes}`

**キャッシュクリア**: サーバー再起動、または10分経過後

---

## 関連ファイル

### バックエンド

- `backend/src/services/BuyerService.ts` - `getBuyersByRadiusSearch()`メソッド
- `backend/src/services/GeocodingService.ts` - ジオコーディングと距離計算
- `backend/src/routes/buyers.ts` - `POST /api/buyers/radius-search`エンドポイント
- `backend/migrations/111_add_buyer_area_coordinates.sql` - 座標カラム追加
- `backend/scripts/backfill-buyer-coordinates.ts` - 座標バックフィル

### フロントエンド

- `frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx` - UI

---

## 今後の改善案

1. **座標の自動更新**: 買主の`desired_area`が変更されたら自動的に座標を更新
2. **半径の可変化**: 3km固定ではなく、ユーザーが半径を選択できるようにする
3. **地図表示**: 検索結果を地図上に表示
4. **複数地点検索**: 複数の住所/物件番号を入力して、それぞれの半径圏内の買主を検索

---

**最終更新日**: 2026年4月8日  
**作成理由**: 買主エリア半径検索機能の実装記録と運用ガイド
