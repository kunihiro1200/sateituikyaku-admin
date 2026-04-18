# 設計書：売主番号クリックでクリップボードコピー

## 概要

`SellersPage`（`/sellers`）において、売主番号テキストをクリック（またはタップ）するとクリップボードにコピーされる機能を追加する。

デスクトップのテーブル表示とモバイルのカード表示の両方に対応し、MUI の `Snackbar` でコピー完了を通知する。

既に実装済みの物件番号コピー機能（`PropertyListingsPage.tsx`）・買主番号コピー機能（`BuyersPage.tsx`）と同じパターンで実装する。

---

## アーキテクチャ

### 変更対象ファイル

- `frontend/frontend/src/pages/SellersPage.tsx`（唯一の変更対象）

### 変更方針

- 新規コンポーネントや新規ファイルは作成しない
- `SellersPage.tsx` 内に完結する最小限の実装
- 既存の行クリック（`navigate(/sellers/:id/call)`）との競合を `stopPropagation` で回避

---

## コンポーネントとインターフェース

### 追加する状態

```typescript
const [snackbarOpen, setSnackbarOpen] = useState(false);
const [snackbarMessage, setSnackbarMessage] = useState('');
```

### コピー処理関数

```typescript
const handleCopySellerNumber = async (
  sellerNumber: string,
  event: React.MouseEvent
) => {
  event.stopPropagation(); // 行クリックによるページ遷移を防止
  try {
    await navigator.clipboard.writeText(sellerNumber);
    setSnackbarMessage(`${sellerNumber} をコピーしました`);
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

新規のデータモデルは不要。既存の `Seller` インターフェースの `sellerNumber` フィールドをそのまま使用する。

追加する状態は以下の2つのみ：

| 状態名 | 型 | 初期値 | 用途 |
|---|---|---|---|
| `snackbarOpen` | `boolean` | `false` | Snackbar の表示・非表示 |
| `snackbarMessage` | `string` | `''` | Snackbar に表示するメッセージ |

---

## デスクトップ表示の変更

テーブルの売主番号セル（`<TableCell>`）内の `<Typography>` を、クリック可能な要素に変更する。

### 変更前

```tsx
<TableCell>
  <Typography variant="body2" fontWeight="bold" sx={{ color: SECTION_COLORS.seller.main }}>
    {seller.sellerNumber || '-'}
  </Typography>
</TableCell>
```

### 変更後

```tsx
<TableCell>
  <Box
    onClick={(e) => seller.sellerNumber && handleCopySellerNumber(seller.sellerNumber, e)}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      cursor: seller.sellerNumber ? 'pointer' : 'default',
      '&:hover .copy-icon': { visibility: 'visible' },
    }}
  >
    <Typography variant="body2" fontWeight="bold" sx={{ color: SECTION_COLORS.seller.main }}>
      {seller.sellerNumber || '-'}
    </Typography>
    {seller.sellerNumber && (
      <ContentCopyIcon
        className="copy-icon"
        sx={{ fontSize: 14, color: SECTION_COLORS.seller.main, visibility: 'hidden' }}
      />
    )}
  </Box>
</TableCell>
```

---

## モバイル表示の変更

カード内の売主番号 `<Typography>` を、タップ可能な要素に変更する。モバイルはホバー状態がないため、コピーアイコンを常時表示する。

### 変更前

```tsx
<Typography
  variant="body2"
  fontWeight="bold"
  sx={{ color: SECTION_COLORS.seller.main, fontSize: '14px' }}
>
  {seller.sellerNumber || '-'}
</Typography>
```

### 変更後

```tsx
<Box
  onClick={(e) => seller.sellerNumber && handleCopySellerNumber(seller.sellerNumber, e)}
  sx={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    cursor: seller.sellerNumber ? 'pointer' : 'default',
  }}
>
  <Typography
    variant="body2"
    fontWeight="bold"
    sx={{ color: SECTION_COLORS.seller.main, fontSize: '14px' }}
  >
    {seller.sellerNumber || '-'}
  </Typography>
  {seller.sellerNumber && (
    <ContentCopyIcon
      sx={{ fontSize: 14, color: SECTION_COLORS.seller.main }}
    />
  )}
</Box>
```

---

## 必要なインポートの追加

```typescript
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
// Snackbar を既存の @mui/material インポートに追加
import { ..., Snackbar } from '@mui/material';
```

---

## 正確性プロパティ

### プロパティ 1：コピーメッセージのフォーマット

*任意の* 売主番号文字列に対して、コピー成功時に表示される Snackbar のメッセージは必ず `"{売主番号} をコピーしました"` の形式になる。

**検証対象：要件 4.2**

### プロパティ 2：連続コピー時のメッセージ更新

*任意の* 2つの異なる売主番号を連続してコピーした場合、Snackbar には最後にコピーした売主番号のメッセージが表示される。

**検証対象：要件 4.4**

---

## エラーハンドリング

| シナリオ | 対応 |
|---|---|
| Clipboard API が利用不可（非 HTTPS 環境など） | `catch` ブロックで `console.error` に出力。Snackbar は表示しない。 |
| `sellerNumber` が `null` / `undefined` | クリックハンドラを呼び出さない（`seller.sellerNumber &&` で短絡評価） |
