# 物件リストカテゴリー表示バグ 設計ドキュメント

## Overview

物件リストのサイドバーカテゴリーにおいて、`sidebar_status` が古い形式（`'専任・公開中'`）の物件が、担当者別カテゴリー（例: `'林・専任公開中'`）に正しく分解されず、`'専任・公開中'` のままカウント・表示されるバグを修正する。

**影響ファイル**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**修正方針**: `statusCounts` の `useMemo` 内で `workTaskMap` の有無に関わらず `sidebar_status === '専任・公開中'` の物件を `ASSIGNEE_TO_SENIN_STATUS` で担当者別に分解する処理が、`calculatePropertyStatus` の結果によって意図せずスキップされるケースを修正する。

---

## Glossary

- **Bug_Condition (C)**: `sidebar_status === '専任・公開中'`（古い形式）かつ `sales_assignee` が `ASSIGNEE_TO_SENIN_STATUS` に存在するにもかかわらず、担当者別カテゴリーに分解されずに `'専任・公開中'` としてカウントされる状態
- **Property (P)**: `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林'` の物件が `'林・専任公開中'` としてカウント・表示されること
- **Preservation**: 既存の担当者別専任公開中カテゴリー（`'林・専任公開中'` など）の表示・フィルタリング動作が変わらないこと
- **statusCounts**: `PropertySidebarStatus.tsx` 内の `useMemo` で計算されるカテゴリー別カウントオブジェクト
- **ASSIGNEE_TO_SENIN_STATUS**: `sales_assignee` → 担当者別専任公開中ステータス名のマッピング定数
- **calculatePropertyStatus**: `propertyListingStatusUtils.ts` 内の関数。`atbb_status` などを元に物件のステータスを動的に計算する
- **workTaskMap**: 業務依頼テーブルから生成される `Map<string, Date | null>`。常に `Map` オブジェクトとして渡されるため、`if (workTaskMap)` は常に `true` になる

---

## Bug Details

### Bug Condition

`sidebar_status === '専任・公開中'`（古い形式）の物件に対して、`statusCounts` の `useMemo` 内で `calculatePropertyStatus` が呼ばれた結果が `price_reduction_due` でも `unreported` でもない場合、処理は `return` せずに `sidebar_status` ベースの分解処理へ進む。

しかし、`calculatePropertyStatus` が `exclusive_hayashi`（`atbb_status === '専任・公開中'` かつ `sales_assignee === '林'` の場合）などの専任公開中系のキーを返す場合でも `return` しないため、`sidebar_status` ベースの処理が実行される。この場合は正しく `'林・専任公開中'` がカウントされる。

**実際のバグが発生するケース**: `calculatePropertyStatus` が `atbb_status` を参照して判定するため、`sidebar_status === '専任・公開中'` でも `atbb_status` が異なる値（例: `null`、`'専任・公開前'`、`'一般・公開中'` など）の場合、`calculatePropertyStatus` は `exclusive_hayashi` 以外のキーを返す。この場合も `return` しないため `sidebar_status` ベースの処理が実行されるが、`calculatePropertyStatus` が `pre_publish` や `general_public` などを返す場合は `return` しないため、`sidebar_status` ベースの処理が実行されて `'林・専任公開中'` がカウントされるはず。

**根本的な問題**: `workTaskMap` が存在する場合（常に `true`）、`calculatePropertyStatus` の結果が `price_reduction_due` または `unreported` の場合のみ `return` する。それ以外の場合は `return` しないため、`sidebar_status` ベースの処理が実行される。ただし、`calculatePropertyStatus` が `exclusive_hayashi` などを返す場合でも `return` しないため、`sidebar_status` ベースの処理も実行される。

**実際に確認されたバグ**: `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林'` の物件が `'林・専任公開中'` ではなく `'専任・公開中'` として表示されている。これは `ASSIGNEE_TO_SENIN_STATUS` のマッピングが何らかの理由で機能していないことを示す。

