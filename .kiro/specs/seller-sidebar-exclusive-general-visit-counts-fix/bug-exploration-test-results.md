# バグ条件探索テスト結果

## テスト実行日時
- **修正前**: 2026年4月2日
- **修正後**: 2026年4月2日

## テスト目的
- **修正前**: バグの存在を証明
- **修正後**: バグが修正されたことを確認する

## テスト結果

### 失敗したテストケース（バグの証明）

#### 1. 専任カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出）

**期待される動作（修正後）**: `isExclusive(seller)` = `true`（次電日が昨日の売主は含まれる）

**実際の動作（修正前）**: `isExclusive(seller)` = `false`（次電日が昨日の売主が除外される）

**根本原因**: フロントエンドが`isTodayOrBefore(nextCallDate)`を使用しているため、次電日が今日以前（今日も昨日も）を除外している。しかし、GASとバックエンドは「次電日が今日ではない」という条件なので、昨日は含まれるべき。

---

#### 2. 一般カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出）

**期待される動作（修正後）**: `isGeneral(seller)` = `true`（次電日が昨日の売主は含まれる）

**実際の動作（修正前）**: `isGeneral(seller)` = `false`（次電日が昨日の売主が除外される）

**根本原因**: 専任カテゴリと同じ理由。

---

#### 3. 訪問後他決カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出）

**期待される動作（修正後）**: `isVisitOtherDecision(seller)` = `true`（次電日が昨日の売主は含まれる）

**実際の動作（修正前）**: `isVisitOtherDecision(seller)` = `false`（次電日が昨日の売主が除外される）

**根本原因**: 専任カテゴリと同じ理由。

---

## カウンターサンプル

### 専任カテゴリ

```typescript
{
  exclusiveOtherDecisionMeeting: '',
  exclusive_other_decision_meeting: '',
  nextCallDate: '2026-04-01', // 昨日
  next_call_date: '2026-04-01',
  status: '専任媒介',
}
```

**期待**: `isExclusive()` = `true`
**実際**: `isExclusive()` = `false`

---

### 一般カテゴリ

```typescript
{
  exclusiveOtherDecisionMeeting: '',
  exclusive_other_decision_meeting: '',
  nextCallDate: '2026-04-01', // 昨日
  next_call_date: '2026-04-01',
  status: '一般媒介',
  contractYearMonth: '2025-07-01',
  contract_year_month: '2025-07-01',
}
```

**期待**: `isGeneral()` = `true`
**実際**: `isGeneral()` = `false`

---

### 訪問後他決カテゴリ

```typescript
{
  exclusiveOtherDecisionMeeting: '',
  exclusive_other_decision_meeting: '',
  nextCallDate: '2026-04-01', // 昨日
  next_call_date: '2026-04-01',
  status: '他決→追客',
  visitAssigneeInitials: 'Y',
  visit_assignee: 'Y',
  visitAssignee: 'Y',
}
```

**期待**: `isVisitOtherDecision()` = `true`
**実際**: `isVisitOtherDecision()` = `false`

---

## 根本原因の詳細

### GASとバックエンドの条件

- **GAS**: `nextCallDate !== todayStr`（次電日が今日**ではない**）
- **バックエンド**: `.gt('next_call_date', todayJST)`（次電日が今日**より大きい** = 今日を除外）

これらは「次電日が今日の場合のみ除外」という意味で、**昨日は含まれる**。

### フロントエンドの条件（修正前）

```typescript
if (isTodayOrBefore(nextCallDate)) {
  return false;
}
```

これは「次電日が今日以前の場合を除外」という意味で、**今日も昨日も除外される**。

### 不一致の原因

フロントエンドは「次電日が今日以前を除外」しているが、GASとバックエンドは「次電日が今日のみ除外」している。

この不一致により、次電日が昨日の売主が：
- **GASとバックエンド**: カウントに含まれる
- **フロントエンド**: フィルタリング結果から除外される

結果として、サイドバーのカウント数とフィルタリング結果の件数が一致しない。

---

## 修正方針

フロントエンドの条件を「次電日が今日の場合のみ除外」に変更する：

```typescript
// 修正前
if (isTodayOrBefore(nextCallDate)) {
  return false;
}

// 修正後
const todayStr = getTodayJSTString();
const normalizedNextCallDate = normalizeDateString(nextCallDate);
if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) {
  return false;
}
```

---

## テスト実行コマンド

```bash
npm test -- sidebar-exclusive-general-visit-counts-bug.test.ts
```

---

## テスト結果サマリー

### 修正前（タスク1）

- **合計テスト数**: 10
- **成功**: 7
- **失敗**: 3（バグの存在を証明）

失敗したテストは、修正前のコードでバグが存在することを証明しています。

### 修正後（タスク3.2）

- **合計テスト数**: 10
- **成功**: 10 ✅
- **失敗**: 0

**結果**: 全てのテストが成功し、バグが修正されたことが確認されました。

---

## 修正後のテスト実行ログ

```
PASS  src/tests/sidebar-exclusive-general-visit-counts-bug.test.ts
  Property 1: Bug Condition - 専任・一般・訪問後他決カテゴリのカウント数不一致
    ✓ 専任カテゴリ: 次電日が今日の売主は除外されるべき (9 ms)
    ✓ 専任カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出） (2 ms)
    ✓ 専任カテゴリ: 次電日が明日の売主は含まれるべき (2 ms)
    ✓ 一般カテゴリ: 次電日が今日の売主は除外されるべき (2 ms)
    ✓ 一般カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出） (2 ms)
    ✓ 一般カテゴリ: 次電日が明日の売主は含まれるべき (1 ms)
    ✓ 訪問後他決カテゴリ: 次電日が今日の売主は除外されるべき (1 ms)
    ✓ 訪問後他決カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出） (1 ms)
    ✓ 訪問後他決カテゴリ: 次電日が明日の売主は含まれるべき (2 ms)
    ✓ カウント数とフィルタリング結果が一致すべき (5 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        2.73 s
```
