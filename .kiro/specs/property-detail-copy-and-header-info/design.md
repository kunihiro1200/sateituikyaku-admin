# 設計ドキュメント: property-detail-copy-and-header-info

## Overview

本機能は社内管理システムの操作性向上を目的とした2つのフロントエンド改善です。

**改善1: 物件番号コピー機能の視認性向上**  
`PropertyListingDetailPage.tsx` では既にコピーアイコンとコピー成功時のアイコン切り替えが実装されています。現状の実装を確認すると、`copiedPropertyNumber` ステートと `handleCopyPropertyNumber` 関数、`CheckIcon`/`ContentCopyIcon` の切り替えは既に存在しています。要件で求められているのは、アイコンを常時表示（現在も常時表示されている）し、スナックバー通知（成功・失敗）とツールチップを確実に動作させることです。現在の実装を精査すると、コピー失敗時のスナックバーは既に実装済みで、`title` 属性によるツールチップも設定済みです。ただし、MUI の `Tooltip` コンポーネントを使った明示的なツールチップ表示への変更が要件として求められています。

**改善2: 業務詳細モーダルヘッダーへの物件情報追加**  
`WorkTaskDetailModal.tsx` の `DialogTitle` 内に、物件番号の右隣に物件所在地・種別・売主名・物件担当名・媒介形態を表示します。これらのフィールドは `WorkTaskData` インターフェースに既に定義されており、バックエンド変更は不要です。

## Architecture

```
frontend/frontend/src/
├── pages/
│   └── PropertyListingDetailPage.tsx   ← 改善1: コピー機能視認性向上
└── components/
    └── WorkTaskDetailModal.tsx          ← 改善2: ヘッダー物件情報追加
```

両改善ともフロントエンドのみの変更です。バックエンドAPIへの変更は一切不要です。

```mermaid
graph TD
    A[PropertyListingDetailPage] --> B[handleCopyPropertyNumber]
    B --> C{navigator.clipboard.writeText}
    C -->|成功| D[setCopiedPropertyNumber(true)]
    C -->|成功| E[setSnackbar: 成功メッセージ]
    C -->|失敗| F[setSnackbar: エラーメッセージ]
    D --> G[2秒後 setCopiedPropertyNumber(false)]

    H[WorkTaskDetailModal] --> I[DialogTitle]
    I --> J[物件番号 Box]
    I --> K[物件情報 Box - 横スクロール]
    K --> L[property_address]
    K --> M[property_type]
    K --> N[seller_name]
    K --> O[sales_assignee]
    K --> P[mediation_type]
```

## Components and Interfaces

### 改善1: PropertyListingDetailPage.tsx

#### 変更箇所

**ヘッダー内の物件番号コピーボタン**（既存の `IconButton` を `Tooltip` でラップ）

```tsx
// 変更前
<IconButton
  size="small"
  onClick={handleCopyPropertyNumber}
  sx={{ color: copiedPropertyNumber ? 'success.main' : SECTION_COLORS.property.main }}
  title="物件番号をコピー"
>
  {copiedPropertyNumber ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
</IconButton>

// 変更後
<Tooltip title="物件番号をコピー">
  <IconButton
    size="small"
    onClick={handleCopyPropertyNumber}
    sx={{ color: copiedPropertyNumber ? 'success.main' : SECTION_COLORS.property.main }}
  >
    {copiedPropertyNumber ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
  </IconButton>
</Tooltip>
```

**必要なインポート追加**

```tsx
import { Tooltip } from '@mui/material';
```

`Tooltip` は既に `@mui/material` からインポートされているか確認が必要です。現在のインポートリストに含まれていない場合は追加します。

#### 既存実装の確認

現在の実装を確認すると以下が既に実装済みです：
- `copiedPropertyNumber` ステート（`useState(false)`）
- `handleCopyPropertyNumber` 関数（`navigator.clipboard.writeText` 使用）
- コピー成功時: `setCopiedPropertyNumber(true)` → 2秒後に `false`
- コピー成功時: スナックバー「物件番号をコピーしました」
- コピー失敗時: スナックバー「物件番号のコピーに失敗しました」
- アイコン切り替え: `copiedPropertyNumber ? CheckIcon : ContentCopyIcon`
- 色変更: `copiedPropertyNumber ? 'success.main' : SECTION_COLORS.property.main`
- `title="物件番号をコピー"` 属性

