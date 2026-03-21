# Design Document: visit-day-before-notification-exclusion

## Overview

売主リストのサイドバーカテゴリー「訪問日前日」において、`visitReminderAssignee`（DBカラム: `visit_reminder_assignee`）に値が入力されている売主を除外する機能。

### 背景

現在の「訪問日前日」カテゴリーは、営担（visitAssignee）に入力があり、かつ今日が訪問日の前営業日である売主を全て表示している。しかし、すでに訪問事前通知メールの担当者が割り当てられている売主（通知済みまたは通知予定が確定している）も表示されてしまい、未対応の売主を見つけにくい状態になっている。

### 目的

`visitReminderAssignee` に値がある売主を「訪問日前日」カテゴリーから除外することで、未対応の売主のみを表示し、通知作業の効率を向上させる。

---

## Architecture

変更は最小限の1箇所のみ。フロントエンドのフィルタリングロジックに除外条件を追加する。

```
sellerStatusFilters.ts
  └── isVisitDayBefore(seller)
        1. hasVisitAssignee チェック（既存）
        2. visitDate チェック（既存）
        3. [NEW] visitReminderAssignee チェック → 値があれば false を返す
        4. isVisitDayBeforeUtil チェック（既存）
```

バックエンド・DB・スプレッドシート同期への変更は不要。`visitReminderAssignee` フィールドはすでにフロントエンドの売主オブジェクトに含まれている前提。

---

## Components and Interfaces

### 変更対象

**ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**関数**: `isVisitDayBefore(seller: Seller | any): boolean`

#### 変更前

```typescript
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  
  const todayStr = getTodayJSTString();
  const todayParts = todayStr.split('-');
  const todayDate = new Date(
    parseInt(todayParts[0]),
    parseInt(todayParts[1]) - 1,
    parseInt(todayParts[2])
  );
  todayDate.setHours(0, 0, 0, 0);
  
  return isVisitDayBeforeUtil(String(visitDate), todayDate);
};
```

#### 変更後

```typescript
export const isVisitDayBefore = (seller: Seller | any): boolean => {
  if (!hasVisitAssignee(seller)) {
    return false;
  }
  
  const visitDate = seller.visitDate || seller.visit_date;
  if (!visitDate) {
    return false;
  }
  
  // visitReminderAssigneeに値がある場合は除外（通知担当が既に割り当て済み）
  const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
  if (visitReminderAssignee.trim() !== '') {
    return false;
  }
  
  const todayStr = getTodayJSTString();
  const todayParts = todayStr.split('-');
  const todayDate = new Date(
    parseInt(todayParts[0]),
    parseInt(todayParts[1]) - 1,
    parseInt(todayParts[2])
  );
  todayDate.setHours(0, 0, 0, 0);
  
  return isVisitDayBeforeUtil(String(visitDate), todayDate);
};
```

### 変更しないもの

- `sellerStatusUtils.ts` の `isVisitDayBefore` ユーティリティ関数（引数ベースの純粋関数）
- `SellerStatusSidebar.tsx`（`isVisitDayBefore` の呼び出し方は変わらない）
- バックエンドAPI・DB・スプレッドシート同期

---

## Data Models

### 売主オブジェクトの参照パターン

既存コードと同様に、camelCase / snake_case の両形式を参照する。

| フロントエンドキー | DBカラム名 | スプレッドシート列 |
|---|---|---|
| `visitReminderAssignee` | `visit_reminder_assignee` | BX列「通知送信者」 |

**参照コード**:
```typescript
const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
```

### 判定ロジックの評価順序

既存の判定順序を維持し、`visitReminderAssignee` チェックは `visitDate` チェックの後に追加する。

