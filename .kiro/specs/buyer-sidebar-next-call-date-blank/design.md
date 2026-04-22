# 設計ドキュメント: 買主リストサイドバー「次電日空欄」カテゴリー追加

## 概要

買主リストのサイドバーに「次電日空欄」サブカテゴリーを追加する。
「担当（イニシャル）」カテゴリーの配下に、「当日TEL（イニシャル）」の直後に表示される。

対象買主の条件（AND条件）：
- `latest_status` が ステータスA または ステータスB に完全一致（AZ・BZ は除外）
- `next_call_date` が NULL
- `broker_inquiry` が NULL または空文字
- `follow_up_assignee` が入力済み（NULL でも空文字でもない）

変更対象ファイルは3つ：
1. `frontend/frontend/src/components/BuyerStatusSidebar.tsx` — UI表示
2. `backend/src/services/BuyerService.ts` — カウント取得・フィルタリング
3. `backend/src/services/SidebarCountsUpdateService.ts` — 差分更新

---

## アーキテクチャ

既存のサイドバーカテゴリー追加パターンに完全に準拠する。
`todayCallAssigned` カテゴリーの実装を参考に、同じデータフローで `nextCallDateBlank` を追加する。

```mermaid
flowchart TD
    A[買主データ更新] --> B[SidebarCountsUpdateService\ndetermineBuyerCategories]
    B --> C{nextCallDateBlank\n条件を満たすか？}
    C -- Yes --> D[buyer_sidebar_counts テーブル\ncategory=nextCallDateBlank\nassignee=イニシャル]
    C -- No --> E[カウントなし]
    D --> F[BuyerService\ngetSidebarCounts]
    F --> G[categoryCounts.nextCallDateBlankCounts\nRecord<string, number>]
    G --> H[BuyerStatusSidebar\nUI表示]
    H --> I[↳ 次電日空欄(イニシャル)\n赤字 #d32f2f]
```

### データフロー

1. **書き込み側**: 買主データ更新時に `SidebarCountsUpdateService.determineBuyerCategories()` が条件判定し、`buyer_sidebar_counts` テーブルを差分更新
2. **読み込み側**: `BuyerService.getSidebarCounts()` が `buyer_sidebar_counts` テーブルから `nextCallDateBlank` カテゴリーを読み込み、`nextCallDateBlankCounts` として返す
3. **表示側**: `BuyerStatusSidebar` が `nextCallDateBlankCounts` を受け取り、担当別サブカテゴリーとして表示
4. **フィルタリング**: ユーザーがクリックすると `nextCallDateBlank:イニシャル` が `statusCategory` として渡され、`BuyerService.getAll()` がDBクエリを構築

---

## コンポーネントとインターフェース

### 1. BuyerStatusSidebar.tsx

#### CategoryCounts インターフェース拡張

```typescript
interface CategoryCounts {
  // 既存フィールド...
  nextCallDateBlankCounts?: Record<string, number>;  // 追加
}
```

#### getCategoryColor 拡張

```typescript
case 'nextCallDateBlank':
  return '#d32f2f'; // 赤
// default の前に追加
// startsWith('nextCallDateBlank:') も追加
if (category.startsWith('nextCallDateBlank:')) {
  return '#d32f2f';
}
```

#### getCategoryLabel 拡張

```typescript
case 'nextCallDateBlank':
  return '次電日空欄';
// default の前に追加
// startsWith('nextCallDateBlank:') も追加
if (category.startsWith('nextCallDateBlank:')) {
  return `次電日空欄(${category.replace('nextCallDateBlank:', '')})`;
}
```

#### サブカテゴリー表示ロジック

担当者別ループ内で `todayCallAssigned` の直後に追加：

```typescript
// サブカテゴリ: 次電日空欄(イニシャル)
const nextCallDateBlankCount = categoryCounts.nextCallDateBlankCounts?.[assignee] ?? 0;
if (nextCallDateBlankCount > 0) {
  categoryList.push({
    key: `nextCallDateBlank:${assignee}`,
    label: `次電日空欄(${assignee})`,
    count: nextCallDateBlankCount,
    color: '#d32f2f',
    isSubCategory: true,
    parentKey: key,
  });
}
```

#### renderCategoryItem の色制御

`nextCallDateBlank:` で始まるカテゴリーも赤字・太字で表示する：

```typescript
const isNextCallDateBlankCategory = category.key.startsWith('nextCallDateBlank:');
// primaryTypographyProps の color 判定に追加
color: (isTodayCallAssignedCategory || isNextCallDateBlankCategory) ? '#d32f2f' : ...
fontWeight: (isTodayCallAssignedCategory || isNextCallDateBlankCategory) ? 'bold' : 'normal'
```

---

### 2. BuyerService.ts

#### shouldUpdateBuyerSidebarCounts 拡張

```typescript
const sidebarFields = [
  'next_call_date', 'follow_up_assignee', 'viewing_date',
  'notification_sender', 'inquiry_email_phone', 'pinrich',
  'inquiry_source',
  'latest_status',   // 追加: nextCallDateBlank 条件に影響
  'broker_inquiry',  // 追加: nextCallDateBlank 条件に影響
];
```

