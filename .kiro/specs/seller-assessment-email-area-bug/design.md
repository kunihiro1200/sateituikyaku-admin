# 売主査定額メール面積表記バグ 修正設計

## 概要

売主リストの査定額メール送信機能において、「土地（当社調べ）」（`landAreaVerified`）および「建物（当社調べ）」（`buildingAreaVerified`）の値がメール本文に反映されないバグを修正する。

**バグの影響**: 画面上で「土地（当社調べ）: 86㎡」「建物（当社調べ）: 63㎡」と設定されていても、送信されるメール本文には元の面積値（例: 土地50㎡、建物50㎡）が使用されてしまう。

**修正方針**: 2箇所の修正が必要。
1. `backend/src/routes/emails.ts` — `valuationData` 構築時に `landAreaVerified`/`buildingAreaVerified` を含める
2. `backend/src/services/EmailService.supabase.ts` — `generateValuationEmailTemplate` で「当社調べ」値を優先使用し、注記を付与する

---

## 用語集

- **Bug_Condition (C)**: バグが発現する条件 — `landAreaVerified` または `buildingAreaVerified` に値が設定されているにもかかわらず、メール本文に反映されない状態
- **Property (P)**: 期待される正しい動作 — 「当社調べ」の値が存在する場合はそちらを優先し、「（当社調べ）」注記を付与してメール本文に表示する
- **Preservation（保全）**: 修正によって変更してはならない既存の動作
- **`generateValuationEmailTemplate`**: `backend/src/services/EmailService.supabase.ts` 内の関数。売主情報と査定データからメール本文を生成する
- **`valuationData`**: `backend/src/routes/emails.ts` で構築されるオブジェクト。査定額・面積情報を含み、`generateValuationEmailTemplate` に渡される
- **`landAreaVerified`**: 「土地（当社調べ）」の面積値（`sellers.land_area_verified` カラム）
- **`buildingAreaVerified`**: 「建物（当社調べ）」の面積値（`sellers.building_area_verified` カラム）

---

## バグ詳細

### バグ条件

`landAreaVerified` または `buildingAreaVerified` に値が設定されている場合、メール本文の面積表記にその値が使われず、元の `landArea`/`buildingArea` が常に使用される。

**根本原因（2箇所）**:
1. `emails.ts` の `valuationData` 構築時に `landAreaVerified`/`buildingAreaVerified` が含まれていない
2. `generateValuationEmailTemplate` が `valuationData.landArea`/`valuationData.buildingArea` のみを参照し、`landAreaVerified`/`buildingAreaVerified` を参照していない

**形式的仕様:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  RETURN (seller.landAreaVerified IS NOT NULL AND seller.landAreaVerified > 0)
         OR (seller.buildingAreaVerified IS NOT NULL AND seller.buildingAreaVerified > 0)