```
1. hasVisitAssignee チェック → false なら return false
2. visitDate チェック → 未設定なら return false
3. visitReminderAssignee チェック → 値があれば return false  ← [NEW]
4. isVisitDayBeforeUtil → 前営業日判定の結果を返す
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: visitReminderAssignee に値がある売主は除外される

*For any* 売主オブジェクトで、`visitReminderAssignee`（または `visit_reminder_assignee`）に空でない文字列が設定されており、かつ他の条件（visitAssignee あり、visitDate あり、前営業日）を満たしている場合、`isVisitDayBefore` は `false` を返す。

**Validates: Requirements 1.1, 1.4**

### Property 2: visitReminderAssignee が空の場合は既存ロジックが適用される

*For any* 売主オブジェクトで、`visitReminderAssignee` が `undefined`、`null`、または空文字列の場合、`isVisitDayBefore` の結果は既存の前営業日ロジック（`isVisitDayBeforeUtil`）の結果と一致する。

エッジケース:
- 木曜訪問の場合は2日前（火曜）に `true`（Requirements 2.1）
- 木曜以外の訪問日は1日前に `true`（Requirements 2.2）

**Validates: Requirements 1.2, 2.1, 2.2**

### Property 3: camelCase / snake_case の両形式で正しく動作する

*For any* 売主オブジェクトで、`visitReminderAssignee`（camelCase）または `visit_reminder_assignee`（snake_case）のいずれかの形式で非空文字列が設定されている場合、`isVisitDayBefore` は `false` を返す。フィールドが両方とも `undefined` の場合は空として扱い、除外しない。

エッジケース:
- フィールドが存在しない（`undefined`）場合は空として扱う（Requirements 3.2）

**Validates: Requirements 3.1, 3.2**

---

## Error Handling

### フィールドが存在しない場合

`visitReminderAssignee` / `visit_reminder_assignee` が売主オブジェクトに存在しない場合、`|| ''` によって空文字列にフォールバックし、既存ロジックを適用する。エラーは発生しない。

```typescript
const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
```

### null / undefined の場合

`|| ''` チェーンにより、`null` や `undefined` は空文字列として扱われる。

### 空白のみの文字列

`.trim() !== ''` チェックにより、スペースのみの文字列は空として扱い、除外しない。

---

## Testing Strategy

### デュアルテストアプローチ

ユニットテストとプロパティベーステストの両方を使用する。

#### ユニットテスト（具体例・エッジケース）

対象ファイル: `frontend/frontend/src/utils/sellerStatusFilters.test.ts`（新規作成）

**具体例テスト**:
- `visitReminderAssignee` に値がある売主 → `false`
- `visit_reminder_assignee` に値がある売主 → `false`
- `visitReminderAssignee` が空文字列の売主 → 既存ロジックに委ねる
- `visitReminderAssignee` が `undefined` の売主 → 既存ロジックに委ねる
- `hasVisitAssignee` が `false` の売主（visitReminderAssigneeに値があっても） → `false`（Requirements 1.3）
- `visitDate` が未設定の売主（visitReminderAssigneeに値があっても） → `false`（Requirements 2.4）

#### プロパティベーステスト

ライブラリ: `fast-check`（TypeScript/JavaScript向けPBTライブラリ）

最小100イテレーション/プロパティ。

**Property 1 テスト**:
```typescript
// Feature: visit-day-before-notification-exclusion, Property 1: visitReminderAssignee に値がある売主は除外される
fc.assert(fc.property(
  fc.record({
    visitReminderAssignee: fc.string({ minLength: 1 }),
    visitAssigneeInitials: fc.string({ minLength: 1 }),
    visit_date: fc.constant('2026-01-29'), // 木曜
    // ...
  }),
  (seller) => {
    return isVisitDayBefore(seller) === false;
  }
), { numRuns: 100 });
```

**Property 2 テスト**:
```typescript
// Feature: visit-day-before-notification-exclusion, Property 2: visitReminderAssignee が空の場合は既存ロジックが適用される
fc.assert(fc.property(
  fc.record({
    visitReminderAssignee: fc.constant(''),
    // visitAssignee, visitDate, today を生成
  }),
  (seller) => {
    const result = isVisitDayBefore(seller);
    const expected = isVisitDayBeforeUtil(seller.visit_date, today);
    return result === expected;
  }
), { numRuns: 100 });
```

**Property 3 テスト**:
```typescript
// Feature: visit-day-before-notification-exclusion, Property 3: camelCase / snake_case の両形式で正しく動作する
fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  fc.boolean(),
  (value, useCamelCase) => {
    const seller = useCamelCase
      ? { visitReminderAssignee: value, /* ... */ }
      : { visit_reminder_assignee: value, /* ... */ };
    return isVisitDayBefore(seller) === false;
  }
), { numRuns: 100 });
```