**Formal Specification:**
```
FUNCTION isBugCondition(listing)
  INPUT: listing of type PropertyListing
  OUTPUT: boolean

  RETURN listing.sidebar_status === '専任・公開中'
         AND listing.sales_assignee IN KEYS(ASSIGNEE_TO_SENIN_STATUS)
         AND カテゴリー表示が ASSIGNEE_TO_SENIN_STATUS[listing.sales_assignee] ではなく '専任・公開中' になっている
END FUNCTION
```

### Examples

- `sidebar_status = '専任・公開中'`, `sales_assignee = '林'` → 期待: `'林・専任公開中'` / 実際: `'専任・公開中'`
- `sidebar_status = '専任・公開中'`, `sales_assignee = '山本'` → 期待: `'Y専任公開中'` / 実際: `'専任・公開中'`（同様のバグが発生している可能性）
- `sidebar_status = '林・専任公開中'`（新形式）→ 期待: `'林・専任公開中'` / 実際: `'林・専任公開中'`（正常）
- `sidebar_status = '専任・公開中'`, `sales_assignee = null` → 期待: `'専任・公開中'` / 実際: `'専任・公開中'`（正常・意図した動作）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `sidebar_status` がすでに `'林・専任公開中'` などの担当者別形式になっている物件は、引き続き正しく表示される
- 他の担当者（山本→Y専任公開中、生野→生・専任公開中、久→久・専任公開中、裏→U専任公開中、国広→K専任公開中、木村→R専任公開中、角井→I専任公開中）の専任公開中カテゴリーは変わらず表示される
- 担当者別専任公開中カテゴリーをクリックしたフィルタリングは引き続き正しく動作する
- `sales_assignee` が未設定またはマッピングに存在しない場合は `'専任・公開中'` としてカウントされ続ける
- `'要値下げ'`、`'未報告'` などの他のカテゴリーの表示・カウントは変わらない

**Scope:**
`sidebar_status === '専任・公開中'` 以外の物件はこの修正の影響を受けない。

---

## Hypothesized Root Cause

コードを詳細に確認した結果、以下の根本原因が考えられる：

1. **`calculatePropertyStatus` の結果による早期 `return` の問題**: `workTaskMap` が存在する場合（常に `true`）、`calculatePropertyStatus` が `price_reduction_due` または `unreported` を返すと `return` する。`sidebar_status === '専任・公開中'` の物件がこれらのステータスに該当する場合、`ASSIGNEE_TO_SENIN_STATUS` による分解処理がスキップされ、`'専任・公開中'` としてカウントされない（カウント自体がスキップされる）。

2. **`atbb_status` と `sidebar_status` の不一致**: `calculatePropertyStatus` は `atbb_status` を参照するが、`sidebar_status` は古い形式のまま残っている場合がある。`atbb_status === '専任・公開中'` かつ `sidebar_status === '専任・公開中'` の物件では、`calculatePropertyStatus` が `exclusive_hayashi` などを返し、`return` しないため `sidebar_status` ベースの処理が実行される。しかし `atbb_status` が異なる値の場合、`calculatePropertyStatus` が別のキーを返す。

3. **最も可能性が高い原因**: `sidebar_status === '専任・公開中'` の物件の `calculatePropertyStatus` が `price_reduction_due` または `unreported` を返す場合、`return` してしまい、`ASSIGNEE_TO_SENIN_STATUS` による分解処理がスキップされる。この場合、`'林・専任公開中'` としてカウントされず、`'専任・公開中'` としてもカウントされないため、カテゴリーに表示されない。あるいは、別の物件が `'専任・公開中'` としてカウントされている可能性がある。

4. **`statusList` の `label: key` の問題**: `statusList` では `label: key` としているため、`key` が `'専任・公開中'` の場合はそのまま `'専任・公開中'` と表示される。`ASSIGNEE_TO_SENIN_STATUS` のマッピングが機能していれば `key` は `'林・専任公開中'` になるはずだが、何らかの理由でマッピングが機能していない場合は `'専任・公開中'` が表示される。

---

## Correctness Properties

Property 1: Bug Condition - 専任・公開中の担当者別分解

