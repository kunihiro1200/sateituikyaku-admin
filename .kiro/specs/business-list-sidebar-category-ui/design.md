# 設計ドキュメント: business-list-sidebar-category-ui

## Overview

業務リスト（WorkTasksPage）のサイドバーカテゴリーに対して、2つのUI改善を行う。

1. **グループ背景色の統一**: 同じカテゴリープレフィックスを持つ複数の締日エントリーに同一の背景色を適用し、視覚的なグループ識別を可能にする。
2. **「サイト依頼済み納品待ち」への締日表示追加**: `calculateTaskStatus` 関数が返すステータス文字列に `site_registration_deadline` の M/D 形式日付を付加し、他のカテゴリーと同様の挙動にする。

### 変更対象ファイル

- `frontend/frontend/src/utils/workTaskStatusUtils.ts` — ステータス計算ロジック
- `frontend/frontend/src/pages/WorkTasksPage.tsx` — サイドバーUI描画

---

## Architecture

```mermaid
flowchart TD
    A[WorkTasksPage] -->|useMemo| B[getStatusCategories]
    B -->|forEach task| C[calculateTaskStatus]
    C -->|returns status string| B
    B -->|StatusCategory[]| A
    A -->|map| D[ListItemButton per category]
    D -->|sx prop| E[グループ背景色ロジック]
    E -->|getCategoryGroupColor| F[カテゴリープレフィックス → 背景色]
```

### データフロー

1. `WorkTasksPage` が `allWorkTasks` を取得
2. `getStatusCategories(allWorkTasks)` でカテゴリー一覧を生成
3. 各カテゴリーの `label`（ステータス文字列）からプレフィックスを抽出
4. プレフィックスに対応するグループ色を `getCategoryGroupColor` で取得
5. `ListItemButton` の `sx.bgcolor` に適用

---

## Components and Interfaces

### 1. `calculateTaskStatus` の変更（workTaskStatusUtils.ts）

**変更箇所**: ステータス9「サイト依頼済み納品待ち」の返却値

```typescript
// 変更前
return 'サイト依頼済み納品待ち';

// 変更後
const deadline = formatDateMD(task.site_registration_deadline);
return deadline
  ? `サイト依頼済み納品待ち ${deadline}`
  : 'サイト依頼済み納品待ち';
```

### 2. `getCategoryGroupColor` 関数の追加（workTaskStatusUtils.ts）

カテゴリープレフィックスから背景色を返す純粋関数。

```typescript
export const getCategoryGroupColor = (label: string): string | undefined => {
  if (label === 'All') return undefined;
  for (const [prefix, color] of CATEGORY_GROUP_COLORS) {
    if (label.startsWith(prefix)) return color;
  }
  return undefined;
};
```

### 3. `CATEGORY_GROUP_COLORS` 定数の追加（workTaskStatusUtils.ts）

プレフィックスと背景色のマッピング。

```typescript
const CATEGORY_GROUP_COLORS: [string, string][] = [
  ['売買契約　営業確認中',   '#e3f2fd'],
  ['売買契約 入力待ち',      '#e3f2fd'],
  ['売買契約 製本待ち',      '#e3f2fd'],
  ['売買契約 依頼未',        '#e3f2fd'],
  ['サイト登録依頼してください', '#f3e5f5'],
  ['サイト依頼済み納品待ち', '#f3e5f5'],
  ['サイト登録要確認',       '#f3e5f5'],
  ['決済完了チャット送信未', '#fff8e1'],
  ['入金確認未',             '#fff8e1'],
  ['媒介作成_締日',          '#e8f5e9'],
  ['要台帳作成',             '#fce4ec'],
  ['保留',                   '#f5f5f5'],
];
```

**グループ色の設計方針**:
- 売買契約系（4種）: 青系 `#e3f2fd`
- サイト登録系（3種）: 紫系 `#f3e5f5`
- 決済・入金系（2種）: 黄系 `#fff8e1`
- 媒介系（1種）: 緑系 `#e8f5e9`
- 台帳系（1種）: ピンク系 `#fce4ec`
- 保留（1種）: グレー系 `#f5f5f5`

### 4. `WorkTasksPage` サイドバーの変更

`ListItemButton` の `sx` プロパティを更新し、グループ背景色を適用する。

```tsx
// 変更前
sx={{ 
  py: 0.5,
  bgcolor: cat.isDeadlinePast ? '#fff3e0' : undefined,
  '&.Mui-selected': { bgcolor: 'action.selected' }
}}

// 変更後
sx={{ 
  py: 0.5,
  bgcolor: getCategoryGroupColor(cat.label),
  '&.Mui-selected': { bgcolor: 'action.selected' },
  '& .MuiListItemText-primary': {
    color: cat.isDeadlinePast ? 'error.main' : 'inherit',
  },
}}
```

**設計判断**:
- 締日超過（`isDeadlinePast`）は背景色ではなくテキスト色（`error.main`）で表現する。背景色はグループ識別に専用化し、視覚的な役割を分離する。
- 選択状態（`Mui-selected`）は MUI デフォルトの `action.selected` を優先し、グループ色より上位に表示する。

