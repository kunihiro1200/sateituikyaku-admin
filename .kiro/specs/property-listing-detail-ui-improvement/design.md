# Design Document: 物件リスト詳細画面のUI改善機能

## Overview

物件リスト詳細画面（PropertyListingDetailPage）のUIを改善し、ユーザビリティを向上させる機能です。具体的には、不要な「物件詳細」ラベルを削除し、物件番号を物件概要の右側に配置してクリック1回でコピーできるようにします。

この機能により、ユーザーは物件番号を簡単にコピーして他の場所に貼り付けることができ、業務効率が向上します。

## Architecture

### コンポーネント構成

```
PropertyListingDetailPage (pages/PropertyListingsPage.tsx)
  └── PropertyHeaderInfo (components/PropertyHeaderInfo.tsx)
        ├── 物件所在地
        ├── 売買価格
        ├── 営業担当
        └── 物件番号（新規追加）
              ├── IconButton（コピーアイコン）
              └── Tooltip（「物件番号をコピー」）
```

### 状態管理

PropertyHeaderInfoコンポーネント内で以下の状態を管理します：

- `copied: boolean` - コピー成功状態（2秒間true）
- クリップボードAPIを使用してコピー処理を実行

### Material-UIコンポーネント

- `IconButton` - コピーボタン
- `Tooltip` - ツールチップ表示
- `ContentCopyIcon` - コピーアイコン
- `CheckIcon` - コピー成功アイコン

## Components and Interfaces

### PropertyHeaderInfo Props

```typescript
interface PropertyHeaderInfoProps {
  address: string | null;
  salesPrice: number | null;
  salesAssignee: string | null;
  propertyNumber: string;  // 新規追加
}
```

### 内部状態

```typescript
const [copied, setCopied] = useState(false);
```

### コピー処理関数

```typescript
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(propertyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};
```

### キーボードイベントハンドラ

```typescript
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleCopy();
  }
};
```

## Data Models

### PropertyListing型の拡張

既存の`PropertyListing`型に`property_number`フィールドが含まれていることを確認します。

```typescript
interface PropertyListing {
  id: string;
  property_number?: string;  // 既存フィールド
  // ... 他のフィールド
}
```

## Correctness Properties

*プロパティは、システムの全ての有効な実行において真であるべき特性や動作の形式的な記述です。プロパティは、人間が読める仕様と機械検証可能な正確性保証の橋渡しとなります。*

### Property 1: クリップボードへのコピー

*For any* 物件番号、ユーザーがコピーボタンをクリックしたとき、その物件番号がクリップボードにコピーされるべきです。

**Validates: Requirements 2.2**

### Property 2: コピー成功フィードバックの表示

*For any* 物件番号、コピーが成功したとき、「コピーしました」というフィードバックが表示されるべきです。

**Validates: Requirements 2.3**

### Property 3: ツールチップの表示

*For any* 物件番号、マウスオーバー時に「物件番号をコピー」というツールチップが表示されるべきです。

**Validates: Requirements 2.5**

### Property 4: コピー成功アイコンの表示

*For any* 物件番号、コピー成功後にチェックアイコンが表示されるべきです。

**Validates: Requirements 2.6**

### Property 5: アイコンの復元

*For any* 物件番号、コピー成功から2秒経過後、元のコピーアイコンに戻るべきです。

**Validates: Requirements 2.7**

### Property 6: スクリーンリーダーへの通知

*For any* 物件番号、コピー成功時にスクリーンリーダーに「物件番号をコピーしました」と通知されるべきです。

**Validates: Requirements 4.2**

### Property 7: キーボード操作でのコピー

*For any* 物件番号、Enterキーまたはスペースキーを押下したとき、その物件番号がクリップボードにコピーされるべきです。

**Validates: Requirements 4.3**

## Error Handling

### クリップボードAPIのエラー処理

```typescript
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(propertyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    // エラー時はユーザーに通知しない（サイレントフェイル）
    // ブラウザのセキュリティ制限により失敗する可能性がある
  }
};
```

### ブラウザ互換性

- `navigator.clipboard` APIは全てのモダンブラウザでサポートされています
- HTTPSまたはlocalhostでのみ動作します（セキュリティ制限）
- 古いブラウザでは動作しない可能性がありますが、エラーは発生しません

## Testing Strategy

### Unit Tests

