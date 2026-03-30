# デザインドキュメント: 売主サイドバー担当者階層表示

## 概要

売主リストのサイドバー（`SellerStatusSidebar.tsx`）において、担当者別カテゴリの表示を階層構造に変更する。

現在は「当日TEL(Y)」「当日TEL(I)」などが独立したカテゴリとして並んでいるが、買主リストと同様に、担当者ごとの親カテゴリ（緑色バッジ）の下に当日TELをサブアイテム（オレンジ色バッジ、インデント付き「↳」）として表示する階層構造に変更する。

### 変更の背景

- 現在の `renderAssigneeCategories()` は `visitAssigned:${assignee}` と `todayCallAssigned:${assignee}` を別々のボタンとして並べている
- 親カテゴリのバッジ色が `#ff5722`（オレンジ）になっており、要件の緑色（`#4caf50`）と異なる
- サブアイテムに「↳」プレフィックスと左インデントが付いていない

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/components/SellerStatusSidebar.tsx` | `renderAssigneeCategories()` の表示ロジック変更 |
| `frontend/frontend/src/utils/sellerStatusFilters.ts` | 変更なし（既存ロジックをそのまま利用） |

### 変更しないもの

- `StatusCategory` 型定義（`visitAssigned:${string}` / `todayCallAssigned:${string}` はそのまま）
- `CategoryCounts` 型定義（`visitAssignedCounts` / `todayCallAssignedCounts` はそのまま）
- `filterSellersByCategory()` のフィルタリングロジック
- `onCategorySelect` コールバックの呼び出し方（カテゴリキーは変更なし）

### データフロー

```
assigneeInitials (prop)
  ↓
renderAssigneeCategories()
  ↓ 各イニシャルに対して
  ├─ visitAssignedCounts[assignee] → 親カテゴリ件数（緑バッジ）
  └─ todayCallAssignedCounts[assignee] → サブアイテム件数（オレンジバッジ）
```

---

## コンポーネントとインターフェース

### SellerStatusSidebarProps（変更なし）

```typescript
interface SellerStatusSidebarProps {
  assigneeInitials?: string[];           // 担当者イニシャル一覧（順序を保持）
  categoryCounts?: CategoryCounts;       // visitAssignedCounts / todayCallAssignedCounts を含む
  selectedCategory?: StatusCategory;
  onCategorySelect?: (category: StatusCategory) => void;
  // ... 他のプロパティは変更なし
}
```

### renderAssigneeCategories() の変更

**変更前の構造:**
```
[担当（Y）ボタン]  ← #ff5722（オレンジ）
  [当日TEL(Y)ボタン]  ← インデントあり、#ff5722
```

**変更後の構造:**
```
[担当(Y)ボタン]  ← #4caf50（緑）、件数バッジ付き
  [↳ 当日TEL(Y)ボタン]  ← インデント付き、#ff5722（オレンジ）
