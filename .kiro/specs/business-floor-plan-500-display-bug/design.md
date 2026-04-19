# 業務リスト 間取図500円表示バグ 設計ドキュメント

## Overview

業務リストの【★図面確認】セクションで、`cw_request_email_2f_above`（CWの方へ依頼メール 2階以上）に値がある案件において、間取図の単価が500円であるにもかかわらず「間取図300円（CW）計⇒ {値}」と表示されてしまうバグを修正する。

**バグの構造（2つの問題）:**

1. **フロントエンド** (`WorkTaskDetailModal.tsx`): `useCwCounts()` フックが「間取図（500円）」を取得せず、表示ロジックも `cw_request_email_2f_above` を参照していない
2. **GAS** (`GyomuWorkTaskSync.gs`): `syncCwCounts()` の同期対象に「間取図（500円）」が含まれていないため、`cw_counts` テーブルに500円のデータが存在しない

**修正方針:**
- GASの同期対象に「間取図（500円）」を追加
- フロントエンドの型・クエリ・表示ロジックを `cw_request_email_2f_above` の有無で切り替えるよう修正

## Glossary

- **Bug_Condition (C)**: `cw_request_email_2f_above` に値がある案件で【★図面確認】セクションを表示したとき、「間取図300円（CW）計」と表示される状態
- **Property (P)**: `cw_request_email_2f_above` に値がある場合は「間取図500円（CW）計⇒ {値}」、空の場合は「間取図300円（CW）計⇒ {値}」を表示する
- **Preservation**: `cw_request_email_2f_above` が空の案件の表示・サイト登録の表示・その他セクションは変更しない
- **useCwCounts**: `WorkTaskDetailModal.tsx` 内のカスタムフック。`cw_counts` テーブルから間取図・サイト登録の現在計を取得する
- **CwCountData**: `useCwCounts` が返す型。`floorPlan300`・`siteRegistration` を持つ（修正後は `floorPlan500` を追加）
- **syncCwCounts**: `GyomuWorkTaskSync.gs` 内の関数。CWカウントシートから指定項目の現在計を Supabase `cw_counts` テーブルに同期する
- **cw_counts**: Supabase テーブル。`item_name` と `current_total` カラムを持つ
- **cw_request_email_2f_above**: `work_tasks` テーブルのカラム。CWへの依頼が2階以上（500円）の場合に値が入る

## Bug Details

### Bug Condition

`cw_request_email_2f_above` に値がある案件の【★図面確認】セクションを表示したとき、以下の2つの問題が重なってバグが発生する：

1. `cw_counts` テーブルに「間取図（500円）」のレコードが存在しない（GASが同期していない）
2. フロントエンドが `cw_request_email_2f_above` を参照せず、常に `floorPlan300` を表示する

**Formal Specification:**
```
FUNCTION isBugCondition(task, cwCounts)
  INPUT: task = work_tasksレコード, cwCounts = CwCountData
  OUTPUT: boolean

  RETURN task.cw_request_email_2f_above IS NOT NULL
         AND task.cw_request_email_2f_above != ''
         AND displayedLabel = '間取図300円（CW)計'  // 500円と表示すべきところ300円と表示
END FUNCTION
```

### Examples

- **バグあり（AA13328等）**: `cw_request_email_2f_above` に値あり → 「間取図300円（CW)計⇒ 3」と表示（500円と表示すべき）
- **期待値**: `cw_request_email_2f_above` に値あり → 「間取図500円（CW)計⇒ {値}」と表示
- **正常ケース（変更なし）**: `cw_request_email_2f_above` が空 → 「間取図300円（CW)計⇒ {値}」と表示（現状維持）
- **エッジケース**: `cw_request_email_2f_above` に値あり、かつ `floorPlan500` が null → 「-」を表示

## Expected Behavior

### Preservation Requirements

**変更しない箇所:**
- `cw_request_email_2f_above` が空（null または空文字）の案件の表示（「間取図300円（CW)計⇒ {値}」）
- `cwCounts.floorPlan300` が null の場合の「-」表示
- 【サイト登録確認】セクションの `cwCounts.siteRegistration` 表示
- `syncCwCounts` の「サイト登録」同期処理
- `getCwCountValue` 関数のロジック（変更不要）
- 業務リストの他のセクション・フィールドの表示

