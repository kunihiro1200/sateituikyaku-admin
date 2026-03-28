# 設計ドキュメント: call-mode-area-warning

## Overview

通話モードページ（`CallModePage.tsx`）の物件情報セクションに、面積データの異常を検知して担当者に注意を促す警告機能を追加する。

土地面積・建物面積の値が不自然な場合（土地 < 建物、または土地 ≤ 99）に赤文字で視覚的に警告し、確認済みボタンで警告を解除できるようにする。

バックエンドの変更は一切不要で、フロントエンドのみの変更となる。

---

## Architecture

### 変更対象

- `frontend/frontend/src/pages/CallModePage.tsx` のみ

### 状態管理

既存の React `useState` フックを使用してコンポーネント内で完結させる。

```
[面積データ] → [警告判定ロジック（useMemo）] → [警告状態] → [UI表示]
                                                      ↑
                                              [確認済みボタン] → [areaWarningDismissed state]
```

### 警告判定フロー

```
landArea, buildingArea の値を取得
  ↓
areaWarningDismissed === true → 警告なし（確認済み状態）
  ↓
条件1: landArea と buildingArea 両方に値あり かつ landArea < buildingArea
  → 土地・建物両方を赤文字
条件2: landArea に値あり かつ landArea <= 99
  → 土地のみ赤文字
  ↓
いずれかの条件が成立 → 警告メッセージ表示 + 確認済みボタン表示
```

---

## Components and Interfaces

### 新規 state

```typescript
// 確認済みフラグ（警告を非表示にする）
const [areaWarningDismissed, setAreaWarningDismissed] = useState(false);
```

### 警告判定ロジック（useMemo）

```typescript
const areaWarning = useMemo(() => {
  if (areaWarningDismissed) {
    return { landRed: false, buildingRed: false, showWarning: false };
  }

  const land = parseFloat(String(displayLandArea)) || null;
  const building = parseFloat(String(displayBuildingArea)) || null;

  // 条件1: 両方に値あり かつ 土地 < 建物
  const condition1 = land !== null && building !== null && land < building;
  // 条件2: 土地に値あり かつ 土地 <= 99
  const condition2 = land !== null && land <= 99;

  return {
    landRed: condition1 || condition2,
    buildingRed: condition1,
    showWarning: condition1 || condition2,
  };
}, [displayLandArea, displayBuildingArea, areaWarningDismissed]);
```

### 警告メッセージ・確認済みボタン（JSX）

物件種別の表示行の右側に配置する。

```tsx
{/* 物件種別行 */}
<Grid item xs={12}>
  <Typography variant="caption" color="text.secondary">物件種別</Typography>
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Typography variant="body2">
      {PROPERTY_TYPE_OPTIONS.find(o => o.value === displayPropertyType)?.label || displayPropertyType}
    </Typography>
    {areaWarning.showWarning && (
      <>
        <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
          面積確認してください！
        </Typography>
        <Button size="small" variant="outlined" color="warning"
          onClick={() => setAreaWarningDismissed(true)}>
          確認済み
        </Button>
      </>
    )}
    {areaWarningDismissed && (
      <Typography variant="body2" color="text.secondary">
        面積確認済み
      </Typography>
    )}
  </Box>
</Grid>
```

### 土地面積・建物面積の色制御

```tsx
{/* 土地面積 */}
<Typography variant="body2" sx={{ color: areaWarning.landRed ? 'error.main' : 'inherit' }}>
  {displayLandArea}
</Typography>

{/* 建物面積 */}
<Typography variant="body2" sx={{ color: areaWarning.buildingRed ? 'error.main' : 'inherit' }}>
  {displayBuildingArea}
</Typography>
```

---

## Data Models

新規のデータモデルは不要。既存の `propInfo.landArea` / `propInfo.buildingArea`（`useMemo` で計算済み）を参照する。

表示モードでは以下の変数を使用：

```typescript
const displayLandArea = (property?.landArea || seller?.landArea)?.toString() || '';
const displayBuildingArea = (property?.buildingArea || seller?.buildingArea)?.toString() || '';
```

これらは既にコンポーネント内で定義されており、警告判定ロジックはこれらを参照する。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 土地 < 建物 の場合に土地・建物両方が赤文字になる

*For any* 土地面積と建物面積の両方に値があり、かつ土地面積 < 建物面積となる数値ペアに対して、`areaWarning.landRed` と `areaWarning.buildingRed` の両方が `true` になること。また、片方のみ値がある場合や土地 >= 建物の場合は `false` になること。

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: 土地面積 ≤ 99 の場合に土地のみ赤文字になる