**唯一の変更点**: `title` 属性を MUI の `Tooltip` コンポーネントに置き換えることで、MUI のスタイルに統一されたツールチップを表示します。

### 改善2: WorkTaskDetailModal.tsx

#### 変更箇所

**DialogTitle 内のヘッダー構造**

現在の `DialogTitle` 内の左側 `Box` に、物件番号の右隣に物件情報を追加します。

```tsx
// 変更前
<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
  <Button ...>業務一覧</Button>
  <Typography variant="h6">業務詳細 -</Typography>
  <Box onClick={...} sx={{ cursor: 'pointer', ... }}>
    {propertyNumber || ''}
  </Box>
</Box>

// 変更後
<Box sx={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
  <Button ...>業務一覧</Button>
  <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>業務詳細 -</Typography>
  <Box onClick={...} sx={{ cursor: 'pointer', whiteSpace: 'nowrap', ... }}>
    {propertyNumber || ''}
  </Box>
  {/* 物件情報（横スクロール可能） */}
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', flexShrink: 1 }}>
    {data?.property_address && (
      <Chip label={data.property_address} size="small" variant="outlined" />
    )}
    {data?.property_type && (
      <Chip label={data.property_type} size="small" variant="outlined" />
    )}
    {data?.seller_name && (
      <Chip label={`売主: ${data.seller_name}`} size="small" variant="outlined" />
    )}
    {data?.sales_assignee && (
      <Chip label={`担当: ${data.sales_assignee}`} size="small" variant="outlined" />
    )}
    {data?.mediation_type && (
      <Chip label={data.mediation_type} size="small" variant="outlined" />
    )}
  </Box>
</Box>
```

**必要なインポート追加**

```tsx
import { Chip } from '@mui/material';
```

#### データ取得フロー

`WorkTaskDetailModal` は `open` と `propertyNumber` が変化したとき `fetchData()` を呼び出し、`data` ステートに `WorkTaskData` を格納します。`data` が `null`（ローディング中）の場合、各フィールドは `data?.property_address` のようにオプショナルチェーンで参照するため、自動的に非表示になります。

#### 空値の扱い

要件4「値が空の場合は非表示」は、`{data?.property_address && <Chip ... />}` のパターンで実現します。空文字列・`null`・`undefined` はすべて falsy として評価されるため、追加のバリデーションは不要です。

## Data Models

### 改善1: PropertyListingDetailPage

既存のステートを変更なしで使用します。

```typescript
// 既存（変更なし）
const [copiedPropertyNumber, setCopiedPropertyNumber] = useState(false);
const [snackbar, setSnackbar] = useState<{
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}>({ open: false, message: '', severity: 'success' });
```

### 改善2: WorkTaskDetailModal

既存の `WorkTaskData` インターフェースを変更なしで使用します。

```typescript
// 既存（変更なし）
interface WorkTaskData {
  property_number: string;
  property_address: string;   // 物件所在地
  property_type: string;      // 種別
  seller_name: string;        // 売主名
  sales_assignee: string;     // 物件担当名
  mediation_type: string;     // 媒介形態
  // ... その他フィールド
}
```

ヘッダーに表示する5フィールドはすべて `WorkTaskData` に既に定義されており、`data` ステートから直接参照できます。


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: コピー操作でclipboardに正しい値が書き込まれる

*For any* 物件番号を持つ PropertyListingDetailPage において、コピーボタンをクリックしたとき、`navigator.clipboard.writeText` が物件番号の値で呼び出されなければならない

**Validates: Requirements 1.2**

### Property 2: コピー成功後にアイコンが切り替わり2秒後に戻る

*For any* PropertyListingDetailPage において、コピーが成功したとき、アイコンが CheckIcon（緑色）に変化し、2秒後に ContentCopyIcon に戻らなければならない