---

## Data Models

### StatusCategory（変更なし）

```typescript
export interface StatusCategory {
  key: string;
  label: string;       // ステータス文字列（例: "サイト依頼済み納品待ち 5/10"）
  count: number;
  deadline?: string;   // M/D形式（例: "5/10"）
  isDeadlinePast?: boolean;
  filter: (task: WorkTask) => boolean;
}
```

`label` フィールドが `getCategoryGroupColor` の入力として使用される。`StatusCategory` 型自体への変更は不要。

### CATEGORY_ORDER（変更なし）

`getStatusCategories` 内のソートロジックは変更不要。`サイト依頼済み納品待ち` プレフィックスは既に `CATEGORY_ORDER` に含まれており、日付付きステータス文字列（例: `サイト依頼済み納品待ち 5/10`）も `startsWith` で正しく順序付けされる。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: グループ背景色の一貫性

*For any* StatusCategory エントリーのリストにおいて、同じカテゴリープレフィックスを持つ全エントリーに対して `getCategoryGroupColor` が返す色は同一でなければならない。

**Validates: Requirements 1.1, 1.2**

### Property 2: 異なるグループは異なる色

*For any* 2つの異なるカテゴリープレフィックス（例: 「売買契約」系と「サイト登録」系）に対して、`getCategoryGroupColor` が返す色は異なる値でなければならない。

**Validates: Requirements 1.3**

### Property 3: 「サイト依頼済み納品待ち」の締日付きステータス文字列

*For any* `site_registration_deadline` が有効な日付文字列であるタスクに対して、`calculateTaskStatus` が「サイト依頼済み納品待ち」を返す条件を満たす場合、返却値は `"サイト依頼済み納品待ち M/D"` の形式でなければならない。

**Validates: Requirements 2.1, 2.3**

### Property 4: 無効な締日の場合は日付なし

*For any* `site_registration_deadline` が空・null・無効な日付であるタスクに対して、`calculateTaskStatus` が「サイト依頼済み納品待ち」条件を満たす場合、返却値は `"サイト依頼済み納品待ち"` のみ（日付なし）でなければならない。

**Validates: Requirements 2.2**

### Property 5: 締日超過フラグの正確性

*For any* ステータス文字列に M/D 形式の日付が含まれるカテゴリーエントリーに対して、`isDeadlinePast` は当日以前の日付の場合に `true`、未来の日付の場合に `false` でなければならない。

**Validates: Requirements 1.7, 2.4**

---

## Error Handling

### 無効な日付文字列

`formatDateMD` は既に `parseDate` を通じて無効な日付を `null` として扱い、空文字列を返す。「サイト依頼済み納品待ち」の変更後も同じ `formatDateMD` を使用するため、追加のエラーハンドリングは不要。

### 未知のカテゴリープレフィックス

`getCategoryGroupColor` はマッピングに存在しないプレフィックスに対して `undefined` を返す。MUI の `bgcolor: undefined` はデフォルト背景色（白）として扱われるため、安全にフォールバックする。

### 「All」エントリー

`getCategoryGroupColor` は `label === 'All'` の場合に明示的に `undefined` を返し、グループ色を適用しない（要件 1.6 に対応）。

---

## Testing Strategy

### ユニットテスト（example-based）

**対象**: `workTaskStatusUtils.ts`

1. `calculateTaskStatus` — 「サイト依頼済み納品待ち」条件のタスクに有効な `site_registration_deadline` が設定されている場合、`"サイト依頼済み納品待ち M/D"` を返すこと
2. `calculateTaskStatus` — `site_registration_deadline` が空の場合、`"サイト依頼済み納品待ち"` のみを返すこと
3. `getCategoryGroupColor` — 各カテゴリープレフィックスに対して期待する色を返すこと
4. `getCategoryGroupColor` — `'All'` に対して `undefined` を返すこと
5. `getCategoryGroupColor` — 未知のプレフィックスに対して `undefined` を返すこと

### プロパティベーステスト

**対象**: `getCategoryGroupColor`

- **Property 1**: 同じプレフィックスで始まる任意の文字列に対して、常に同じ色を返す（一貫性）
- **Property 3/4**: 有効/無効な `site_registration_deadline` を持つタスクに対して、`calculateTaskStatus` の返却値が期待フォーマットに一致する（ラウンドトリップ的検証）

**ライブラリ**: `fast-check`（TypeScript/JavaScript 向け PBT ライブラリ）

**設定**: 各プロパティテストは最低 100 イテレーション実行

**タグ形式**: `Feature: business-list-sidebar-category-ui, Property {N}: {property_text}`

### UIテスト（手動確認）

- サイドバーで同じカテゴリープレフィックスのエントリーが同色背景で表示されること
- 選択状態のエントリーが MUI デフォルト選択色で表示されること
- 締日超過エントリーのテキストが赤色で表示されること
- 「サイト依頼済み納品待ち」エントリーに日付が表示されること
