# 設計書：物件番号クリックでクリップボードコピー

## 概要

`PropertyListingsPage`（`/property-listings`）において、物件番号テキストをクリック（またはタップ）するとクリップボードにコピーされる機能を追加する。

デスクトップのテーブル表示とモバイルのカード表示の両方に対応し、MUI の `Snackbar` でコピー完了を通知する。

---

## アーキテクチャ

### 変更対象ファイル

- `frontend/frontend/src/pages/PropertyListingsPage.tsx`（唯一の変更対象）

### 変更方針

- 新規コンポーネントや新規ファイルは作成しない
- `PropertyListingsPage.tsx` 内に完結する最小限の実装
- 既存の行クリック（`handleRowClick`）との競合を `stopPropagation` で回避

---

## コンポーネントとインターフェース

### 追加する状態

```typescript
const [snackbarOpen, setSnackbarOpen] = useState(false);
const [snackbarMessage, setSnackbarMessage] = useState('');
```

### コピー処理関数

```typescript
const handleCopyPropertyNumber = async (
  propertyNumber: string,
  event: React.MouseEvent
) => {
  event.stopPropagation(); // 行クリックによるページ遷移を防止
  try {
    await navigator.clipboard.writeText(propertyNumber);
    setSnackbarMessage(`${propertyNumber} をコピーしました`);
    setSnackbarOpen(true);
  } catch (error) {
    console.error('クリップボードへのコピーに失敗しました:', error);
  }
};
```

### Snackbar コンポーネント

JSX の末尾（`</Container>` の直前）に追加：

```tsx
<Snackbar
  open={snackbarOpen}
  autoHideDuration={2000}
  onClose={() => setSnackbarOpen(false)}
  message={snackbarMessage}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
/>
```

---

## データモデル

新規のデータモデルは不要。既存の `PropertyListing` インターフェースの `property_number` フィールドをそのまま使用する。

追加する状態は以下の2つのみ：

| 状態名 | 型 | 初期値 | 用途 |
|---|---|---|---|
| `snackbarOpen` | `boolean` | `false` | Snackbar の表示・非表示 |
| `snackbarMessage` | `string` | `''` | Snackbar に表示するメッセージ |

---

## デスクトップ表示の変更

テーブルの物件番号セル（`<TableCell>`）内の `<Typography>` を、クリック可能な要素に変更する。

### 変更前

```tsx
<TableCell>
  <Typography variant="body2" sx={{ color: SECTION_COLORS.property.main }} fontWeight="bold">
    {listing.property_number || '-'}
  </Typography>
</TableCell>
```

### 変更後

```tsx
<TableCell>
  <Box
    onClick={(e) => listing.property_number && handleCopyPropertyNumber(listing.property_number, e)}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      cursor: listing.property_number ? 'pointer' : 'default',
      '&:hover .copy-icon': { visibility: 'visible' },
    }}
  >
    <Typography variant="body2" sx={{ color: SECTION_COLORS.property.main }} fontWeight="bold">
      {listing.property_number || '-'}
    </Typography>
    {listing.property_number && (
      <ContentCopyIcon
        className="copy-icon"
        sx={{ fontSize: 14, color: SECTION_COLORS.property.main, visibility: 'hidden' }}
      />
    )}
  </Box>
</TableCell>
```

---

## モバイル表示の変更

カード内の物件番号 `<Typography>` を、タップ可能な要素に変更する。モバイルはホバー状態がないため、コピーアイコンを常時表示する。

### 変更前

```tsx
<Typography
  variant="body2"
  fontWeight="bold"
  sx={{ color: SECTION_COLORS.property.main, fontSize: '14px' }}
>
  {listing.property_number || '-'}
</Typography>
```

### 変更後

```tsx
<Box
  onClick={(e) => listing.property_number && handleCopyPropertyNumber(listing.property_number, e)}
  sx={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    cursor: listing.property_number ? 'pointer' : 'default',
  }}
>
  <Typography
    variant="body2"
    fontWeight="bold"
    sx={{ color: SECTION_COLORS.property.main, fontSize: '14px' }}
  >
    {listing.property_number || '-'}
  </Typography>
  {listing.property_number && (
    <ContentCopyIcon
      sx={{ fontSize: 14, color: SECTION_COLORS.property.main }}
    />
  )}
</Box>
```

---

## 必要なインポートの追加

```typescript
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Snackbar } from '@mui/material'; // 既存の @mui/material インポートに追加
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ 1：コピーメッセージのフォーマット

*任意の* 物件番号文字列に対して、コピー成功時に表示される Snackbar のメッセージは必ず `"{物件番号} をコピーしました"` の形式になる。

**検証対象：要件 4.2**

### プロパティ 2：連続コピー時のメッセージ更新

*任意の* 2つの異なる物件番号を連続してコピーした場合、Snackbar には最後にコピーした物件番号のメッセージが表示される。

**検証対象：要件 4.4**

---

## エラーハンドリング

| シナリオ | 対応 |
|---|---|
| Clipboard API が利用不可（非 HTTPS 環境など） | `catch` ブロックで `console.error` に出力。Snackbar は表示しない。 |
| `property_number` が `null` / `undefined` | クリックハンドラを呼び出さない（`listing.property_number &&` で短絡評価） |

---

## テスト戦略

### ユニットテスト（例ベース）

- コピーアイコンのクリックで `navigator.clipboard.writeText` が正しい物件番号で呼ばれること
- コピー成功後に Snackbar が表示されること
- `stopPropagation` が呼ばれ、行クリックのナビゲーションが発生しないこと
- Clipboard API 失敗時に Snackbar が表示されないこと
- `autoHideDuration` が 2000ms に設定されていること
- `anchorOrigin` が `{ vertical: 'bottom', horizontal: 'center' }` に設定されていること

### プロパティベーステスト

PBT ライブラリ：[fast-check](https://github.com/dubzzz/fast-check)（TypeScript/React プロジェクトに適合）

各プロパティテストは最低 100 回のイテレーションで実行する。

**プロパティ 1 のテスト実装方針**

```typescript
// Feature: property-number-copy-on-click, Property 1: コピーメッセージのフォーマット
fc.assert(
  fc.property(fc.string({ minLength: 1 }), (propertyNumber) => {
    const message = `${propertyNumber} をコピーしました`;
    // メッセージが正しいフォーマットであることを確認
    expect(message).toBe(`${propertyNumber} をコピーしました`);
    expect(message.endsWith(' をコピーしました')).toBe(true);
    expect(message.startsWith(propertyNumber)).toBe(true);
  })
);
```

**プロパティ 2 のテスト実装方針**

```typescript
// Feature: property-number-copy-on-click, Property 2: 連続コピー時のメッセージ更新
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),
    fc.string({ minLength: 1 }),
    (firstNumber, secondNumber) => {
      // 1つ目をコピー → 2つ目をコピー → メッセージが2つ目のものになること
      // snackbarMessage の状態遷移を検証
    }
  )
);
```

### 手動確認項目

- デスクトップ：物件番号にホバーするとアイコンが表示され、離れると非表示になること
- モバイル：物件番号の隣にアイコンが常時表示されること
- コピー後に行クリックのページ遷移が発生しないこと
- 2000ms 後に Snackbar が自動的に閉じること