**Scope:**
`cw_request_email_2f_above` が空の案件、およびサイト登録・その他セクションは今回の修正で一切影響を受けない。

## Hypothesized Root Cause

### 問題1: フロントエンド（`WorkTaskDetailModal.tsx`）

**原因A**: `CwCountData` 型に `floorPlan500` が存在しない
```typescript
// 現在の型（バグあり）
interface CwCountData {
  floorPlan300: string | null;
  siteRegistration: string | null;
}
```

**原因B**: `useCwCounts()` のクエリが「間取図（500円）」を取得していない
```typescript
// 現在のクエリ（バグあり）
.in('item_name', ['間取図（300円）', 'サイト登録'])
```

**原因C**: 表示ロジックが `cw_request_email_2f_above` を参照せず、常に300円として表示
```tsx
// 現在の表示（バグあり）
value={cwCounts.floorPlan300 ? `間取図300円（CW)計⇒ ${cwCounts.floorPlan300}` : '-'}
```

### 問題2: GAS（`GyomuWorkTaskSync.gs`）

**原因**: `syncCwCounts()` の同期対象配列に「間取図（500円）」が含まれていない
```javascript
// 現在の同期対象（バグあり）
var targets = ['間取図（300円）', 'サイト登録'];
```

その結果、CWカウントシートに「間取図（500円）」列が存在しても `cw_counts` テーブルに同期されず、フロントエンドが取得できない。

## Correctness Properties

Property 1: Bug Condition - 500円案件の正しい表示

_For any_ `cw_request_email_2f_above` に値がある案件において、【★図面確認】セクションは
SHALL 「間取図500円（CW)計⇒ {cwCounts.floorPlan500の値}」を表示する。
`floorPlan500` が null の場合は「-」を表示する。

**Validates: Requirements 2.1, 2.3, 2.4**

Property 2: Preservation - 300円案件・その他の表示維持

_For any_ `cw_request_email_2f_above` が空（null または空文字）の案件において、
【★図面確認】セクションは SHALL 従来通り「間取図300円（CW)計⇒ {cwCounts.floorPlan300の値}」を表示し、
サイト登録・その他セクションも変更前と同一の動作を維持する。

**Validates: Requirements 2.2, 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

#### File 1: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

**変更1: `CwCountData` 型に `floorPlan500` を追加**
```typescript
// 修正前
interface CwCountData {
  floorPlan300: string | null;
  siteRegistration: string | null;
}

// 修正後
interface CwCountData {
  floorPlan300: string | null;
  floorPlan500: string | null;
  siteRegistration: string | null;
}
```

**変更2: `useCwCounts()` の初期値とクエリを更新**
```typescript
// 修正前
const [data, setData] = useState<CwCountData>({ floorPlan300: null, siteRegistration: null });
// ...
.in('item_name', ['間取図（300円）', 'サイト登録']);
// ...
const result: CwCountData = { floorPlan300: null, siteRegistration: null };

// 修正後
const [data, setData] = useState<CwCountData>({ floorPlan300: null, floorPlan500: null, siteRegistration: null });
// ...
.in('item_name', ['間取図（300円）', '間取図（500円）', 'サイト登録']);
// ...
const result: CwCountData = { floorPlan300: null, floorPlan500: null, siteRegistration: null };
// rowsのforEachに追加:
if (row.item_name === '間取図（500円）') result.floorPlan500 = row.current_total;
```

**変更3: 【★図面確認】セクションの表示ロジックを修正**

`cw_request_email_2f_above` の値を参照して500円/300円を切り替える：
```tsx
// 修正前
value={cwCounts.floorPlan300 ? `間取図300円（CW)計⇒ ${cwCounts.floorPlan300}` : '-'}

// 修正後
value={
  getValue('cw_request_email_2f_above')
    ? (cwCounts.floorPlan500 ? `間取図500円（CW)計⇒ ${cwCounts.floorPlan500}` : '-')
    : (cwCounts.floorPlan300 ? `間取図300円（CW)計⇒ ${cwCounts.floorPlan300}` : '-')
}
```

#### File 2: `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs`