#### getSidebarCounts 拡張

`categoryCounts` 初期化に追加：

```typescript
nextCallDateBlankCounts: {} as Record<string, number>,
```

`for (const row of data)` ループに追加：

```typescript
} else if (row.category === 'nextCallDateBlank' && row.assignee) {
  categoryCounts.nextCallDateBlankCounts[row.assignee] = row.count || 0;
}
```

#### getSidebarCountsFallback 拡張

`result` 初期化に追加：

```typescript
nextCallDateBlankCounts: {} as Record<string, number>,
```

各買主のループ内に追加（`allBuyers.forEach` の中）：

```typescript
// 次電日空欄(イニシャル)
const STATUS_A = 'A:この物件を気に入っている（こちらからの一押しが必要）';
const STATUS_B = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
const isStatusAorB = buyer.latest_status === STATUS_A || buyer.latest_status === STATUS_B;
const isBrokerInquiryBlank = !buyer.broker_inquiry || buyer.broker_inquiry === '';
const isNextCallDateBlank = !buyer.next_call_date;
const hasFollowUpAssignee = !!buyer.follow_up_assignee && buyer.follow_up_assignee !== '';

if (isStatusAorB && isNextCallDateBlank && isBrokerInquiryBlank && hasFollowUpAssignee) {
  const assignee = buyer.follow_up_assignee;
  result.nextCallDateBlankCounts[assignee] = (result.nextCallDateBlankCounts[assignee] || 0) + 1;
}
```

#### getAll 拡張（statusCategory フィルタリング）

`default` ブロック内の動的カテゴリー処理に追加：

```typescript
} else if (dynamicCategory.startsWith('nextCallDateBlank:')) {
  const assigneeInitial = dynamicCategory.replace('nextCallDateBlank:', '');
  const STATUS_A = 'A:この物件を気に入っている（こちらからの一押しが必要）';
  const STATUS_B = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
  query = query
    .eq('follow_up_assignee', assigneeInitial)
    .in('latest_status', [STATUS_A, STATUS_B])
    .is('next_call_date', null)
    .or('broker_inquiry.is.null,broker_inquiry.eq.');
}
```

---

### 3. SidebarCountsUpdateService.ts

#### determineBuyerCategories 拡張

既存の `todayCallAssigned` 判定の直後に追加：

```typescript
// 次電日空欄(イニシャル)
const STATUS_A = 'A:この物件を気に入っている（こちらからの一押しが必要）';
const STATUS_B = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
const isStatusAorB = buyer.latest_status === STATUS_A || buyer.latest_status === STATUS_B;
const isBrokerInquiryBlank = !buyer.broker_inquiry || buyer.broker_inquiry === '';
const isNextCallDateBlank = !buyer.next_call_date;
const hasFollowUpAssignee = !!buyer.follow_up_assignee && buyer.follow_up_assignee !== '';

if (isStatusAorB && isNextCallDateBlank && isBrokerInquiryBlank && hasFollowUpAssignee) {
  categories.push({ category: 'nextCallDateBlank', assignee: buyer.follow_up_assignee });
}
```

---

## データモデル

### buyer_sidebar_counts テーブル（既存）

新規レコードの形式：

| カラム | 値 |
|--------|-----|
| `category` | `'nextCallDateBlank'` |
| `assignee` | イニシャル（例: `'Y'`, `'K'`） |
| `count` | 対象件数 |
| `updated_at` | 更新日時 |

スキーマ変更は不要。既存テーブルに新カテゴリーのレコードが追加されるだけ。

### フィルター条件の詳細

```
AND(
  latest_status IN (
    'A:この物件を気に入っている（こちらからの一押しが必要）',
    'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。'
  )  ← 完全一致（AZ・BZは自動除外）
  next_call_date IS NULL
  broker_inquiry IS NULL OR broker_inquiry = ''
  follow_up_assignee IS NOT NULL AND follow_up_assignee != ''
)
```

AZ・BZの除外は `IN` による完全一致チェックで自動的に実現される。

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: nextCallDateBlank 条件判定の正確性

*任意の* 買主データに対して、`determineBuyerCategories()` が `nextCallDateBlank` カテゴリーを返すのは、`latest_status` がステータスA/Bに完全一致し、かつ `next_call_date` が NULL で、かつ `broker_inquiry` が NULL/空文字で、かつ `follow_up_assignee` が入力済みの場合に限る

**Validates: Requirements 1.1, 1.2, 1.2a, 1.3, 1.4, 1.5, 3.1**

### プロパティ2: フォールバック計算の一貫性

*任意の* 買主データセットに対して、`getSidebarCountsFallback()` が返す `nextCallDateBlankCounts` の各イニシャルのカウントは、そのイニシャルを `follow_up_assignee` に持ちプロパティ1の条件を満たす買主の数と等しい

**Validates: Requirements 3.5**

### プロパティ3: サイドバー表示順序の保証