```

### カテゴリキーとコールバック（変更なし）

| クリック対象 | onCategorySelect に渡すキー |
|------------|--------------------------|
| 親カテゴリ「担当(Y)」 | `visitAssigned:Y` |
| サブアイテム「↳ 当日TEL(Y)」 | `todayCallAssigned:Y` |

---

## データモデル

### CategoryCounts（変更なし）

```typescript
export interface CategoryCounts {
  // ... 既存フィールド
  visitAssignedCounts?: Record<string, number>;     // 担当者別全件カウント
  todayCallAssignedCounts?: Record<string, number>; // 担当者別当日TELカウント
}
```

### 表示ロジック

| 条件 | 表示 |
|------|------|
| `visitAssignedCounts[assignee] > 0` または `todayCallAssignedCounts[assignee] > 0` | 親カテゴリを表示 |
| 両方が 0 | 親カテゴリを非表示 |
| `todayCallAssignedCounts[assignee] > 0` | サブアイテムを表示 |
| `todayCallAssignedCounts[assignee] === 0` | サブアイテムを非表示 |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 両カウントが0の担当者は非表示

*For any* 担当者イニシャルに対して、`visitAssignedCounts[assignee]` と `todayCallAssignedCounts[assignee]` が両方0（または未定義）の場合、その担当者の親カテゴリはレンダリング結果に含まれない。

**Validates: Requirements 1.3**

### Property 2: todayCallAssignedCounts とサブアイテム表示の双方向性

*For any* 担当者イニシャルと任意の件数データに対して、サブアイテム（`↳ 当日TEL(...)` 行）が表示される場合かつその場合に限り、`todayCallAssignedCounts[assignee]` が1以上である。

**Validates: Requirements 2.1, 2.4**

### Property 3: クリック時のカテゴリキー正確性

*For any* 担当者イニシャル `assignee` に対して、親カテゴリボタンをクリックすると `onCategorySelect` が `visitAssigned:${assignee}` で呼び出され、サブアイテムボタンをクリックすると `todayCallAssigned:${assignee}` で呼び出される。

**Validates: Requirements 3.1, 3.2**

### Property 4: assigneeInitials の順序保持

*For any* `assigneeInitials` 配列に対して、レンダリングされる担当者カテゴリの順序は `assigneeInitials` の配列順序と一致する（カウントが0で非表示になる担当者を除く）。

**Validates: Requirements 1.4**

### Property 5: assigneeInitials 空時のフォールバック

*For any* `sellers` データに対して、`assigneeInitials` が空配列の場合、`sellers` の `visitAssigneeInitials` フィールドから動的に取得したイニシャルを使って担当者カテゴリが表示される。

**Validates: Requirements 4.3**

---

## エラーハンドリング

### categoryCounts が未定義の場合

`categoryCounts?.visitAssignedCounts` が `undefined` の場合、`validSellers` からフィルタリングして件数を計算する（既存の `getCount()` ロジックを流用）。

### assigneeInitials が空の場合

`sellers` データから動的にイニシャルを取得するフォールバックロジックは既存実装のまま維持する。

### 件数が0の担当者

両カウントが0の担当者は `null` を返してレンダリングをスキップする（既存ロジックと同様）。

---

## テスト戦略

### デュアルテストアプローチ

ユニットテストとプロパティベーステストの両方を使用する。ユニットテストは具体的な例・エッジケース・リグレッションを検証し、プロパティテストは全入力に対する普遍的なプロパティを検証する。

### ユニットテスト（具体例・リグレッション）

- 既存カテゴリ（`visitDayBefore`、`todayCall`、`todayCallWithInfo` など）の表示と動作が変更されないこと
- 担当者別セクションが既存カテゴリの下部に区切り線付きで表示されること
- サブアイテムのラベルが `↳ 当日TEL(${assignee})` 形式であること
- 親カテゴリのバッジ色が `#4caf50`（緑）であること
- サブアイテムのバッジ色が `#ff5722`（オレンジ）であること
- サブアイテムに左インデント（`pl: 2` 相当）が付いていること

### プロパティベーステスト

**使用ライブラリ**: `fast-check`（TypeScript/JavaScript向けプロパティベーステストライブラリ）

**最小実行回数**: 各プロパティテストにつき100回以上

**タグ形式**: `Feature: seller-sidebar-assignee-hierarchy, Property {番号}: {プロパティ内容}`

各プロパティは1つのプロパティベーステストで実装すること。

#### Property 1 テスト

```typescript
// Feature: seller-sidebar-assignee-hierarchy, Property 1: 両カウントが0の担当者は非表示
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 5 }),
  (assignee) => {
    const counts = {
      visitAssignedCounts: { [assignee]: 0 },
      todayCallAssignedCounts: { [assignee]: 0 }
    };
    const { queryAllByText } = render(
      <SellerStatusSidebar assigneeInitials={[assignee]} categoryCounts={counts} />
    );
    return queryAllByText(new RegExp(`担当\\(${assignee}\\)`)).length === 0;
  }
), { numRuns: 100 });
```