**変更: `syncCwCounts()` の `targets` 配列に「間取図（500円）」を追加**
```javascript
// 修正前
var targets = ['間取図（300円）', 'サイト登録'];

// 修正後
var targets = ['間取図（300円）', '間取図（500円）', 'サイト登録'];
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：
1. **探索フェーズ**: 修正前のコードでバグを確認（AA13328等の案件で500円案件が300円表示になることを確認）
2. **修正確認フェーズ**: GAS修正後に手動実行し、フロントエンド修正後に正しく表示されることを確認

### Exploratory Bug Condition Checking

**Goal**: 修正前に `cw_request_email_2f_above` に値がある案件で「間取図300円（CW）計」と表示されることを確認し、バグを実証する。

**Test Plan**: AA13328等の案件を業務リストで開き、【★図面確認】セクションの表示を確認する。また `cw_counts` テーブルに「間取図（500円）」レコードが存在しないことを確認する。

**Test Cases:**
1. **500円案件の表示確認**: AA13328等の `cw_request_email_2f_above` に値がある案件を開き、「間取図300円（CW）計」と誤表示されることを確認（バグの証拠）
2. **cw_countsテーブル確認**: Supabase で `item_name = '間取図（500円）'` のレコードが存在しないことを確認
3. **GASコード確認**: `syncCwCounts()` の `targets` 配列に「間取図（500円）」が含まれていないことを確認

**Expected Counterexamples:**
- `cw_request_email_2f_above` に値があるにもかかわらず「間取図300円（CW)計」と表示される
- `cw_counts` テーブルに「間取図（500円）」レコードが存在しない

### Fix Checking

**Goal**: 修正後に `cw_request_email_2f_above` に値がある案件で「間取図500円（CW）計⇒ {値}」が表示されることを確認する。

**Pseudocode:**
```
FOR ALL task WHERE isBugCondition(task) DO
  result := displayFloorPlanLabel_fixed(task, cwCounts)
  ASSERT result = '間取図500円（CW)計⇒ ' + cwCounts.floorPlan500
         OR (cwCounts.floorPlan500 IS NULL AND result = '-')
END FOR
```

**手順:**
1. GASコードを修正し、GASエディタで `syncCwCounts` を手動実行
2. Supabase の `cw_counts` テーブルに「間取図（500円）」レコードが追加されたことを確認
3. フロントエンドコードを修正してデプロイ
4. AA13328等の案件を開き「間取図500円（CW)計⇒ {値}」が表示されることを確認

### Preservation Checking

**Goal**: 修正後も `cw_request_email_2f_above` が空の案件・サイト登録表示が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL task WHERE NOT isBugCondition(task) DO
  ASSERT displayFloorPlanLabel_original(task) = displayFloorPlanLabel_fixed(task)
END FOR
```

**Test Cases:**
1. **300円案件の表示維持**: `cw_request_email_2f_above` が空の案件で「間取図300円（CW)計⇒ {値}」が変わらず表示されることを確認
2. **サイト登録表示の維持**: 【サイト登録確認】セクションの「サイト登録（CW）計⇒ {値}」が変わらず表示されることを確認
3. **null時の「-」表示維持**: `floorPlan300` が null の案件で「-」が表示されることを確認

### Unit Tests

- `cw_request_email_2f_above` に値がある場合、`floorPlan500` の値を使って「間取図500円（CW)計⇒ {値}」を表示する
- `cw_request_email_2f_above` が空の場合、`floorPlan300` の値を使って「間取図300円（CW)計⇒ {値}」を表示する
- `cw_request_email_2f_above` に値があり `floorPlan500` が null の場合、「-」を表示する
- `syncCwCounts` が「間取図（500円）」を含む3項目を同期対象とすることを確認

### Property-Based Tests

- 任意の `cw_request_email_2f_above` の値（null/空文字/任意の文字列）に対して、表示ラベルが正しく切り替わる
- `cwCounts.floorPlan300`・`cwCounts.floorPlan500`・`cwCounts.siteRegistration` の任意の組み合わせで、表示が仕様通りになる

### Integration Tests

- GASの `syncCwCounts` 実行後、`cw_counts` テーブルに「間取図（300円）」「間取図（500円）」「サイト登録」の3レコードが存在することを確認
- 業務リストで500円案件（`cw_request_email_2f_above` に値あり）を開き、「間取図500円（CW)計⇒ {値}」が表示されることを確認
- 業務リストで300円案件（`cw_request_email_2f_above` が空）を開き、「間取図300円（CW)計⇒ {値}」が変わらず表示されることを確認