_For any_ 物件リストにおいて `sidebar_status === '専任・公開中'` かつ `sales_assignee` が `ASSIGNEE_TO_SENIN_STATUS` に存在する場合、修正後の `statusCounts` 計算は `ASSIGNEE_TO_SENIN_STATUS[sales_assignee]`（例: `'林・専任公開中'`）としてカウントし、サイドバーカテゴリーに担当者名付きで表示する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の担当者別専任公開中カテゴリーの保持

_For any_ 物件リストにおいて `sidebar_status` がすでに担当者別形式（例: `'林・専任公開中'`）になっている場合、修正後のコードは修正前と同じカウント・表示結果を生成し、既存の担当者別専任公開中カテゴリーの表示・フィルタリング動作を変えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**Function**: `statusCounts` の `useMemo` 内のロジック

**Specific Changes**:

1. **`calculatePropertyStatus` の結果による早期 `return` の問題を修正**: `workTaskMap` が存在する場合に `calculatePropertyStatus` が `price_reduction_due` または `unreported` を返す場合のみ `return` する現在のロジックを維持しつつ、`sidebar_status === '専任・公開中'` の分解処理が確実に実行されるようにする。

2. **`sidebar_status === '専任・公開中'` の分解処理を `workTaskMap` の有無に依存しない形に変更**: 現在の処理は `workTaskMap` ブロックの外にあるが、`calculatePropertyStatus` の結果によって `return` される場合があるため、`sidebar_status === '専任・公開中'` の分解処理を `calculatePropertyStatus` の結果に依存しない形に変更する。

3. **具体的な修正案**: `calculatePropertyStatus` が `price_reduction_due` または `unreported` を返す場合でも、`sidebar_status === '専任・公開中'` の物件は `ASSIGNEE_TO_SENIN_STATUS` で分解してカウントする。または、`calculatePropertyStatus` の結果が `price_reduction_due` または `unreported` の場合は `return` する前に `sidebar_status === '専任・公開中'` の分解処理を実行する。

**修正前のコード（問題箇所）**:
```typescript
if (workTaskMap) {
  const computed = calculatePropertyStatus(listing as any, workTaskMap);
  
  if (computed.key === 'price_reduction_due') {
    counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
    return; // ← ここで return すると sidebar_status の分解処理がスキップされる
  }
  
  if (computed.key === 'unreported') {
    const label = computed.label.replace(/\s+/g, '');
    counts[label] = (counts[label] || 0) + 1;
    return; // ← ここで return すると sidebar_status の分解処理がスキップされる
  }
}

// sidebar_status ベースの処理（return された場合はここに到達しない）
if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
  if (status === '専任・公開中') {
    const assignee = listing.sales_assignee || '';
    const assigneeStatus = ASSIGNEE_TO_SENIN_STATUS[assignee] || '専任・公開中';
    counts[assigneeStatus] = (counts[assigneeStatus] || 0) + 1;
  } else {
    counts[status] = (counts[status] || 0) + 1;
  }
}
```

**修正後のコード（案）**:
```typescript
// sidebar_status === '専任・公開中' の分解処理を先に実行（workTaskMap の有無に依存しない）
const normalizedStatus = status.replace(/\s+/g, '');
if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
  if (status === '専任・公開中') {
    const assignee = listing.sales_assignee || '';
    const assigneeStatus = ASSIGNEE_TO_SENIN_STATUS[assignee] || '専任・公開中';
    counts[assigneeStatus] = (counts[assigneeStatus] || 0) + 1;
    // 専任・公開中は sidebar_status ベースで処理済みなので、workTaskMap の処理をスキップ
    return;
  }
}

if (workTaskMap) {
  const computed = calculatePropertyStatus(listing as any, workTaskMap);
  
  if (computed.key === 'price_reduction_due') {
    counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
    return;
  }
  
  if (computed.key === 'unreported') {
    const label = computed.label.replace(/\s+/g, '');
    counts[label] = (counts[label] || 0) + 1;
    return;
  }
}

// その他の sidebar_status ベースの処理
if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
  counts[status] = (counts[status] || 0) + 1;
}
```

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで進める。まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードでバグが解消されていること・既存動作が保持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `PropertySidebarStatus` コンポーネントに `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林'` の物件を渡し、カテゴリーに `'専任・公開中'` が表示されることを確認する。

