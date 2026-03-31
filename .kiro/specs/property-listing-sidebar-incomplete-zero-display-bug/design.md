# 設計ドキュメント

## Technical Context

### 関連ファイル

- `frontend/frontend/src/components/PropertySidebarStatus.tsx` - サイドバーコンポーネント
- `frontend/frontend/src/pages/PropertyListingsPage.tsx` - 物件リストページ

### 現在の実装

`PropertySidebarStatus.tsx`の`statusList`生成ロジック:

```typescript
const statusList = useMemo(() => {
  const list = [{ key: 'all', label: 'すべて', count: statusCounts.all }];

  const sortedStatuses = Object.entries(statusCounts)
    .filter(([key]) => key !== 'all' && key !== '')
    .sort((a, b) => {
      const getPriority = (key: string) => {
        if (STATUS_PRIORITY[key] !== undefined) return STATUS_PRIORITY[key];
        if (key.startsWith('未報告')) return 4;
        return 999;
      };
      return getPriority(a[0]) - getPriority(b[0]);
    });

  sortedStatuses.forEach(([key, count]) => {
    // 件数に関係なく全てのカテゴリを表示
    list.push({ key, label: key, count, ... });
  });

  return list;
}, [statusCounts, generalMediationIncompleteCount]);
```

**問題**: `count`が0のカテゴリもフィルタリングせずに表示している

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type StatusItem
  OUTPUT: boolean
  
  // カテゴリの件数が0件の場合にバグ条件を満たす
  RETURN X.count = 0
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 0件カテゴリの非表示
FOR ALL X WHERE isBugCondition(X) DO
  result ← renderSidebar'(X)
  ASSERT X NOT IN result.displayedCategories
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 1件以上のカテゴリは表示
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderSidebar(X) = renderSidebar'(X)
END FOR
```

## Implementation Design

### 修正箇所

**ファイル**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**修正内容**: `statusList`生成時に`count > 0`のカテゴリのみをフィルタリング



### 修正後のコード

```typescript
const statusList = useMemo(() => {
  const list = [{ key: 'all', label: 'すべて', count: statusCounts.all }];

  const sortedStatuses = Object.entries(statusCounts)
    .filter(([key]) => key !== 'all' && key !== '')
    .filter(([key, count]) => count > 0)  // ← 0件のカテゴリを除外
    .sort((a, b) => {
      const getPriority = (key: string) => {
        if (STATUS_PRIORITY[key] !== undefined) return STATUS_PRIORITY[key];
        if (key.startsWith('未報告')) return 4;
        return 999;
      };
      return getPriority(a[0]) - getPriority(b[0]);
    });

  sortedStatuses.forEach(([key, count]) => {
    const isSeninBg = key.endsWith('専任公開中') || key === '専任・公開中';
    const isHighBg = !isSeninBg && (HIGH_PRIORITY_BG_STATUSES.has(key) || key.startsWith('未報告'));
    const isBoldRed = key === '未完了' && generalMediationIncompleteCount > 0;
    const isRed = HIGH_PRIORITY_RED_STATUSES.has(key);
    list.push({ key, label: key, count, isHighPriorityBg: isHighBg, isSeninBg, isRed, isBoldRed });
  });

  return list;
}, [statusCounts, generalMediationIncompleteCount]);
```

## Correctness Properties

### Property 1: Fix Checking - 0件カテゴリの非表示

```
FOR ALL category IN statusCounts WHERE category.count = 0 DO
  displayedCategories ← renderSidebar'(statusCounts)
  ASSERT category.key NOT IN displayedCategories
END FOR
```

**検証方法**: 
- 「未完了」カテゴリが0件の場合、サイドバーに表示されないことを確認
- 他のカテゴリも0件の場合、サイドバーに表示されないことを確認

### Property 2: Preservation Checking - 1件以上のカテゴリは表示

```
FOR ALL category IN statusCounts WHERE category.count > 0 DO
  displayedCategories ← renderSidebar'(statusCounts)
  ASSERT category.key IN displayedCategories
END FOR
```

**検証方法**:
- 「未完了」カテゴリが1件以上の場合、サイドバーに表示されることを確認
- 他のカテゴリも1件以上の場合、サイドバーに表示されることを確認
- 件数バッジが正しく表示されることを確認

### Property 3: Preservation Checking - 「すべて」カテゴリは常に表示

```
displayedCategories ← renderSidebar'(statusCounts)
ASSERT 'all' IN displayedCategories
```

**検証方法**:
- 「すべて」カテゴリは件数に関係なく常に表示されることを確認
