# 設計ドキュメント: 物件リスト報告ページ改善

## 概要

`PropertyReportPage.tsx` に2つの改善を加える。

1. **送信履歴テーブルの5行固定表示**: 現在は件数に応じて可変行数で表示されているが、常に5行固定（スクロール対応）に変更する。
2. **買主テーブルの追加**: `PropertyListingDetailPage.tsx` と同じ `CompactBuyerListForProperty` コンポーネントを使って、送信履歴テーブルの下に買主一覧を表示する。

## アーキテクチャ

変更はフロントエンドのみ。バックエンドAPIは既存のものをそのまま利用する。

```
PropertyReportPage.tsx
  ├── 左カラム: 報告情報フォーム（変更なし）
  └── 右カラム:
        ├── 送信履歴テーブル（5行固定・スクロール対応）← 変更
        ├── 前回メール内容（変更なし）
        └── 買主一覧テーブル（CompactBuyerListForProperty）← 追加
```

## コンポーネントとインターフェース

### 送信履歴テーブル（変更）

現在の実装:
- `reportHistory.length === 0` の場合は「送信履歴はありません」テキストを表示
- 件数に応じて可変行数でテーブルを表示

変更後の実装:
- 常に5行固定のテーブルを表示
- 実データが5件未満の場合は空行（「-」）で埋める
- 5件超の場合はテーブルコンテナに固定高さ + `overflow: 'auto'` を設定してスクロール対応
- 空行はクリックイベントなし（`cursor: 'default'`、`hover` なし）

```tsx
// 5行固定表示のためのヘルパー関数
const getDisplayRows = (history: ReportHistory[], rowCount: number = 5) => {
  const rows = [...history];
  while (rows.length < rowCount) {
    rows.push(null); // null = 空行
  }
  return rows;
};
```

テーブルコンテナのスタイル:
```tsx
<TableContainer sx={{ maxHeight: ROW_HEIGHT * 5 + HEADER_HEIGHT, overflow: 'auto' }}>
```

### 買主テーブル（追加）

`PropertyListingDetailPage.tsx` と同じ `CompactBuyerListForProperty` コンポーネントを使用する。

追加するステート:
```tsx
const [buyers, setBuyers] = useState<any[]>([]);
const [buyersLoading, setBuyersLoading] = useState(false);
```

データ取得:
```tsx
const fetchBuyers = async () => {
  if (!propertyNumber) return;
  setBuyersLoading(true);
  try {
    const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
    setBuyers(response.data || []);
  } catch (error) {
    // エラーは無視して空リストを表示
    setBuyers([]);
  } finally {
    setBuyersLoading(false);
  }
};
```

`useEffect` に `fetchBuyers()` を追加:
```tsx
useEffect(() => {
  if (propertyNumber) {
    fetchData();
    fetchJimuInitials();
    fetchJimuStaff();
    fetchTemplates();
    fetchReportHistory();
    fetchBuyers(); // 追加
  }
}, [propertyNumber]);
```

## データモデル

### 既存のデータモデル（変更なし）

```typescript
interface ReportHistory {
  id: number;
  property_number: string;
  report_date: string | null;
  report_assignee: string | null;
  report_completed: string | null;
  sent_at: string;
  template_name: string | null;
  subject: string | null;
  body: string | null;
}
```

### 買主データ（既存APIのレスポンス）

`/api/property-listings/{propertyNumber}/buyers` のレスポンスは `CompactBuyerListForProperty` が期待する型と互換性がある:

```typescript
interface BuyerWithDetails {
  buyer_id?: string;
  id?: string | number;
  name: string;
  buyer_number: string;
  reception_date?: string;
  latest_viewing_date?: string;
  viewing_time?: string;
  latest_status?: string;
  has_offer?: boolean;
  inquiry_confidence?: string;
  phone_number?: string;
  email?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 送信履歴テーブルは常に5行を表示する

*For any* 送信履歴の件数（0件以上）に対して、`getDisplayRows` 関数が返す配列の長さは常に5以上である

**Validates: Requirements 1.1, 1.2**

### Property 2: 空行は「-」で埋められる

*For any* 送信履歴の件数 N（0 ≤ N < 5）に対して、`getDisplayRows` が返す配列のうち末尾（5 - N）個の要素は `null` である

**Validates: Requirements 1.2, 1.6**

### Property 3: 買主データ取得失敗時は空リストを表示する

*For any* APIエラーが発生した場合、`buyers` ステートは空配列（`[]`）になり、エラーは伝播しない

**Validates: Requirements 2.5**

## エラーハンドリング

### 買主データ取得エラー

要件2.5に従い、買主データの取得に失敗した場合はエラーを無視して空の買主リストを表示する。スナックバーによるエラー通知も行わない。

```tsx
const fetchBuyers = async () => {
  setBuyersLoading(true);
  try {
    const response = await api.get(`/api/property-listings/${propertyNumber}/buyers`);
    setBuyers(response.data || []);
  } catch (error) {
    // エラーは無視して空リストを表示（要件2.5）
    setBuyers([]);
  } finally {
    setBuyersLoading(false);
  }
};
```

### 空行クリックの無視

空行（`null`）の行には `onClick` ハンドラーを設定せず、`hover` スタイルも適用しない。

```tsx
{getDisplayRows(reportHistory).map((h, index) => (
  h === null ? (
    <TableRow key={`empty-${index}`}>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
      <TableCell>-</TableCell>
    </TableRow>
  ) : (
    <TableRow
      key={h.id}
      hover
      onClick={() => { setSelectedHistory(h); setHistoryDialogOpen(true); }}
      sx={{ cursor: 'pointer' }}
    >
      {/* ... */}
    </TableRow>
  )
))}
```

## テスト戦略

### ユニットテスト

`getDisplayRows` ヘルパー関数のテスト:
- 0件 → 5個の `null` を返す
- 3件 → 3個の実データ + 2個の `null` を返す
- 5件 → 5個の実データを返す（`null` なし）
- 7件 → 7個の実データを返す（5行以上でもそのまま返す）

### プロパティベーステスト

**Property 1 & 2 のテスト**:

```typescript
// Feature: property-report-page-enhancements, Property 1: 送信履歴テーブルは常に5行を表示する
// Feature: property-report-page-enhancements, Property 2: 空行は「-」で埋められる
it.each(
  Array.from({ length: 10 }, (_, i) => i) // 0〜9件
)('履歴が%d件の場合、getDisplayRowsは5行以上を返す', (count) => {
  const history = Array.from({ length: count }, (_, i) => mockHistory(i));
  const rows = getDisplayRows(history);
  expect(rows.length).toBeGreaterThanOrEqual(5);
  // 5件未満の場合、末尾は null で埋まっている
  if (count < 5) {
    expect(rows.slice(count).every(r => r === null)).toBe(true);
  }
});
```

**Property 3 のテスト**:

```typescript
// Feature: property-report-page-enhancements, Property 3: 買主データ取得失敗時は空リストを表示する
it('APIエラー時にbuyersは空配列になる', async () => {
  // APIをモックしてエラーを返す
  jest.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network Error'));
  // fetchBuyersを呼び出す
  await fetchBuyers();
  expect(buyers).toEqual([]);
});
```

### 統合テスト（手動確認）

- 送信履歴0件: 5行の空行が表示される（「送信履歴はありません」は表示されない）
- 送信履歴3件: 3行の実データ + 2行の空行が表示される
- 送信履歴7件: スクロールバーが表示され、5行が固定表示される
- 買主テーブル: 送信履歴テーブルの下に表示される
- 買主行クリック: 新しいタブで買主詳細ページが開く
- 空行クリック: 何も起こらない
