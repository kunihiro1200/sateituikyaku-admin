# SMS送信者名表示バグ 設計ドキュメント

## Overview

買主詳細画面（`BuyerDetailPage.tsx`）の「メール・SMS送信履歴」セクションにおいて、SMS送信履歴の「送信者」欄に送信者の名前（例：「国広」）ではなく、電話番号（例：`09066394800`）が表示されているバグを修正する。

コード調査の結果、問題は2層に分かれていることが判明した：

1. **フロントエンドの型定義の不一致**: `BuyerDetailPage.tsx` の `Activity` インターフェースの `employee` フィールドの型が、`ActivityLogService.getLogs()` が返すデータ構造と一致していない
2. **表示ロジックの問題**: SMS送信者の `displayName` が `'不明'` になった場合、フォールバックとして `metadata.phoneNumber`（送信先電話番号）が表示されている

バックエンドの `ActivityLogService.getLogs()` は `employee:employees(id, name, initials)` でJOINしており、`employee` オブジェクトは正しくレスポンスに含まれている。しかしフロントエンドの `Activity` インターフェースの `employee.id` が `number` 型で定義されているのに対し、実際のDBの `employees.id` は UUID（`string`）型であるため、型の不一致が生じている可能性がある。

また、`sms-history` エンドポイントは `(req as any).user?.id` でログインユーザーのIDを取得しているが、認証ミドルウェアが適用されていない場合、`SYSTEM_EMPLOYEE_ID`（会社アカウント）にフォールバックする。この場合でも `employee` JOINは機能するはずだが、表示ロジックで `displayName` が `'不明'` になっている。

## Glossary

- **Bug_Condition (C)**: SMS送信履歴の送信者欄に名前ではなく電話番号が表示される条件
- **Property (P)**: SMS送信履歴の送信者欄に従業員名（例：「国広」）が表示されるべき正しい動作
- **Preservation**: メール送信履歴・通話履歴の表示、その他の買主詳細画面の機能が変更後も正常に動作すること
- **Activity**: `activity_logs` テーブルのレコードをフロントエンドで扱う型
- **employee**: `activity_logs.employee_id` から JOINされた `employees` テーブルのレコード
- **getDisplayName**: `frontend/frontend/src/utils/employeeUtils.ts` の関数。`{ name?, email? }` オブジェクトから表示名を返す
- **SYSTEM_EMPLOYEE_ID**: SMS送信者が未ログインの場合のフォールバックID（`66e35f74-7c31-430d-b235-5ad515581007`）

## Bug Details

### Bug Condition

SMS送信履歴が表示される際、`activity.employee` が `undefined` または `null` になるため、`getDisplayName(activity.employee)` が `'不明'` を返す。その結果、表示ロジックが `displayName` として `'不明'` を使用し、送信者欄に `送信者: 不明 / 送信先: 09066394800` のように電話番号が目立つ形で表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(activity)
  INPUT: activity of type Activity (from /api/activity-logs)
  OUTPUT: boolean

  RETURN activity.action = 'sms'
    AND (
      activity.employee IS undefined
      OR activity.employee IS null
      OR getDisplayName(activity.employee) = '不明'
    )
END FUNCTION
```

### Examples

- **バグあり**: SMS送信履歴の送信者欄に `送信者: 不明 / 送信先: 09066394800` と表示される
  - 期待値: `送信者: 国広 / 送信先: 09066394800`
- **バグあり**: `activity.employee` が `undefined` のため `getDisplayName(undefined)` が `'担当者'` を返す
  - 期待値: `getDisplayName({ id: '...uuid...', name: '国広智子', initials: 'K' })` が `'国広'` を返す
- **正常**: メール送信履歴の送信者欄は `送信者: 国広 (sender@example.com)` と正しく表示される（同じ `getDisplayName` を使用）
- **エッジケース**: `employee_id` が `SYSTEM_EMPLOYEE_ID`（会社アカウント）の場合、会社アカウントの名前が表示される

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- メール送信履歴の送信者欄の表示（`送信者: 名前 (email)` 形式）は変更しない
- 通話履歴の担当者名表示は変更しない
- `getDisplayName` 関数の動作は変更しない
- `ActivityLogService.getLogs()` のバックエンドロジックは変更しない
- SMS送信機能（`SmsDropdownButton`）の動作は変更しない

**Scope:**
`activity.action === 'sms'` の場合の送信者表示ロジックのみを修正する。それ以外の全ての表示・機能は影響を受けない。

## Hypothesized Root Cause

コード調査の結果、以下の根本原因が特定された：

1. **フロントエンドの `Activity` 型定義の不一致**:
   - `BuyerDetailPage.tsx` の `Activity` インターフェース（line 89-98）では `employee?.id` が `number` 型
   - バックエンドの `employees` テーブルの `id` は UUID（`string`）型
   - この型の不一致により、TypeScriptの型チェックは通るが、実行時に `employee` オブジェクトが正しく扱われない可能性がある

2. **`/api/activity-logs` エンドポイントの認証ミドルウェア**:
   - `activityLogs.ts` ルートには `router.use(authenticate)` が適用されている
   - しかし `sms-history` エンドポイント（`buyers.ts`）は認証ミドルウェアが適用されているか不明
   - 認証が通らない場合、`(req as any).user?.id` が `undefined` となり `SYSTEM_EMPLOYEE_ID` にフォールバック
   - この場合でも `employee` JOINは機能するはずだが、確認が必要

3. **`ActivityLogService.getLogs()` のJOINクエリ**:
   - `select('*, employee:employees(id, name, initials)')` でJOINしている
   - `employee_id` が `null` の場合、`employee` は `null` になる
   - フロントエンドの表示ロジックは `activity.employee ? getDisplayName(activity.employee) : '不明'` で処理しているが、`employee` が `null` の場合 `'不明'` になる

4. **最も可能性の高い原因**: `Activity` インターフェースの `employee.id` が `number` 型で定義されているため、バックエンドから返される UUID 文字列の `id` を持つ `employee` オブジェクトが TypeScript の型チェックで問題を起こしている、または `employee` フィールドがレスポンスに含まれているにもかかわらず、型の不一致により `undefined` として扱われている。

## Correctness Properties

Property 1: Bug Condition - SMS送信者名の正しい表示

_For any_ activity where `isBugCondition(activity)` returns true（`action === 'sms'` かつ `employee` が存在する）、修正後の `BuyerDetailPage` は送信者欄に `metadata.phoneNumber` ではなく従業員名（例：「国広」）を表示する SHALL。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非SMS履歴の表示の保持

_For any_ activity where `isBugCondition(activity)` returns false（`action !== 'sms'`、またはメール送信履歴・通話履歴）、修正後のコードは修正前と同じ表示結果を返す SHALL。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の修正を行う：

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**修正1: `Activity` インターフェースの `employee.id` 型を修正**

```typescript
// 修正前
interface Activity {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  created_at: string;
  employee?: {
    id: number;      // ← 間違い: DBのemployees.idはUUID（string）
    name: string;
    initials: string;
  };
}

