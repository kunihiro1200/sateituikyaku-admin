# デザインドキュメント: 業者フィルターボタングループ化

## 概要

`NearbyBuyersList` コンポーネントのアクションボタン行に表示されている「業者_土地」「業者_戸建」「業者_マンション」ボタンを、背景色付きのコンテナで視覚的にグループ化する。

既存の価格帯フィルターエリア（`backgroundColor: '#f0f4ff'`、`borderRadius: 1`、`border: '1px solid #c5d0e8'`）と同様のコンテナ構造を採用し、業者ボタングループには緑系の背景色（`#e8f5e9`）を使用する。

本変更はフロントエンドのUI変更のみであり、バックエンドへの変更は不要。

---

## アーキテクチャ

### 変更対象

- **ファイル**: `frontend/frontend/src/components/NearbyBuyersList.tsx`
- **変更種別**: UIコンポーネントの構造変更（JSX修正のみ）
- **バックエンド変更**: なし

### 変更の位置

現在のアクションボタン行（`{/* アクションボタン */}` セクション）内の業者フィルターボタン部分を、新しいグループコンテナ `Box` で囲む。

```
変更前:
  <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
    [メール送信] [SMS送信] [名前非表示] [PDF]
    [業者_土地] [業者_戸建]  ← 他のボタンと同列
  </Box>

変更後:
  <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
    [メール送信] [SMS送信] [名前非表示] [PDF]
    <業者ボタングループコンテナ>
      ラベル: 「業者フィルター」
      [業者_土地] [業者_戸建]
    </業者ボタングループコンテナ>
  </Box>
```

---

## コンポーネントと インターフェース

### 業者ボタングループコンテナ

業者フィルターボタンを囲む `Box` コンポーネント。既存の価格帯フィルターエリアと同様のスタイル構造を採用する。

**スタイル仕様:**

| プロパティ | 値 | 備考 |
|-----------|-----|------|
| `backgroundColor` | `'#e8f5e9'` | 緑系（価格帯フィルターの `#f0f4ff` と区別） |
| `borderRadius` | `1` | 価格帯フィルターと同じ |
| `border` | `'1px solid #a5d6a7'` | 緑系のボーダー |
| `padding` | `1` (8px) | ボタンが窮屈に見えないよう |
| `display` | `'flex'` | 内部要素を横並びに |
| `flexDirection` | `'column'` | ラベルとボタン行を縦並びに |
| `gap` | `0.5` | ラベルとボタン間のスペース |

### ラベルテキスト

業者ボタングループの目的を示す `Typography` コンポーネント。

**スタイル仕様:**

| プロパティ | 値 | 備考 |
|-----------|-----|------|
| `variant` | `'caption'` | ボタンより小さいフォントサイズ |
| `sx.color` | `'#2e7d32'` | 緑系の濃い色（`success.dark` 相当） |
| `sx.fontWeight` | `600` | 価格帯フィルターラベルと同様 |
| `sx.fontSize` | `'0.7rem'` | 価格帯フィルターラベルと同様 |

**表示テキスト:** `業者フィルター`

### 業者フィルターボタン行

ラベルの下に横並びで配置される `Box` コンポーネント。

**スタイル仕様:**

| プロパティ | 値 |
|-----------|-----|
| `display` | `'flex'` |
| `gap` | `0.5` |

---

## データモデル

本機能はUIの構造変更のみであり、データモデルの変更はない。

既存の状態変数をそのまま使用する:

- `activeAgencyFilter: AgencyFilterType` — 業者フィルターの選択状態
- `effectivePropertyType` — 物件種別（`propertyType || apiPropertyType`）
- `showLandAndHouseButtons` — 土地・戸建てボタンの表示フラグ
- `showApartmentButton` — マンションボタンの表示フラグ

---

## 実装詳細

### JSX変更箇所

**変更前（現在のコード）:**