**Test Cases**:
1. **基本ケース**: `sidebar_status = '専任・公開中'`, `sales_assignee = '林'`, `workTaskMap` あり → `'専任・公開中'` が表示される（未修正コードでは失敗するはず）
2. **要値下げ物件**: `sidebar_status = '専任・公開中'`, `sales_assignee = '林'`, `price_reduction_scheduled_date` が今日以前 → `calculatePropertyStatus` が `price_reduction_due` を返して `return` するため、`'林・専任公開中'` がカウントされない
3. **未報告物件**: `sidebar_status = '専任・公開中'`, `sales_assignee = '林'`, `report_date` が今日以前 → `calculatePropertyStatus` が `unreported` を返して `return` するため、`'林・専任公開中'` がカウントされない
4. **workTaskMap なし**: `workTaskMap` を渡さない場合 → `sidebar_status` ベースの処理が実行されて `'林・専任公開中'` がカウントされる（正常動作）

**Expected Counterexamples**:
- `price_reduction_scheduled_date` が今日以前の `sidebar_status === '専任・公開中'` 物件が `'林・専任公開中'` としてカウントされない
- `report_date` が今日以前の `sidebar_status === '専任・公開中'` 物件が `'林・専任公開中'` としてカウントされない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当する全ての物件が正しく担当者別カテゴリーにカウントされることを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE isBugCondition(listing) DO
  result := statusCounts_fixed(listing)
  ASSERT result[ASSIGNEE_TO_SENIN_STATUS[listing.sales_assignee]] > 0
  ASSERT result['専任・公開中'] === 0 OR result['専任・公開中'] は sales_assignee が未設定の物件のみ
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件に該当しない物件のカウント・表示が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL listing WHERE NOT isBugCondition(listing) DO
  ASSERT statusCounts_original(listing) = statusCounts_fixed(listing)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様な物件データを自動生成して、修正前後のカウント結果が一致することを検証する。

**Test Cases**:
1. **新形式の担当者別専任公開中**: `sidebar_status = '林・専任公開中'` の物件が修正後も `'林・専任公開中'` としてカウントされる
2. **他の担当者**: `sidebar_status = '専任・公開中'`, `sales_assignee = '山本'` → `'Y専任公開中'` としてカウントされる
3. **未設定担当者**: `sidebar_status = '専任・公開中'`, `sales_assignee = null` → `'専任・公開中'` としてカウントされる
4. **他のカテゴリー**: `sidebar_status = '未完了'` などの物件は修正の影響を受けない

### Unit Tests

- `sidebar_status === '専任・公開中'` かつ各担当者の物件が正しく担当者別カテゴリーにカウントされることをテスト
- `price_reduction_scheduled_date` が今日以前の `sidebar_status === '専任・公開中'` 物件のカウントをテスト
- `report_date` が今日以前の `sidebar_status === '専任・公開中'` 物件のカウントをテスト
- `sales_assignee` が未設定の場合に `'専任・公開中'` としてカウントされることをテスト

### Property-Based Tests

- ランダムな `sales_assignee` を持つ `sidebar_status === '専任・公開中'` 物件を生成し、`ASSIGNEE_TO_SENIN_STATUS` のマッピングが正しく適用されることを検証
- ランダムな `price_reduction_scheduled_date` を持つ物件を生成し、`'林・専任公開中'` のカウントが正しいことを検証
- 修正前後のカウント結果を比較し、`sidebar_status !== '専任・公開中'` の物件のカウントが変わらないことを検証

### Integration Tests

- 物件リストページで `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林'` の物件が `'林・専任公開中'` カテゴリーに表示されることを確認
- `'林・専任公開中'` カテゴリーをクリックして、対応する物件のみがフィルタリングされることを確認
- 修正後も他のカテゴリー（`'要値下げ'`、`'未報告'` など）が正しく表示されることを確認
