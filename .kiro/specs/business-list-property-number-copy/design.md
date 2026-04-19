# 設計書：業務リスト一覧の物件番号ワンクリックコピー機能

## 概要

`WorkTasksPage`（`/work-tasks`）において、テーブルに表示されている物件番号をワンクリックでクリップボードにコピーできる機能を追加する。

コピーボタンは物件番号テキストの隣にアイコンとして配置し、ホバー時に表示される。コピー成功時は MUI の `Snackbar` でフィードバックを 2000ms 間表示する。行クリックによる詳細モーダル表示との競合は `stopPropagation` で回避する。

既に実装済みの買主番号コピー機能（`BuyersPage.tsx`）と同じパターンで実装する。

---

## アーキテクチャ

### 変更対象ファイル

- `frontend/frontend/src/pages/WorkTasksPage.tsx`（唯一の変更対象）

### 変更方針

- 新規コンポーネントや新規ファイルは作成しない
- `WorkTasksPage.tsx` 内に完結する最小限の実装
- 既存の行クリック（`handleRowClick`）との競合を `stopPropagation` で回避
- 既存の `BuyersPage.tsx` のコピー実装パターンを踏襲する

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
  event.stopPropagation(); // 行クリックによる詳細モーダル表示を防止
  try {
    await navigator.clipboard.writeText(propertyNumber);
    setSnackbarMessage(`${propertyNumber} をコピーしました`);
    setSnackbarOpen(true);
  } catch (error) {
    console.error('クリップボードへのコピーに失敗しました:', error);
    // エラーは静かに無視し、Snackbar は表示しない
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

新規のデータモデルは不要。既存の `WorkTask` インターフェースの `property_number` フィールドをそのまま使用する。

追加する状態は以下の2つのみ：

| 状態名 | 型 | 初期値 | 用途 |
|---|---|---|---|
| `snackbarOpen` | `boolean` | `false` | Snackbar の表示・非表示 |
| `snackbarMessage` | `string` | `''` | Snackbar に表示するメッセージ |

---

## 物件番号セルの変更

テーブルの物件番号セル（`<TableCell>`）内の `<Typography>` を、クリック可能な要素に変更する。

### 変更前

```tsx
<TableCell>
  <Typography variant="body2" color="primary" fontWeight="bold">
    {task.property_number || '-'}
  </Typography>
</TableCell>
```

### 変更後

```tsx
<TableCell>
  <Box
    onClick={(e) => task.property_number && handleCopyPropertyNumber(task.property_number, e)}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      cursor: task.property_number ? 'pointer' : 'default',
      '&:hover .copy-icon': { visibility: 'visible' },
    }}
  >
    <Typography variant="body2" color="primary" fontWeight="bold">
      {task.property_number || '-'}
    </Typography>
    {task.property_number && (
      <ContentCopyIcon
        className="copy-icon"
        sx={{ fontSize: 14, visibility: 'hidden', color: 'text.secondary' }}
      />
    )}
  </Box>
</TableCell>
```

**設計上の判断**:
- `visibility: 'hidden'` を使用することで、アイコンが非表示でもレイアウトスペースを確保し、ホバー時のレイアウトシフトを防ぐ
- `task.property_number &&` の短絡評価により、null/空文字の場合はコピーボタン自体を表示しない
- `event.stopPropagation()` により、コピーボタンのクリックが行クリックに伝播しない

---

## 必要なインポートの追加

```typescript
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';
// Snackbar を既存の @mui/material インポートに追加
import { ..., Snackbar } from '@mui/material';
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ 1：コピー関数は正しい値をクリップボードに書き込む

*任意の* 物件番号文字列に対して、`handleCopyPropertyNumber` を呼び出すと `navigator.clipboard.writeText` が同じ物件番号文字列で呼ばれる。

**検証対象：要件 1.1**

### プロパティ 2：空の物件番号ではコピーボタンを表示しない

*任意の* null・undefined・空文字列の物件番号に対して、コピーボタン（`ContentCopyIcon`）がレンダリングされない。

**検証対象：要件 1.2**

### プロパティ 3：コピー成功時のメッセージフォーマット

*任意の* 物件番号文字列に対して、コピー成功時に設定される `snackbarMessage` は必ず `"{物件番号} をコピーしました"` の形式になる。

**検証対象：要件 2.1**

### プロパティ 4：コピーボタンのクリックはイベント伝播を停止する

*任意の* クリックイベントに対して、`handleCopyPropertyNumber` は `event.stopPropagation()` を呼び出し、行クリックハンドラ（`handleRowClick`）が呼ばれない。

**検証対象：要件 3.1**

---

## エラーハンドリング

| シナリオ | 対応 |
|---|---|
| Clipboard API が利用不可（非 HTTPS 環境など） | `catch` ブロックで `console.error` に出力。`snackbarOpen` は `true` にしない。 |
| `property_number` が `null` / `undefined` / 空文字 | クリックハンドラを呼び出さない（`task.property_number &&` で短絡評価）。コピーアイコンも表示しない。 |

---

## テスト戦略

### ユニットテスト（例ベース）

- コピーアイコンのクリックで `navigator.clipboard.writeText` が正しい物件番号で呼ばれること
- コピー成功後に Snackbar が表示されること
- `stopPropagation` が呼ばれ、行クリックの詳細モーダルが開かないこと
- Clipboard API 失敗時に Snackbar が表示されないこと
- `autoHideDuration` が 2000ms に設定されていること
- `anchorOrigin` が `{ vertical: 'bottom', horizontal: 'center' }` に設定されていること
- 物件番号テキスト部分（コピーボタン以外）をクリックした場合に `handleRowClick` が呼ばれること

### プロパティベーステスト

PBT ライブラリ：[fast-check](https://github.com/dubzzz/fast-check)（TypeScript/React プロジェクトに適合）

各プロパティテストは最低 100 回のイテレーションで実行する。

**プロパティ 1 のテスト実装方針**

```typescript
// Feature: business-list-property-number-copy, Property 1: コピー関数は正しい値をクリップボードに書き込む
fc.assert(
  fc.property(fc.string({ minLength: 1 }), async (propertyNumber) => {
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });
    const mockEvent = { stopPropagation: jest.fn() } as unknown as React.MouseEvent;

    await handleCopyPropertyNumber(propertyNumber, mockEvent);

    expect(mockWriteText).toHaveBeenCalledWith(propertyNumber);
  })
);
```

**プロパティ 2 のテスト実装方針**

```typescript
// Feature: business-list-property-number-copy, Property 2: 空の物件番号ではコピーボタンを表示しない
fc.assert(
  fc.property(
    fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')),
    (emptyPropertyNumber) => {
      const { queryByTestId } = render(
        <PropertyNumberCell propertyNumber={emptyPropertyNumber} />
      );
      expect(queryByTestId('copy-icon')).toBeNull();
    }
  )
);
```

**プロパティ 3 のテスト実装方針**

```typescript
// Feature: business-list-property-number-copy, Property 3: コピー成功時のメッセージフォーマット
fc.assert(
  fc.property(fc.string({ minLength: 1 }), async (propertyNumber) => {
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });
    const mockEvent = { stopPropagation: jest.fn() } as unknown as React.MouseEvent;

    await handleCopyPropertyNumber(propertyNumber, mockEvent);

    expect(snackbarMessage).toBe(`${propertyNumber} をコピーしました`);
    expect(snackbarMessage.startsWith(propertyNumber)).toBe(true);
    expect(snackbarMessage.endsWith(' をコピーしました')).toBe(true);
  })
);
```

**プロパティ 4 のテスト実装方針**

```typescript
// Feature: business-list-property-number-copy, Property 4: コピーボタンのクリックはイベント伝播を停止する
fc.assert(
  fc.property(fc.string({ minLength: 1 }), async (propertyNumber) => {
    const mockStopPropagation = jest.fn();
    const mockEvent = { stopPropagation: mockStopPropagation } as unknown as React.MouseEvent;
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    await handleCopyPropertyNumber(propertyNumber, mockEvent);

    expect(mockStopPropagation).toHaveBeenCalledTimes(1);
  })
);
```

### 手動確認項目

- 物件番号にホバーするとコピーアイコンが表示され、離れると非表示になること
- コピー後に行クリックの詳細モーダルが開かないこと
- 2000ms 後に Snackbar が自動的に閉じること
- 物件番号が null/空文字の行ではコピーアイコンが表示されないこと
- コピーアイコン以外の行部分をクリックすると詳細モーダルが開くこと
