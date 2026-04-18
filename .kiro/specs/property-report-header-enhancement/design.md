# 設計書：物件リスト報告ページ ヘッダー機能拡張

## 概要

`PropertyReportPage`（`/property-listings/:propertyNumber/report`）のヘッダーに2つの機能を追加する。

1. **物件番号のワンクリックコピー**: ヘッダーの物件番号をクリックするとクリップボードにコピーされ、Snackbar で通知する。
2. **売買価格の表示**: 住所の右隣に `price` フィールドを万円単位（カンマ区切り）で表示する。

対象ファイルは `frontend/frontend/src/pages/PropertyReportPage.tsx` のみ。バックエンドの変更は不要。

---

## アーキテクチャ

### 変更対象ファイル

- `frontend/frontend/src/pages/PropertyReportPage.tsx`（唯一の変更対象）

### 変更方針

- 新規コンポーネントや新規ファイルは作成しない
- `PropertyReportPage.tsx` 内に完結する最小限の実装
- 既存の `snackbar` ステートを再利用する（新規ステートを追加しない）
- バックエンドは `select('*')` で `price` フィールドを既に返しているため変更不要

---

## コンポーネントとインターフェース

### ReportData インターフェースの変更

```typescript
interface ReportData {
  report_date?: string;
  report_completed?: string;
  report_assignee?: string;
  sales_assignee?: string;
  address?: string;
  owner_name?: string;
  owner_email?: string;
  suumo_url?: string;
  report_memo?: string;
  price?: number | null; // 追加：売買価格（円単位）
}
```

### 価格フォーマット関数

```typescript
// 円単位の価格を万円単位のカンマ区切り文字列に変換する
// 例: 50000000 → "5,000万円"、5000000 → "500万円"
const formatPrice = (price: number): string => {
  const man = Math.floor(price / 10000);
  return `${man.toLocaleString('ja-JP')}万円`;
};
```

### 物件番号コピー処理

既存の `snackbar` ステートを再利用する：

```typescript
const handleCopyPropertyNumber = async () => {
  if (!propertyNumber) return;
  try {
    await navigator.clipboard.writeText(propertyNumber);
    setSnackbar({ open: true, message: '物件番号をコピーしました', severity: 'success' });
  } catch {
    setSnackbar({ open: true, message: 'コピーに失敗しました', severity: 'error' });
  }
};
```

---

## データモデル

### ReportData の変更

| フィールド | 型 | 変更 | 説明 |
|---|---|---|---|
| `price` | `number \| null` | **追加** | 売買価格（円単位）。APIレスポンスの `d.price` から取得 |

### fetchData の変更

```typescript
const initial: ReportData = {
  // ...既存フィールド...
  price: d.price ?? null, // 追加
};
```

---

## ヘッダー JSX の変更

### 物件番号のクリッカブル化

変更前：

```tsx
<Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
  報告 - {propertyNumber}
  {reportData.owner_name && (
    <Typography component="span" variant="h6" sx={{ ml: 2, color: 'text.primary', fontWeight: 'normal' }}>
      {reportData.owner_name}
    </Typography>
  )}
</Typography>
```

変更後：

```tsx
<Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
  報告 -{' '}
  <Box
    component="span"
    onClick={handleCopyPropertyNumber}
    sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
  >
    {propertyNumber}
  </Box>
  {reportData.owner_name && (
    <Typography component="span" variant="h6" sx={{ ml: 2, color: 'text.primary', fontWeight: 'normal' }}>
      {reportData.owner_name}
    </Typography>
  )}
</Typography>
```

### 住所の右隣への価格表示

変更前：

```tsx
{reportData.address && (
  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
    {reportData.address}
  </Typography>
)}
```

変更後：