END FUNCTION
```

### 具体例

| 状況 | landArea | landAreaVerified | buildingArea | buildingAreaVerified | 現在の出力（不具合） | 期待される出力 |
|------|----------|-----------------|--------------|---------------------|---------------------|---------------|
| 両方設定あり | 50 | 86 | 50 | 63 | `※土地50㎡、建物50㎡で算出しております。` | `※土地86㎡（当社調べ）、建物63㎡（当社調べ）で算出しております。` |
| 土地のみ設定 | 50 | 86 | 50 | null | `※土地50㎡、建物50㎡で算出しております。` | `※土地86㎡（当社調べ）、建物50㎡で算出しております。` |
| 建物のみ設定 | 50 | null | 50 | 63 | `※土地50㎡、建物50㎡で算出しております。` | `※土地50㎡、建物63㎡（当社調べ）で算出しております。` |
| 両方未設定 | 50 | null | 50 | null | `※土地50㎡、建物50㎡で算出しております。` | `※土地50㎡、建物50㎡で算出しております。`（変更なし） |

---

## 期待される動作

### 保全要件

**変更してはならない動作:**
- `landAreaVerified` も `buildingAreaVerified` も未設定の場合、メール本文は従来通り `landArea`/`buildingArea` のみを表示する（注記なし）
- 査定額（`valuationAmount1`/`valuationAmount2`/`valuationAmount3`）の計算・表示ロジックは変更しない
- メール送信・ログ保存・エラーハンドリングの既存フローは変更しない
- `generateValuationEmailTemplate` の面積表記以外の本文内容は変更しない

**スコープ:**
面積表記の1行（`※土地XX㎡、建物XX㎡で算出しております。`）のみが変更対象。それ以外の全ての動作は修正前と同一でなければならない。

---

## 仮説される根本原因

コード調査により、以下の2箇所が原因と特定された：

1. **`emails.ts` の `valuationData` 構築漏れ**:
   `valuationData` オブジェクトに `landAreaVerified`/`buildingAreaVerified` が含まれていない。`seller` オブジェクトにはこれらの値が存在するが、`valuationData` に渡されていない。

   ```typescript
   // 現在のコード（不具合）
   const valuationData = {
     valuationAmount1: seller.valuationAmount1,
     valuationAmount2: seller.valuationAmount2,
     valuationAmount3: seller.valuationAmount3,
     fixedAssetTaxRoadPrice: seller.fixedAssetTaxRoadPrice,
     // ← landAreaVerified/buildingAreaVerified が含まれていない
   };
   ```

2. **`generateValuationEmailTemplate` の参照漏れ**:
   `valuationData.landArea`/`valuationData.buildingArea` のみを参照しており、`landAreaVerified`/`buildingAreaVerified` を参照していない。

   ```typescript
   // 現在のコード（不具合）
   const landArea = valuationData.landArea || '未設定';
   const buildingArea = valuationData.buildingArea || '未設定';
   // ← landAreaVerified/buildingAreaVerified を確認していない
   ```

---

## 正確性プロパティ

Property 1: バグ条件 — 「当社調べ」面積値のメール本文への反映

_For any_ 売主データにおいて `landAreaVerified` または `buildingAreaVerified` に値が設定されている場合（`isBugCondition` が true を返す場合）、修正後の `generateValuationEmailTemplate` は、設定されている「当社調べ」の値を優先してメール本文の面積表記に使用し、「（当社調べ）」注記を付与した文字列を生成する SHALL。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: 保全 — 「当社調べ」未設定時の既存動作維持

_For any_ 売主データにおいて `landAreaVerified` も `buildingAreaVerified` も設定されていない場合（`isBugCondition` が false を返す場合）、修正後の `generateValuationEmailTemplate` は修正前と同一の結果を生成し、`landArea`/`buildingArea` のみを使用した面積表記（注記なし）を維持する SHALL。

**Validates: Requirements 3.1, 3.2, 3.3**

---

## 修正実装

### 変更箇所

**ファイル1**: `backend/src/routes/emails.ts`

**変更内容**: `valuationData` 構築時に `landAreaVerified`/`buildingAreaVerified` を追加する

```typescript
// 修正後
const valuationData = {
  valuationAmount1: seller.valuationAmount1,
  valuationAmount2: seller.valuationAmount2,
  valuationAmount3: seller.valuationAmount3,
  fixedAssetTaxRoadPrice: seller.fixedAssetTaxRoadPrice,
  landArea: seller.landArea,                         // 追加
  buildingArea: seller.buildingArea,                 // 追加
  landAreaVerified: seller.landAreaVerified,         // 追加
  buildingAreaVerified: seller.buildingAreaVerified, // 追加
};
```

---

**ファイル2**: `backend/src/services/EmailService.supabase.ts`

**関数**: `generateValuationEmailTemplate`

**変更内容**: 面積値の取得ロジックを「当社調べ」優先に変更し、注記を付与する

```typescript
// 修正後
// 土地面積: 「当社調べ」があれば優先、注記を付与
const landAreaValue = valuationData.landAreaVerified || valuationData.landArea;
const landAreaSuffix = valuationData.landAreaVerified ? '（当社調べ）' : '';
const landAreaDisplay = landAreaValue ? `${landAreaValue}㎡${landAreaSuffix}` : '未設定';

// 建物面積: 「当社調べ」があれば優先、注記を付与
const buildingAreaValue = valuationData.buildingAreaVerified || valuationData.buildingArea;
const buildingAreaSuffix = valuationData.buildingAreaVerified ? '（当社調べ）' : '';
const buildingAreaDisplay = buildingAreaValue ? `${buildingAreaValue}㎡${buildingAreaSuffix}` : '未設定';