```tsx
{/* 業者フィルターボタン（物件種別に応じて表示） */}
{showLandAndHouseButtons && (
  <>
    <Button
      variant={activeAgencyFilter === '土地' ? 'contained' : 'outlined'}
      color="success"
      size="small"
      onClick={() => handleAgencyFilterToggle('土地')}
    >
      業者_土地
    </Button>
    <Button
      variant={activeAgencyFilter === '戸建' ? 'contained' : 'outlined'}
      color="success"
      size="small"
      onClick={() => handleAgencyFilterToggle('戸建')}
    >
      業者_戸建
    </Button>
  </>
)}
{showApartmentButton && (
  <Button
    variant={activeAgencyFilter === 'マンション' ? 'contained' : 'outlined'}
    color="success"
    size="small"
    onClick={() => handleAgencyFilterToggle('マンション')}
  >
    業者_マンション
  </Button>
)}
```

**変更後（新しいコード）:**

```tsx
{/* 業者フィルターボタングループ（物件種別に応じて表示） */}
{(showLandAndHouseButtons || showApartmentButton) && (
  <Box
    sx={{
      backgroundColor: '#e8f5e9',
      borderRadius: 1,
      border: '1px solid #a5d6a7',
      p: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: '#2e7d32', fontWeight: 600, fontSize: '0.7rem' }}
    >
      業者フィルター
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {showLandAndHouseButtons && (
        <>
          <Button
            variant={activeAgencyFilter === '土地' ? 'contained' : 'outlined'}
            color="success"
            size="small"
            onClick={() => handleAgencyFilterToggle('土地')}
          >
            業者_土地
          </Button>
          <Button
            variant={activeAgencyFilter === '戸建' ? 'contained' : 'outlined'}
            color="success"
            size="small"
            onClick={() => handleAgencyFilterToggle('戸建')}
          >
            業者_戸建
          </Button>
        </>
      )}
      {showApartmentButton && (
        <Button
          variant={activeAgencyFilter === 'マンション' ? 'contained' : 'outlined'}
          color="success"
          size="small"
          onClick={() => handleAgencyFilterToggle('マンション')}
        >
          業者_マンション
        </Button>
      )}
    </Box>
  </Box>
)}
```

### アクションボタン行の `alignItems` 追加

業者ボタングループが縦方向に複数行を持つため、親の `Box` に `alignItems: 'center'` を追加して垂直方向の中央揃えを行う。

```tsx
<Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
```

---

## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性または動作のことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 物件種別に応じた業者ボタングループの表示制御

*For any* `effectivePropertyType` の値に対して、土地・戸建て系の値（`isLand` または `isDetachedHouse` が true）の場合は業者ボタングループに「業者_土地」と「業者_戸建」ボタンが含まれ、マンション系の値（`isApartment` が true）の場合は「業者_マンション」ボタンのみが含まれ、それ以外（null含む）の場合は業者ボタングループ自体が表示されない

**Validates: Requirements 1.1, 1.5, 1.6, 1.7, 3.3**

### Property 2: 業者フィルタートグル動作の維持

*For any* 現在の `activeAgencyFilter` 状態と任意の業者フィルタータイプのクリック操作に対して、同じフィルタータイプをクリックした場合は `null`（解除）になり、異なるフィルタータイプをクリックした場合はそのフィルタータイプに排他的に切り替わる。またアクティブなボタンは `variant="contained"`、非アクティブなボタンは `variant="outlined"` で表示される

**Validates: Requirements 3.1, 3.2**

### Property 3: 業者フィルターと価格帯フィルターのAND結合維持

*For any* 業者フィルター状態と価格帯フィルター状態の組み合わせに対して、`filteredBuyers` は業者フィルターを通過した買主のうち価格帯フィルターも通過した買主のみを含む（AND結合）

**Validates: Requirements 3.4**

---

## エラーハンドリング

本機能はUIの構造変更のみであり、新たなエラーハンドリングは不要。

既存のエラーハンドリング（APIエラー、ローディング状態）はそのまま維持される。

`effectivePropertyType` が null または未知の値の場合、`showLandAndHouseButtons` と `showApartmentButton` がともに `false` となり、業者ボタングループ全体が非表示になる（要件 1.7 を満たす）。

---

## テスト戦略

### PBT適用性の評価

本機能はUIコンポーネントの構造変更が主体であるが、以下の純粋関数ロジックが存在するためPBTが部分的に適用可能:

- `filterBuyersByAgency`: 業者フィルタリング純粋関数
- `handleAgencyFilterToggle`: フィルター状態のトグルロジック
- `effectivePropertyType` に基づくボタン表示制御ロジック

UIレンダリング部分（スタイル、レイアウト）はスナップショットテストを使用する。

### ユニットテスト

**対象: 業者ボタングループの表示制御**

- `effectivePropertyType` が「土地」の場合、業者ボタングループが表示され「業者_土地」「業者_戸建」ボタンが含まれること
- `effectivePropertyType` が「戸建て」の場合、業者ボタングループが表示され「業者_土地」「業者_戸建」ボタンが含まれること
- `effectivePropertyType` が「マンション」の場合、業者ボタングループが表示され「業者_マンション」ボタンのみが含まれること
- `effectivePropertyType` が null の場合、業者ボタングループが表示されないこと
- `effectivePropertyType` が未知の値の場合、業者ボタングループが表示されないこと

**対象: ラベル表示**

- 業者ボタングループが表示される場合、「業者フィルター」ラベルが表示されること

**対象: スタイル整合性**

- 業者ボタングループのスタイル（`backgroundColor: '#e8f5e9'`、`borderRadius: 1`、`border: '1px solid #a5d6a7'`）が適用されていること
- ラベルのスタイル（`variant="caption"`、`color: '#2e7d32'`）が適用されていること

### プロパティベーステスト

PBTライブラリ: **fast-check**（TypeScript/React プロジェクトの標準的な選択）

各プロパティテストは最低100回のイテレーションで実行する。

**Property 1 のテスト実装方針:**

```typescript
// Feature: seller-nearby-buyer-agency-button-group, Property 1: 物件種別に応じた業者ボタングループの表示制御
fc.assert(
  fc.property(
    fc.oneof(
      fc.constant('土地'), fc.constant('土'), // 土地系
      fc.constant('戸建て'), fc.constant('戸建'), fc.constant('戸'), // 戸建て系
      fc.constant('マンション'), fc.constant('マ'), // マンション系
      fc.constant(null), fc.constant(''), fc.constant('その他') // 無効値
    ),
    (propertyType) => {
      // コンポーネントをレンダリングし、表示制御を確認
    }
  ),
  { numRuns: 100 }
);
```

**Property 2 のテスト実装方針:**

```typescript
// Feature: seller-nearby-buyer-agency-button-group, Property 2: 業者フィルタートグル動作の維持
fc.assert(
  fc.property(
    fc.oneof(fc.constant('土地'), fc.constant('戸建'), fc.constant('マンション'), fc.constant(null)),
    fc.oneof(fc.constant('土地'), fc.constant('戸建'), fc.constant('マンション')),
    (currentFilter, clickedFilter) => {
      const result = currentFilter === clickedFilter ? null : clickedFilter;
      // handleAgencyFilterToggle の純粋ロジックを検証
    }
  ),
  { numRuns: 100 }
);
```

**Property 3 のテスト実装方針:**

```typescript
// Feature: seller-nearby-buyer-agency-button-group, Property 3: 業者フィルターと価格帯フィルターのAND結合維持
fc.assert(
  fc.property(
    fc.array(fc.record({ /* NearbyBuyer の任意データ */ })),
    fc.oneof(fc.constant('土地'), fc.constant('戸建'), fc.constant('マンション'), fc.constant(null)),
    fc.set(fc.constantFrom(...PRICE_RANGE_KEYS)),
    (buyers, agencyFilter, priceRanges) => {
      const agencyFiltered = filterBuyersByAgency(buyers, agencyFilter);
      const andFiltered = filterBuyersByPrice(agencyFiltered, new Set(priceRanges), propertyType);
      // AND結合の検証: andFiltered ⊆ agencyFiltered かつ andFiltered ⊆ priceFiltered
    }
  ),
  { numRuns: 100 }
);
```

### スナップショットテスト

- 各 `effectivePropertyType` パターン（土地、戸建て、マンション、null）でのコンポーネントスナップショット
- 業者ボタングループのスタイルが価格帯フィルターエリアと同様の構造を持つことを確認
