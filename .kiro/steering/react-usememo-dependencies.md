# React useMemoの依存配列ルール（絶対に守るべきルール）

## ⚠️ 重要：useMemoの依存配列には参照元のデータを必ず含める

**このルールを守らないと、古いデータが表示され続けるバグが発生します。**

---

## 🚨 過去の問題：物件リストサイドバーの「未完了」カウント不整合

**日付**: 2026年4月1日

**症状**:
- `statusCounts` useMemoでは `未完了: 0` と正しく計算される
- しかし `statusList` useMemoでは `未完了カウント: 1` と古い値が表示される
- サイドバーUIに「未完了：1」が表示され続ける

**根本原因**:
```typescript
// ❌ 間違い（listingsが依存配列に含まれていない）
const statusCounts = useMemo(() => {
  const counts: Record<string, number> = { all: listings.length };
  counts['未完了'] = listings.filter(l => l.confirmation === '未').length;
  return counts;
}, [listings, pendingPriceReductionProperties, workTaskMap]); // ✅ listingsが含まれている

const statusList = useMemo(() => {
  const list = [{ key: 'all', label: 'すべて', count: statusCounts.all }];
  
  Object.entries(statusCounts)
    .filter(([key, count]) => count > 0)
    .forEach(([key, count]) => {
      list.push({ key, label: key, count });
    });
  
  return list;
}, [statusCounts, generalMediationIncompleteCount]); // ❌ listingsが含まれていない
```

**問題**:
- `statusCounts` が再計算されても、`statusList` が再計算されない
- `statusList` は古い `statusCounts` を参照し続ける
- 結果として、UIに古いカウントが表示される

**修正**:
```typescript
// ✅ 正しい（listingsを依存配列に追加）
const statusList = useMemo(() => {
  const list = [{ key: 'all', label: 'すべて', count: statusCounts.all }];
  
  Object.entries(statusCounts)
    .filter(([key, count]) => count > 0)
    .forEach(([key, count]) => {
      list.push({ key, label: key, count });
    });
  
  return list;
}, [statusCounts, generalMediationIncompleteCount, listings]); // ✅ listingsを追加
```

---

## ✅ useMemoの依存配列ルール

### ルール1: 参照元のデータを必ず含める

**useMemo内で参照している全てのprops、state、変数を依存配列に含める**

```typescript
// ✅ 正しい
const filteredData = useMemo(() => {
  return data.filter(item => item.status === selectedStatus);
}, [data, selectedStatus]); // dataとselectedStatusの両方を含める
```

```typescript
// ❌ 間違い
const filteredData = useMemo(() => {
  return data.filter(item => item.status === selectedStatus);
}, [selectedStatus]); // dataが含まれていない → dataが変更されても再計算されない
```

### ルール2: 計算結果が別のuseMemoに依存する場合、元のデータも含める

**useMemo Aの結果をuseMemo Bで使用する場合、useMemo Bの依存配列には以下の両方を含める**:
1. useMemo Aの結果
2. useMemo Aが依存している元のデータ

```typescript
// ✅ 正しい
const counts = useMemo(() => {
  return { total: data.length, active: data.filter(d => d.active).length };
}, [data]);

const summary = useMemo(() => {
  return `合計: ${counts.total}件、アクティブ: ${counts.active}件`;
}, [counts, data]); // countsとdataの両方を含める
```

```typescript
// ❌ 間違い
const counts = useMemo(() => {
  return { total: data.length, active: data.filter(d => d.active).length };
}, [data]);

const summary = useMemo(() => {
  return `合計: ${counts.total}件、アクティブ: ${counts.active}件`;
}, [counts]); // dataが含まれていない → dataが変更されてもsummaryが再計算されない場合がある
```

### ルール3: オブジェクトや配列を依存配列に含める場合の注意

**オブジェクトや配列は参照が変わらないと再計算されない**

```typescript
// ❌ 間違い（オブジェクトの参照が変わらない）
const [filters, setFilters] = useState({ status: 'active', type: 'all' });

const filteredData = useMemo(() => {
  return data.filter(item => 
    item.status === filters.status && item.type === filters.type
  );
}, [data, filters]); // filtersの参照が変わらないと再計算されない

// ✅ 正しい（個別のプロパティを依存配列に含める）
const filteredData = useMemo(() => {
  return data.filter(item => 
    item.status === filters.status && item.type === filters.type
  );
}, [data, filters.status, filters.type]); // 個別のプロパティを含める
```

---

## 📋 チェックリスト

useMemoを使用する前に、以下を確認してください：

- [ ] useMemo内で参照している全てのprops、state、変数を依存配列に含めたか？
- [ ] 別のuseMemoの結果を使用している場合、元のデータも依存配列に含めたか？
- [ ] オブジェクトや配列を依存配列に含める場合、個別のプロパティを含めたか？
- [ ] ESLintの `react-hooks/exhaustive-deps` 警告を無視していないか？

---

## 🔍 デバッグ方法

useMemoが正しく再計算されているか確認する方法：

### 方法1: コンソールログを追加

```typescript
const result = useMemo(() => {
  console.log('[useMemo] 再計算:', { data, filter });
  return data.filter(item => item.status === filter);
}, [data, filter]);
```

### 方法2: useEffectで監視

```typescript
useEffect(() => {
  console.log('[useEffect] resultが変更されました:', result);
}, [result]);
```

### 方法3: React DevToolsで確認

1. React DevToolsを開く
2. Profilerタブを選択
3. コンポーネントの再レンダリングを記録
4. useMemoが再計算されているか確認

---

## 💡 ベストプラクティス

### 1. ESLintの警告を無視しない

```typescript
// ❌ 間違い（警告を無視）
const result = useMemo(() => {
  return data.filter(item => item.status === filter);
}, [data]); // eslint-disable-line react-hooks/exhaustive-deps
```

```typescript
// ✅ 正しい（警告に従う）
const result = useMemo(() => {
  return data.filter(item => item.status === filter);
}, [data, filter]);
```

### 2. 依存配列が多すぎる場合は、useMemoを分割する

```typescript
// ❌ 間違い（依存配列が多すぎる）
const result = useMemo(() => {
  const filtered = data.filter(item => item.status === filter);
  const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);
  return paginated;
}, [data, filter, page, pageSize]);
```

```typescript
// ✅ 正しい（useMemoを分割）
const filtered = useMemo(() => {
  return data.filter(item => item.status === filter);
}, [data, filter]);

const sorted = useMemo(() => {
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}, [filtered]);

const paginated = useMemo(() => {
  return sorted.slice(page * pageSize, (page + 1) * pageSize);
}, [sorted, page, pageSize]);
```

### 3. 不要なuseMemoは使わない

```typescript
// ❌ 不要（単純な計算）
const total = useMemo(() => {
  return a + b;
}, [a, b]);
```

```typescript
// ✅ 正しい（useMemoなしで十分）
const total = a + b;
```

---

## 🎯 まとめ

**useMemoの依存配列には、useMemo内で参照している全てのデータを含める**

**このルールを守ることで、古いデータが表示され続けるバグを完全に防止できます。**

---

**最終更新日**: 2026年4月1日  
**作成理由**: 物件リストサイドバーの「未完了」カウント不整合問題の再発防止  
**関連ファイル**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