// 修正後
interface Activity {
  id: number;
  action: string;
  target_type: string;
  target_id: number;
  metadata: any;
  created_at: string;
  employee?: {
    id: string;      // ← 修正: UUIDはstring型
    name: string;
    initials: string;
  };
}
```

**修正2: SMS送信者の表示ロジックを改善**

SMS送信者の `displayName` が `'不明'` になった場合のフォールバック表示を改善する。現在の表示は `送信者: 不明 / 送信先: 09066394800` だが、`employee` が存在しない場合は `送信者: （記録なし）` のように表示する。

```typescript
// 修正前（line ~1210付近）
const displayName = activity.employee ? getDisplayName(activity.employee) : '不明';

// 修正後
const displayName = activity.employee
  ? (activity.employee.name
      ? activity.employee.name.split(/[\s　]/)[0]  // 通話履歴と同じロジック
      : (activity.employee.initials || '担当者'))
  : '担当者';
```

**注意**: `getDisplayName` は `{ name?, email? }` を受け取るが、`Activity.employee` は `{ id, name, initials }` を持つ。`email` フィールドがないため、`getDisplayName` のフォールバックロジック（メールアドレスから名前抽出）は機能しない。通話履歴と同じ `emp.name.split(/[\s　]/)[0]` ロジックを使用する方が適切。

**File**: `backend/src/routes/buyers.ts`（確認のみ、修正不要の可能性あり）

`sms-history` エンドポイントが認証ミドルウェアを通じてログインユーザーの `employee_id` を正しく記録しているか確認する。現在の実装では `(req as any).user?.id || SYSTEM_EMPLOYEE_ID` を使用しており、認証が通っていれば正しいIDが記録される。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず修正前のコードでバグを再現するテストを実行し、次に修正後のコードで正しい動作を確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `BuyerDetailPage` のSMS送信履歴表示ロジックをユニットテストで検証する。`activity.employee` が存在する場合と存在しない場合の両方をテストする。

**Test Cases**:
1. **employee存在・正常ケース**: `activity.employee = { id: 'uuid', name: '国広智子', initials: 'K' }` の場合、`displayName` が `'国広'` になることを確認（修正前は失敗する可能性あり）
2. **employee未定義ケース**: `activity.employee = undefined` の場合、`displayName` が `'担当者'` になることを確認
3. **employee null ケース**: `activity.employee = null` の場合、`displayName` が `'担当者'` になることを確認
4. **SYSTEM_EMPLOYEE_IDケース**: `employee_id` が `SYSTEM_EMPLOYEE_ID` の場合、会社アカウント名が表示されることを確認

**Expected Counterexamples**:
- `activity.employee` が存在するにもかかわらず `displayName` が `'不明'` になる
- 送信者欄に電話番号が表示される

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL activity WHERE isBugCondition(activity) DO
  result := renderSmsHistoryRow(activity)
  ASSERT result.senderDisplay = employeeName (例: "国広")
    AND result.senderDisplay ≠ phoneNumber
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない入力に対して動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL activity WHERE NOT isBugCondition(activity) DO
  ASSERT renderHistoryRow_original(activity) = renderHistoryRow_fixed(activity)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。様々な `activity` オブジェクトを生成し、メール送信履歴・通話履歴の表示が変わらないことを確認する。

**Test Cases**:
1. **メール送信履歴の保持**: `action === 'email'` の場合、送信者欄の表示が変わらないことを確認
2. **通話履歴の保持**: `action === 'call'` の場合、担当者名の表示が変わらないことを確認
3. **employee未定義の保持**: `employee === undefined` の場合、`'担当者'` が表示されることを確認

### Unit Tests

- `Activity` インターフェースの `employee.id` が `string` 型であることを確認
- `displayName` の計算ロジックが `employee.name` から正しく名字を抽出することを確認
- `employee` が `null`/`undefined` の場合に `'担当者'` が返されることを確認

### Property-Based Tests

- ランダムな `employee` オブジェクトを生成し、`displayName` が常に電話番号形式でないことを確認
- ランダムな `activity` オブジェクトを生成し、`action !== 'sms'` の場合の表示が変わらないことを確認

### Integration Tests

- 実際の `activity_logs` APIレスポンスを使用して、SMS送信履歴の送信者欄に名前が表示されることを確認
- メール送信履歴・通話履歴の表示が変わらないことを確認