// メール本文の面積表記行
// ※土地86㎡（当社調べ）、建物63㎡（当社調べ）で算出しております。
`※土地${landAreaDisplay}、建物${buildingAreaDisplay}で算出しております。`
```

---

## テスト戦略

### 検証アプローチ

テスト戦略は2フェーズで構成される：まず未修正コードでバグを実証するカウンター例を確認し、次に修正後の正しい動作と既存動作の保全を検証する。

### 探索的バグ条件チェック

**目的**: 修正前のコードでバグが発現することを確認し、根本原因分析を検証する。

**テスト計画**: `generateValuationEmailTemplate` に `landAreaVerified`/`buildingAreaVerified` を含む `valuationData` を渡し、メール本文に「当社調べ」が反映されないことを確認する。

**テストケース**:
1. **両方設定ありテスト**: `landAreaVerified=86`, `buildingAreaVerified=63` を設定 → 未修正コードでは `※土地50㎡、建物50㎡で算出しております。` が生成される（失敗確認）
2. **土地のみ設定テスト**: `landAreaVerified=86`, `buildingAreaVerified=null` → 未修正コードでは土地に「当社調べ」が付かない（失敗確認）
3. **建物のみ設定テスト**: `landAreaVerified=null`, `buildingAreaVerified=63` → 未修正コードでは建物に「当社調べ」が付かない（失敗確認）
4. **valuationData欠落テスト**: `emails.ts` の `valuationData` に `landAreaVerified` が含まれていないことを確認

**期待されるカウンター例**:
- `landAreaVerified=86` を設定しても、メール本文は `土地50㎡` のまま（`landArea` の値が使われる）
- 原因: `valuationData` に `landAreaVerified` が含まれていない、かつ `generateValuationEmailTemplate` が `landAreaVerified` を参照していない

### 修正チェック

**目的**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**疑似コード:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  valuationData := buildValuationData_fixed(seller)
  template := generateValuationEmailTemplate_fixed(seller, valuationData)
  ASSERT expectedBehavior(template.body, seller)
END FOR

FUNCTION expectedBehavior(body, seller)
  IF seller.landAreaVerified IS NOT NULL THEN
    ASSERT body CONTAINS "${seller.landAreaVerified}㎡（当社調べ）"
  END IF
  IF seller.buildingAreaVerified IS NOT NULL THEN
    ASSERT body CONTAINS "${seller.buildingAreaVerified}㎡（当社調べ）"
  END IF
END FUNCTION
```

### 保全チェック

**目的**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同一の結果を生成することを検証する。

**疑似コード:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT generateValuationEmailTemplate_original(seller, valuationData)
       = generateValuationEmailTemplate_fixed(seller, valuationData)
END FOR
```

**テストアプローチ**: プロパティベーステストを推奨する理由：
- 多様な面積値の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケース（0値、小数値など）を検出できる
- 「当社調べ」未設定の全ケースで動作が変わらないことを強く保証できる

**テストケース**:
1. **両方未設定の保全**: `landAreaVerified=null`, `buildingAreaVerified=null` → 修正前後で同一の出力
2. **査定額表示の保全**: 面積修正後も `valuationAmount1/2/3` の表示が変わらないことを確認
3. **メール本文構造の保全**: 面積行以外の本文内容が変わらないことを確認

### ユニットテスト

- `generateValuationEmailTemplate` に各面積値の組み合わせを渡してメール本文を検証
- `landAreaVerified` のみ設定、`buildingAreaVerified` のみ設定、両方設定、両方未設定の4パターン
- `emails.ts` の `valuationData` 構築に `landAreaVerified`/`buildingAreaVerified` が含まれることを確認

### プロパティベーステスト

- ランダムな面積値（`landArea`, `buildingArea`, `landAreaVerified`, `buildingAreaVerified`）を生成し、「当社調べ」が設定されている場合は必ず注記が付くことを検証
- `landAreaVerified`/`buildingAreaVerified` が null/undefined の場合、元の面積値のみが使われることを検証
- 面積値が0の場合のエッジケースを検証

### 統合テスト

- `emails.ts` の `POST /:sellerId/send-valuation-email` エンドポイントに対して、`landAreaVerified` が設定された売主でリクエストを送信し、生成されるメール本文を確認
- `landAreaVerified`/`buildingAreaVerified` が未設定の売主でも従来通りのメール本文が生成されることを確認
