# マッチング機能アーキテクチャ

## ⚠️ 重要：売りたい/買いたいマッチングの違い

KIROが「売りたいセクションの自由入力欄が空ですのでマッチングしません」と言うことがあるが、これは**誤り**。
売りたいマッチングには自由入力欄は存在しない。

---

## 🔵 売りたいマッチング（Sell-side Matching）

### ボタン数：1つのみ

**場所**: 売主リスト（通話モードページ）の物件情報セクション  
**ボタン名**: 「この物件と買主をマッチング」

### データ取得元：物件情報から自動取得

売りたいマッチングの条件（エリア・種別）は**ユーザー入力欄がない**。
以下の物件情報から自動的に取得される：

1. **マッチングエリア（`match_areas`）**:
   - 物件の `address` フィールドから抽出
   - `/api/calculate-distribution-areas` APIを使用して市区町村→エリア番号に変換
   - 例: `別府市石垣東` → `⑮別府`

2. **物件種別（`match_property_types`）**:
   - 物件の `property_type` フィールドから変換
   - マッピング: `マ` → `マンション`, `戸` → `戸建て`, `土` → `土地`, `他` → `その他`

### 実装箇所

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

```typescript
// 「この物件と買主をマッチング」ボタンのハンドラ
const handleMatchBuyers = async () => {
  // 1. 物件住所からエリアを取得
  const areas = await fetchDistributionAreas(property.address);
  
  // 2. 物件種別を変換
  const propertyTypes = mapPropertyTypeToMatchType(property.property_type);
  
  // 3. 自動的にmatch_areas, match_property_typesをセット
  await updateMatchingIntent({
    match_areas: areas,
    match_property_types: propertyTypes,
    ...
  });
};
```

### 注意事項

- **自由入力欄は存在しない**
- ユーザーが手動でエリアや種別を選択する画面はない
- ボタンを押すだけで物件情報から自動的に条件が設定される

---

## 🔵 買いたいマッチング（Buy-side Matching）

### ボタン数：2つ

#### ボタン1: 売主リストの「マッチング（買いたい）」セクション

**場所**: 売主リスト（通話モードページ）のマッチング（買いたい）セクション  
**ボタン名**: 「売主をマッチング」

**データ取得元**: 売主の買いたい希望条件（自由入力欄）
- `buy_match_areas`: エリア選択（Autocomplete）
- `buy_match_property_types`: 種別選択（Autocomplete）
- `buy_comments`: その他条件（テキスト入力）

#### ボタン2: 買主リストの「希望条件」セクション

**場所**: 買主リスト（通話モードページ）の希望条件セクション  
**ボタン名**: 「売主をマッチング」

**データ取得元**: 買主の希望条件（自由入力欄）
- `match_areas`: エリア選択（Autocomplete）
- `match_property_types`: 種別選択（Autocomplete）
- `desired_property_type`: 種別フィールド（単一選択）
- `comments`: その他条件（テキスト入力）

### 実装箇所

**ファイル**: `frontend/frontend/src/components/MatchingIntentPanel.tsx`

```typescript
// ユーザーがAutocompleteでエリア・種別を選択
<Autocomplete
  multiple
  options={AREA_OPTIONS}
  value={matchAreas}
  onChange={(_, newValue) => setMatchAreas(newValue)}
/>

<Autocomplete
  multiple
  options={PROPERTY_TYPE_OPTIONS}
  value={matchPropertyTypes}
  onChange={(_, newValue) => setMatchPropertyTypes(newValue)}
/>
```

---

## 📊 まとめ表

| マッチング種別 | ボタン数 | データ取得元 | 自由入力欄 |
|---|---|---|---|
| **売りたい** | 1つ | 物件情報（address, property_type） | ❌ なし |
| **買いたい** | 2つ | 売主/買主の希望条件入力欄 | ✅ あり |

---

## 🚨 よくある誤解

### ❌ 間違い
> 「売りたいセクションの自由入力欄が空ですのでマッチングしません」

### ✅ 正しい理解
売りたいマッチングには自由入力欄が存在しない。
「この物件と買主をマッチング」ボタンを押すと、物件の住所と種別から自動的にマッチング条件が設定される。

---

## 🔧 デバッグ時の確認ポイント

### 売りたいマッチングが動作しない場合

1. 物件の `address` フィールドが空でないか確認
2. 物件の `property_type` フィールドが設定されているか確認
3. `/api/calculate-distribution-areas` APIが正常に動作しているか確認
4. `sellers` テーブルの `match_areas`, `match_property_types` カラムが存在するか確認

### 買いたいマッチングが動作しない場合

1. ユーザーがエリアまたは種別を選択したか確認
2. `sellers.buy_match_areas`, `sellers.buy_match_property_types` カラムが存在するか確認
3. `buyers.match_areas`, `buyers.match_property_types` カラムが存在するか確認

---

**最終更新日**: 2026年8月  
**関連ファイル**: 
- `frontend/frontend/src/pages/CallModePage.tsx`
- `frontend/frontend/src/components/MatchingIntentPanel.tsx`
- `backend/src/services/MatchingIntentService.ts`
- `backend/src/routes/sellers.ts`