```tsx
{reportData.address && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
    <Typography variant="body2" color="text.secondary">
      {reportData.address}
    </Typography>
    {reportData.price != null && reportData.price > 0 && (
      <Typography variant="body2" color="text.secondary">
        {formatPrice(reportData.price)}
      </Typography>
    )}
  </Box>
)}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ 1：クリップボードコピーの正確性

*任意の* 物件番号文字列に対して、コピーハンドラを呼び出したとき `navigator.clipboard.writeText` は必ずその物件番号文字列と同一の引数で呼ばれる。

**検証対象：要件 1.2**

### プロパティ 2：価格フォーマットの正確性

*任意の* 正の整数（円単位）に対して、`formatPrice` 関数は `Math.floor(price / 10000)` を `ja-JP` ロケールのカンマ区切りで表示し、末尾に「万円」を付けた文字列を返す。

**検証対象：要件 2.3、2.6、2.7**

### プロパティ 3：APIレスポンスの price マッピング

*任意の* `price` 値（正の数・0・null・undefined）を含む APIレスポンスに対して、`fetchData` 実行後の `reportData.price` は `d.price ?? null` の結果と等しい。

**検証対象：要件 2.2、2.4**

---

## エラーハンドリング

| シナリオ | 対応 |
|---|---|
| Clipboard API が利用不可（非 HTTPS 環境など） | `catch` ブロックで `setSnackbar({ ..., message: 'コピーに失敗しました', severity: 'error' })` を呼び出す |
| `propertyNumber` が `undefined` | `handleCopyPropertyNumber` の先頭で早期リターン |
| `price` が `null` / `undefined` / `0` | `reportData.price != null && reportData.price > 0` の条件で表示をスキップ |
| `price` が小数を含む場合 | `Math.floor` で切り捨て（例: 5050000 → 505万円） |

---

## テスト戦略

### ユニットテスト（例ベース）

- 物件番号要素に `cursor: pointer` スタイルが設定されていること
- コピー成功後に Snackbar が「物件番号をコピーしました」で表示されること（severity: success）
- Clipboard API 失敗時に Snackbar が「コピーに失敗しました」で表示されること（severity: error）
- `price=5000000` のとき「500万円」が表示されること
- `price=50000000` のとき「5,000万円」が表示されること
- `price=0` のとき価格テキストが表示されないこと
- `price=null` のとき価格テキストが表示されないこと
- `address` が空のとき価格テキストが表示されないこと

### プロパティベーステスト

PBT ライブラリ：[fast-check](https://github.com/dubzzz/fast-check)（TypeScript/React プロジェクトに適合）

各プロパティテストは最低 100 回のイテレーションで実行する。

**プロパティ 1 のテスト実装方針**

```typescript
// Feature: property-report-header-enhancement, Property 1: クリップボードコピーの正確性
fc.assert(
  fc.property(fc.string({ minLength: 1 }), async (propNumber) => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await handleCopyPropertyNumber(propNumber);
    expect(writeText).toHaveBeenCalledWith(propNumber);
  })
);
```

**プロパティ 2 のテスト実装方針**

```typescript
// Feature: property-report-header-enhancement, Property 2: 価格フォーマットの正確性
fc.assert(
  fc.property(fc.integer({ min: 10000, max: 9999999990000 }), (price) => {
    const result = formatPrice(price);
    const expectedMan = Math.floor(price / 10000);
    const expectedStr = `${expectedMan.toLocaleString('ja-JP')}万円`;
    expect(result).toBe(expectedStr);
  })
);
```

**プロパティ 3 のテスト実装方針**

```typescript
// Feature: property-report-header-enhancement, Property 3: APIレスポンスの price マッピング
fc.assert(
  fc.property(
    fc.oneof(fc.integer({ min: 1 }), fc.constant(0), fc.constant(null), fc.constant(undefined)),
    (priceValue) => {
      const mockResponse = { price: priceValue, address: '東京都', report_date: '' };
      const mapped = mapResponseToReportData(mockResponse);
      expect(mapped.price).toBe(priceValue ?? null);
    }
  )
);
```

### 手動確認項目

- 物件番号をクリックすると Snackbar が表示され、クリップボードに物件番号がコピーされること
- 住所の右隣に価格が表示されること（price が正の数の場合）
- price が 0 または null の場合、価格テキストが表示されないこと
- 既存の保存・メール送信機能が正常に動作すること