*For any* 土地面積が 99 以下の値に対して、`areaWarning.landRed` が `true` になること。土地面積が 100 以上の場合（かつ条件1が成立しない場合）は `false` になること。

**Validates: Requirements 2.1, 2.2**

### Property 3: 警告条件と警告表示の対応

*For any* 面積の組み合わせに対して、`areaWarning.showWarning` は `areaWarning.landRed || areaWarning.buildingRed` と等価であること。また `showWarning === true` のとき「確認済み」ボタンが表示され、`showWarning === false` のとき警告メッセージが表示されないこと。

**Validates: Requirements 3.1, 3.2, 4.1**

### Property 4: 確認済みボタンクリック後の状態変化

*For any* 警告が表示されている状態で「確認済み」ボタンをクリックした後、`areaWarningDismissed` が `true` になり、警告メッセージが非表示・赤文字が解除・「面積確認済み」テキストが表示されること。

**Validates: Requirements 4.2, 4.3, 4.4**

---

## Error Handling

- `landArea` / `buildingArea` が数値に変換できない文字列の場合、`parseFloat` が `NaN` を返すため `|| null` で null 扱いにする。これにより警告判定は発動しない（安全側に倒す）。
- `displayLandArea` / `displayBuildingArea` が空文字の場合も同様に null 扱いとなり、警告は発動しない。

---

## Testing Strategy

### ユニットテスト

警告判定ロジック（`areaWarning` の計算部分）を純粋関数として切り出し、以下のケースをテストする：

- 土地 < 建物（両方値あり）→ landRed: true, buildingRed: true, showWarning: true
- 土地 >= 建物（両方値あり）→ landRed: false, buildingRed: false, showWarning: false
- 土地 = 50（建物なし）→ landRed: true, buildingRed: false, showWarning: true
- 土地 = 100（建物なし）→ landRed: false, buildingRed: false, showWarning: false
- 土地なし、建物あり → landRed: false, buildingRed: false, showWarning: false
- 両方なし → landRed: false, buildingRed: false, showWarning: false
- areaWarningDismissed: true → 全て false

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript向け）を使用する。各テストは最低 100 回実行する。

```typescript
// Feature: call-mode-area-warning, Property 1: 土地 < 建物 の場合に土地・建物両方が赤文字になる
fc.assert(fc.property(
  fc.float({ min: 0.1, max: 999 }),
  fc.float({ min: 0.1, max: 999 }),
  (land, building) => {
    const result = calcAreaWarning(land, building, false);
    if (land < building) {
      return result.landRed === true && result.buildingRed === true && result.showWarning === true;
    } else {
      // 条件2が成立しない場合のみ false を確認
      if (land > 99) {
        return result.buildingRed === false;
      }
      return true; // 条件2が成立する場合は別プロパティで検証
    }
  }
), { numRuns: 100 });

// Feature: call-mode-area-warning, Property 2: 土地面積 ≤ 99 の場合に土地のみ赤文字になる
fc.assert(fc.property(
  fc.float({ min: 0.1, max: 99 }),
  (land) => {
    const result = calcAreaWarning(land, null, false);
    return result.landRed === true && result.buildingRed === false && result.showWarning === true;
  }
), { numRuns: 100 });

// Feature: call-mode-area-warning, Property 3: 警告条件と警告表示の対応
fc.assert(fc.property(
  fc.option(fc.float({ min: 0.1, max: 999 })),
  fc.option(fc.float({ min: 0.1, max: 999 })),
  (land, building) => {
    const result = calcAreaWarning(land ?? null, building ?? null, false);
    return result.showWarning === (result.landRed || result.buildingRed);
  }
), { numRuns: 100 });

// Feature: call-mode-area-warning, Property 4: 確認済みボタンクリック後の状態変化
fc.assert(fc.property(
  fc.float({ min: 0.1, max: 99 }), // 警告が出る値
  (land) => {
    const before = calcAreaWarning(land, null, false);
    const after = calcAreaWarning(land, null, true); // dismissed = true
    return before.showWarning === true &&
           after.landRed === false &&
           after.buildingRed === false &&
           after.showWarning === false;
  }
), { numRuns: 100 });
```

### 統合テスト（手動確認）

- 土地 < 建物のデータを持つ売主で通話モードページを開き、土地・建物両方が赤文字になることを確認
- 土地 ≤ 99 のデータを持つ売主で土地のみ赤文字になることを確認
- 「確認済み」ボタンをクリックして警告が消え「面積確認済み」が表示されることを確認
- 警告条件が成立しないデータでは警告が表示されないことを確認