**Validates: Requirements 1.3**

### Property 3: コピー成功後にスナックバーが表示される

*For any* PropertyListingDetailPage において、コピーが成功したとき、severity が `success` のスナックバーが「物件番号をコピーしました」というメッセージで表示されなければならない

**Validates: Requirements 1.4**

### Property 4: WorkTaskDetailModal ヘッダーに物件情報が表示される

*For any* WorkTaskData において、値が存在するフィールド（property_address・property_type・seller_name・sales_assignee・mediation_type）はすべてヘッダーに表示され、値が空・null・undefined のフィールドは表示されてはならない

**Validates: Requirements 2.1, 2.3, 2.4**

## Error Handling

### 改善1: コピー失敗時

`navigator.clipboard.writeText()` が例外をスローした場合（ブラウザの権限拒否など）、`catch` ブロックで `setSnackbar` を呼び出し、severity `error`・メッセージ「物件番号のコピーに失敗しました」のスナックバーを表示します。既存の実装に既に含まれています。

```typescript
} catch (error) {
  console.error('Failed to copy property number:', error);
  setSnackbar({
    open: true,
    message: '物件番号のコピーに失敗しました',
    severity: 'error',
  });
}
```

### 改善2: データ未取得時

`WorkTaskDetailModal` でデータがまだ取得されていない（`data === null`）場合、オプショナルチェーン `data?.property_address` により各フィールドは `undefined` となり、`{data?.property_address && <Chip ... />}` パターンで自動的に非表示になります。追加のエラーハンドリングは不要です。

## Testing Strategy

### デュアルテストアプローチ

本機能はフロントエンドのみの変更であるため、React Testing Library + Vitest を使用したコンポーネントテストを採用します。

**ユニットテスト（具体例・エッジケース）**:
- ContentCopyIcon が初期状態で表示されること（要件 1.1）
- Tooltip の title が「物件番号をコピー」であること（要件 1.6）
- コピー失敗時にエラースナックバーが表示されること（要件 1.5 エッジケース）
- data が null のとき物件情報フィールドが表示されないこと（要件 2.2）
- 物件番号クリックで clipboard.writeText が呼ばれること（要件 2.6）
- ヘッダーが横スクロール可能なレイアウトであること（要件 2.5）

**プロパティテスト（Vitest + fast-check）**:
- 各プロパティは最低100回のランダム入力で検証します
- プロパティテストは上記「Correctness Properties」セクションの各プロパティに対応します

### プロパティテスト設定

使用ライブラリ: **fast-check**（TypeScript/JavaScript 向けプロパティベーステストライブラリ）

```typescript
// 例: Property 1 のテスト
// Feature: property-detail-copy-and-header-info, Property 1: コピー操作でclipboardに正しい値が書き込まれる
it('コピーボタンクリックで clipboard.writeText が物件番号で呼ばれる', async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ minLength: 1 }), async (propertyNumber) => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      // render & click ...
      expect(writeText).toHaveBeenCalledWith(propertyNumber);
    }),
    { numRuns: 100 }
  );
});
```

```typescript
// 例: Property 4 のテスト
// Feature: property-detail-copy-and-header-info, Property 4: WorkTaskDetailModal ヘッダーに物件情報が表示される
it('値があるフィールドのみヘッダーに表示される', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        property_address: fc.oneof(fc.string(), fc.constant('')),
        property_type: fc.oneof(fc.string(), fc.constant('')),
        seller_name: fc.oneof(fc.string(), fc.constant('')),
        sales_assignee: fc.oneof(fc.string(), fc.constant('')),
        mediation_type: fc.oneof(fc.string(), fc.constant('')),
      }),
      async (fields) => {
        // render with fields ...
        // 値があるフィールドは表示、空は非表示を確認
      }
    ),
    { numRuns: 100 }
  );
});
```

### テストファイル配置

```
frontend/frontend/src/
├── pages/__tests__/
│   └── PropertyListingDetailPage.copy.test.tsx
└── components/__tests__/
    └── WorkTaskDetailModal.header.test.tsx
```