#### Property 2 テスト

```typescript
// Feature: seller-sidebar-assignee-hierarchy, Property 2: todayCallAssignedCounts とサブアイテム表示の双方向性
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 5 }),
  fc.integer({ min: 1 }),  // visitCount > 0（親カテゴリが表示される前提）
  fc.integer({ min: 0 }),  // todayCallCount（0 or 正）
  (assignee, visitCount, todayCallCount) => {
    const counts = {
      visitAssignedCounts: { [assignee]: visitCount },
      todayCallAssignedCounts: { [assignee]: todayCallCount }
    };
    const { queryAllByText } = render(
      <SellerStatusSidebar assigneeInitials={[assignee]} categoryCounts={counts} />
    );
    const hasSubItem = queryAllByText(new RegExp(`↳ 当日TEL\\(${assignee}\\)`)).length > 0;
    return hasSubItem === (todayCallCount > 0);
  }
), { numRuns: 100 });
```

#### Property 3 テスト

```typescript
// Feature: seller-sidebar-assignee-hierarchy, Property 3: クリック時のカテゴリキー正確性
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 5 }),
  fc.integer({ min: 1 }),
  fc.integer({ min: 1 }),
  (assignee, visitCount, todayCallCount) => {
    const onCategorySelect = jest.fn();
    const counts = {
      visitAssignedCounts: { [assignee]: visitCount },
      todayCallAssignedCounts: { [assignee]: todayCallCount }
    };
    const { getByText } = render(
      <SellerStatusSidebar
        assigneeInitials={[assignee]}
        categoryCounts={counts}
        onCategorySelect={onCategorySelect}
      />
    );
    fireEvent.click(getByText(new RegExp(`担当\\(${assignee}\\)`)));
    const parentKey = onCategorySelect.mock.calls[0]?.[0];
    fireEvent.click(getByText(new RegExp(`↳ 当日TEL\\(${assignee}\\)`)));
    const subKey = onCategorySelect.mock.calls[1]?.[0];
    return parentKey === `visitAssigned:${assignee}` && subKey === `todayCallAssigned:${assignee}`;
  }
), { numRuns: 100 });
```

#### Property 4 テスト

```typescript
// Feature: seller-sidebar-assignee-hierarchy, Property 4: assigneeInitials の順序保持
fc.assert(fc.property(
  fc.uniqueArray(fc.string({ minLength: 1, maxLength: 3 }), { minLength: 2, maxLength: 5 }),
  (initials) => {
    const counts: Record<string, number> = {};
    initials.forEach(a => { counts[a] = 1; });
    const categoryCounts = { visitAssignedCounts: counts, todayCallAssignedCounts: {} };
    const { container } = render(
      <SellerStatusSidebar assigneeInitials={initials} categoryCounts={categoryCounts} />
    );
    const buttons = Array.from(container.querySelectorAll('button'))
      .map(b => b.textContent ?? '')
      .filter(t => /担当\(/.test(t));
    return initials.every((a, i) => buttons[i]?.includes(a));
  }
), { numRuns: 100 });
```

#### Property 5 テスト

```typescript
// Feature: seller-sidebar-assignee-hierarchy, Property 5: assigneeInitials 空時のフォールバック
fc.assert(fc.property(
  fc.array(
    fc.record({ visitAssigneeInitials: fc.string({ minLength: 1, maxLength: 3 }) }),
    { minLength: 1, maxLength: 5 }
  ),
  (sellers) => {
    const { queryAllByText } = render(
      <SellerStatusSidebar assigneeInitials={[]} sellers={sellers} />
    );
    const uniqueAssignees = [...new Set(sellers.map(s => s.visitAssigneeInitials))];
    // フォールバック時、sellersから取得したイニシャルで担当カテゴリが生成される
    return uniqueAssignees.length > 0
      ? queryAllByText(/担当\(/).length > 0
      : queryAllByText(/担当\(/).length === 0;
  }
), { numRuns: 100 });
```