*任意の* イニシャルに対して、`nextCallDateBlankCounts[イニシャル]` が1以上の場合、`categoryList` 内で `nextCallDateBlank:イニシャル` エントリーは `todayCallAssigned:イニシャル` エントリーの直後（または `todayCallAssigned:イニシャル` が存在しない場合は `assigned:イニシャル` の直後）に配置される

**Validates: Requirements 2.2, 2.4**

### プロパティ4: フィルタリングの完全性

*任意の* イニシャルに対して、`statusCategory = 'nextCallDateBlank:イニシャル'` でフィルタリングした結果に含まれる全ての買主は、プロパティ1の4条件を全て満たす

**Validates: Requirements 4.1, 4.3, 4.4, 4.5**

---

## エラーハンドリング

既存パターンに準拠する。

- `buyer_sidebar_counts` テーブルが空の場合: `getSidebarCountsFallback()` に自動フォールバック（既存の仕組み）
- `nextCallDateBlankCounts` が未定義の場合: フロントエンドで `?? 0` / `?? {}` でデフォルト値を使用
- `determineBuyerCategories()` でのエラー: 既存の try/catch で捕捉され、ログ出力後に処理継続

---

## テスト戦略

### ユニットテスト（例ベース）

**SidebarCountsUpdateService.determineBuyerCategories()**

| テストケース | 期待結果 |
|------------|---------|
| ステータスA + next_call_date NULL + broker_inquiry NULL + follow_up_assignee='Y' | `[{ category: 'nextCallDateBlank', assignee: 'Y' }]` を含む |
| ステータスB + 同条件 | `[{ category: 'nextCallDateBlank', assignee: 'K' }]` を含む |
| ステータスAZ + 同条件 | `nextCallDateBlank` を含まない |
| ステータスBZ + 同条件 | `nextCallDateBlank` を含まない |
| ステータスA + next_call_date に値あり | `nextCallDateBlank` を含まない |
| ステータスA + broker_inquiry='業者問合せ' | `nextCallDateBlank` を含まない |
| ステータスA + follow_up_assignee=NULL | `nextCallDateBlank` を含まない |

**BuyerService.shouldUpdateBuyerSidebarCounts()**

| テストケース | 期待結果 |
|------------|---------|
| `{ latest_status: 'A:...' }` | `true` |
| `{ broker_inquiry: '' }` | `true` |
| `{ name: '田中' }` | `false` |

**getCategoryColor / getCategoryLabel**

| 入力 | 期待結果 |
|------|---------|
| `'nextCallDateBlank:Y'` | color: `'#d32f2f'` |
| `'nextCallDateBlank:Y'` | label: `'次電日空欄(Y)'` |

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript）を使用する。各テストは最低100回実行する。

**プロパティ1のテスト実装方針**:

```typescript
// Feature: buyer-sidebar-next-call-date-blank, Property 1: nextCallDateBlank条件判定の正確性
fc.assert(fc.property(
  fc.record({
    latest_status: fc.oneof(
      fc.constant('A:この物件を気に入っている（こちらからの一押しが必要）'),
      fc.constant('B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。'),
      fc.constant('AZ:Aだが次電日不要'),
      fc.constant('BZ：Bだが次電日不要'),
      fc.string(),
    ),
    next_call_date: fc.oneof(fc.constant(null), fc.string()),
    broker_inquiry: fc.oneof(fc.constant(null), fc.constant(''), fc.string()),
    follow_up_assignee: fc.oneof(fc.constant(null), fc.constant(''), fc.string()),
    // その他フィールド...
  }),
  (buyer) => {
    const categories = service.determineBuyerCategories(buyer);
    const hasNextCallDateBlank = categories.some(c => c.category === 'nextCallDateBlank');
    
    const STATUS_A = 'A:この物件を気に入っている（こちらからの一押しが必要）';
    const STATUS_B = 'B:1年以内に引っ越し希望だが、この物件ではない。駐車場の要件や、日当たり等が合わない。';
    const shouldMatch =
      (buyer.latest_status === STATUS_A || buyer.latest_status === STATUS_B) &&
      !buyer.next_call_date &&
      (!buyer.broker_inquiry || buyer.broker_inquiry === '') &&
      !!buyer.follow_up_assignee && buyer.follow_up_assignee !== '';
    
    return hasNextCallDateBlank === shouldMatch;
  }
));
```

**プロパティ3のテスト実装方針**:

```typescript
// Feature: buyer-sidebar-next-call-date-blank, Property 3: サイドバー表示順序の保証
fc.assert(fc.property(
  fc.string({ minLength: 1 }),  // イニシャル
  fc.nat({ max: 100 }),          // nextCallDateBlankCount
  fc.nat({ max: 100 }),          // todayCallCount
  fc.nat({ max: 100 }),          // assignedCount
  (assignee, nextCallDateBlankCount, todayCallCount, assignedCount) => {
    // categoryCounts を構築してサイドバーのカテゴリーリストを生成
    // nextCallDateBlank が todayCallAssigned の直後にあることを検証
  }
));
```