以下の具体的なケースをテストします：

1. **「物件詳細」ラベルの非表示**
   - PropertyListingDetailPageに「物件詳細 -」というテキストが表示されないことを確認

2. **コピーアイコンの初期表示**
   - PropertyHeaderInfoにContentCopyIconが表示されることを確認

3. **aria-label属性の設定**
   - コピーボタンに`aria-label="物件番号をコピー"`が設定されていることを確認

### Property-Based Tests

各プロパティテストは最低100回の反復で実行します。各テストには以下のタグを付けます：

**Feature: property-listing-detail-ui-improvement, Property 1: クリップボードへのコピー**
```typescript
test('Property 1: クリップボードへのコピー', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンをクリック
  const copyButton = screen.getByLabelText('物件番号をコピー');
  await userEvent.click(copyButton);
  
  // クリップボードの内容を確認
  const clipboardText = await navigator.clipboard.readText();
  expect(clipboardText).toBe(propertyNumber);
});
```

**Feature: property-listing-detail-ui-improvement, Property 2: コピー成功フィードバックの表示**
```typescript
test('Property 2: コピー成功フィードバックの表示', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンをクリック
  const copyButton = screen.getByLabelText('物件番号をコピー');
  await userEvent.click(copyButton);
  
  // フィードバックメッセージの表示を確認
  expect(screen.getByText('コピーしました')).toBeInTheDocument();
});
```

**Feature: property-listing-detail-ui-improvement, Property 3: ツールチップの表示**
```typescript
test('Property 3: ツールチップの表示', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンにマウスオーバー
  const copyButton = screen.getByLabelText('物件番号をコピー');
  await userEvent.hover(copyButton);
  
  // ツールチップの表示を確認
  expect(await screen.findByText('物件番号をコピー')).toBeInTheDocument();
});
```

**Feature: property-listing-detail-ui-improvement, Property 4: コピー成功アイコンの表示**
```typescript
test('Property 4: コピー成功アイコンの表示', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンをクリック
  const copyButton = screen.getByLabelText('物件番号をコピー');
  await userEvent.click(copyButton);
  
  // チェックアイコンの表示を確認
  expect(screen.getByTestId('CheckIcon')).toBeInTheDocument();
});
```

**Feature: property-listing-detail-ui-improvement, Property 5: アイコンの復元**
```typescript
test('Property 5: アイコンの復元', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンをクリック
  const copyButton = screen.getByLabelText('物件番号をコピー');
  await userEvent.click(copyButton);
  
  // 2秒待機
  await waitFor(() => {
    expect(screen.getByTestId('ContentCopyIcon')).toBeInTheDocument();
  }, { timeout: 2500 });
});
```

**Feature: property-listing-detail-ui-improvement, Property 6: スクリーンリーダーへの通知**
```typescript
test('Property 6: スクリーンリーダーへの通知', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンをクリック
  const copyButton = screen.getByLabelText('物件番号をコピー');
  await userEvent.click(copyButton);
  
  // aria-live領域の内容を確認
  const liveRegion = screen.getByRole('status');
  expect(liveRegion).toHaveTextContent('物件番号をコピーしました');
});
```

**Feature: property-listing-detail-ui-improvement, Property 7: キーボード操作でのコピー**
```typescript
test('Property 7: キーボード操作でのコピー', async () => {
  // 任意の物件番号を生成
  const propertyNumber = generateRandomPropertyNumber();
  
  // コンポーネントをレンダリング
  render(<PropertyHeaderInfo propertyNumber={propertyNumber} ... />);
  
  // コピーボタンにフォーカス
  const copyButton = screen.getByLabelText('物件番号をコピー');
  copyButton.focus();
  
  // Enterキーを押下
  await userEvent.keyboard('{Enter}');
  
  // クリップボードの内容を確認
  const clipboardText = await navigator.clipboard.readText();
  expect(clipboardText).toBe(propertyNumber);
});
```

### テストライブラリ

- **React Testing Library** - コンポーネントのレンダリングとユーザーインタラクションのテスト
- **@testing-library/user-event** - ユーザーイベントのシミュレーション
- **fast-check** - プロパティベーステストのためのランダムデータ生成

### テスト実行

```bash
# 全てのテストを実行
npm test

# プロパティベーステストのみ実行
npm test -- --testNamePattern="Property"
```
