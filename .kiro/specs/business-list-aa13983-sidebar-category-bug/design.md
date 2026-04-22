# 業務リストAA13983サイドバーカテゴリーバグ 修正設計

## Overview

業務リスト（WorkTasksPage）のサイドバーカテゴリー判定ロジックにバグがある。
AA13983は `cw_request_email_site = 'N'`（依頼済み）であるにもかかわらず、
条件3（「サイト登録依頼してください」）が `cw_request_email_site` を考慮していないため、
誤って「サイト登録依頼してください」カテゴリーに分類されている。

修正方針：
1. `WorkTask` インターフェースに `cw_request_email_site: string` を追加
2. 条件3に `isBlank(task.cw_request_email_site)` を追加し、依頼済みの場合はスキップする

対象ファイル: `frontend/frontend/src/utils/workTaskStatusUtils.ts`

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `cw_request_email_site` に値（'Y' または 'N'）が入っており、かつ `site_registration_requestor` が空の場合に、誤って「サイト登録依頼してください」に分類される
- **Property (P)**: 修正後の期待動作 — `cw_request_email_site` に値がある場合、条件3をスキップして「サイト依頼済み納品待ち」に分類される
- **Preservation**: 修正によって変更されてはならない既存の動作 — `cw_request_email_site` が空の場合の「サイト登録依頼してください」分類、その他全カテゴリーの判定ロジック
- **calculateTaskStatus**: `workTaskStatusUtils.ts` 内の関数で、`WorkTask` を受け取りカテゴリー文字列を返す
- **isBugCondition**: バグが発生する入力条件を識別する関数（本設計での形式的定義）
- **cw_request_email_site**: スプレッドシートのCGカラム。CWへのサイト登録依頼メール送信状況。'Y' または 'N' が入っていれば依頼済みを意味する

## Bug Details

### Bug Condition

`cw_request_email_site` に値（'Y' または 'N'）が入っており依頼済みの状態であるにもかかわらず、
条件3の判定で `cw_request_email_site` が考慮されていないため、
`site_registration_requestor` が空の場合に誤って「サイト登録依頼してください」に分類される。

**Formal Specification:**
```
FUNCTION isBugCondition(task)
  INPUT: task of type WorkTask
  OUTPUT: boolean

  RETURN isNotBlank(task.cw_request_email_site)
         AND isBlank(task.site_registration_requestor)
         AND isBlank(task.on_hold)
         AND isBlank(task.distribution_date)
         AND isBlank(task.publish_scheduled_date)
         AND isNotBlank(task.site_registration_deadline)
         AND isBlank(task.sales_contract_deadline)
END FUNCTION
```

### Examples

- **AA13983（バグ再現例）**: `cw_request_email_site = 'N'`、`site_registration_requestor = null`、`site_registration_deadline = '2026-04-22'`、`sales_contract_deadline = null` → 現状: 「サイト登録依頼してください 4/22」に分類（誤り）、期待: 「サイト依頼済み納品待ち 4/22」に分類
- **正常ケース（cw_request_email_site = 'Y'）**: `cw_request_email_site = 'Y'`、`site_registration_requestor = null`、`site_registration_deadline = '2026-05-10'` → 現状: 「サイト登録依頼してください 5/10」に分類（誤り）、期待: 「サイト依頼済み納品待ち 5/10」に分類
- **正常ケース（site_registration_requestor あり）**: `cw_request_email_site = null`、`site_registration_requestor = '田中'`、`site_registration_deadline = '2026-04-22'` → 条件3をスキップ（変更なし）
- **エッジケース（cw_request_email_site が空）**: `cw_request_email_site = null`、`site_registration_requestor = null`、`site_registration_deadline = '2026-04-22'` → 「サイト登録依頼してください 4/22」に分類（修正後も変わらない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `cw_request_email_site` が空で `site_registration_requestor` も空の場合、引き続き「サイト登録依頼してください」に分類される
- `site_registration_confirm_request_date` が設定されており `site_registration_confirmed` が空の場合、「サイト登録要確認」に分類される
- `sales_contract_confirmed = '確認中'` の場合、「売買契約　営業確認中」に分類される
- `on_hold` が設定されている場合、「保留」に分類される
- `sales_contract_deadline` が設定されており依頼未の場合、「売買契約 依頼未」に分類される

**Scope:**
バグ条件（`cw_request_email_site` に値がある場合）に該当しない全ての入力は、
この修正によって完全に影響を受けない。これには以下が含まれる：
- `cw_request_email_site` が空の全タスク
- 売買契約関連の全条件（条件1、2、7、8）
- 決済・入金関連の全条件（条件4、5、6）
- 媒介作成・保留の全条件（条件11、12）

## Hypothesized Root Cause

根本原因はDBデータ確認により既に特定済み：

1. **WorkTaskインターフェースの定義漏れ**: `WorkTask` インターフェースに `cw_request_email_site` フィールドが定義されていないため、TypeScriptの型システムで参照できない状態になっている

2. **条件3の判定ロジックの不完全さ**: 条件3（「サイト登録依頼してください」）が `site_registration_requestor` のみを依頼済み判定の根拠としており、`cw_request_email_site`（CWへの依頼メール送信状況）を考慮していない

3. **スプレッドシートとの仕様乖離**: スプレッドシートのCGカラム（`cw_request_email_site`）が依頼済みを示す値（'Y'/'N'）を持つ場合も依頼済みとみなすべきだが、その仕様がコードに反映されていない

## Correctness Properties

Property 1: Bug Condition - cw_request_email_siteに値がある場合は条件3をスキップ

_For any_ task where `cw_request_email_site` is not blank (isBugCondition returns true),
the fixed `calculateTaskStatus` function SHALL NOT return a string starting with
「サイト登録依頼してください」, and SHALL instead proceed to evaluate subsequent conditions
(resulting in「サイト依頼済み納品待ち」when other conditions for condition 9 are met).

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - cw_request_email_siteが空の場合は従来通り条件3が適用される

_For any_ task where `cw_request_email_site` IS blank (isBugCondition returns false),
the fixed `calculateTaskStatus` function SHALL produce exactly the same result as the
original function, preserving all existing category classification behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析に基づく修正内容：

**File**: `frontend/frontend/src/utils/workTaskStatusUtils.ts`

**Change 1: WorkTaskインターフェースへのフィールド追加**

`WorkTask` インターフェースに `cw_request_email_site: string` を追加する。
`site_registration_requestor` の直後に追加するのが適切。

```typescript
// 修正前
site_registration_requestor: string;
distribution_date: string;

// 修正後
site_registration_requestor: string;
cw_request_email_site: string;  // ← 追加
distribution_date: string;
```

**Change 2: 条件3への判定追加**

条件3（「サイト登録依頼してください」）に `isBlank(task.cw_request_email_site)` を追加する。
`isBlank(task.site_registration_requestor)` の直後に追加するのが適切。

```typescript
// 修正前
if (
  isBlank(task.site_registration_requestor) &&
  isBlank(task.on_hold) &&
  isBlank(task.distribution_date) &&
  isBlank(task.publish_scheduled_date) &&
  isNotBlank(task.site_registration_deadline) &&
  isBlank(task.sales_contract_deadline)
) {
  return `サイト登録依頼してください ${formatDateMD(task.site_registration_deadline)}`;
}

// 修正後
if (
  isBlank(task.site_registration_requestor) &&
  isBlank(task.cw_request_email_site) &&
  isBlank(task.on_hold) &&
  isBlank(task.distribution_date) &&
  isBlank(task.publish_scheduled_date) &&
  isNotBlank(task.site_registration_deadline) &&
  isBlank(task.sales_contract_deadline)
) {
  return `サイト登録依頼してください ${formatDateMD(task.site_registration_deadline)}`;
}
```

**Specific Changes Summary:**
1. `WorkTask` インターフェースに `cw_request_email_site: string` を追加（`site_registration_requestor` の直後）
2. 条件3の `if` 文に `isBlank(task.cw_request_email_site) &&` を追加（`isBlank(task.site_registration_requestor) &&` の直後）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：
まず未修正コードでバグを再現するカウンターエグザンプルを確認し、
次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認する。

**Test Plan**: AA13983と同じ条件のタスクオブジェクトを作成し、`calculateTaskStatus` を呼び出して
「サイト登録依頼してください」が返ることを確認する。

**Test Cases**:
1. **AA13983再現テスト**: `cw_request_email_site = 'N'`、`site_registration_requestor = null`、`site_registration_deadline = '2026-04-22'`、`sales_contract_deadline = null` → 未修正コードで「サイト登録依頼してください 4/22」が返ることを確認（バグ再現）
2. **cw_request_email_site = 'Y' テスト**: `cw_request_email_site = 'Y'`、その他同条件 → 未修正コードで「サイト登録依頼してください」が返ることを確認（バグ再現）
3. **TypeScript型エラーテスト**: `WorkTask` インターフェースに `cw_request_email_site` がないため、直接参照するとTypeScriptエラーが発生することを確認

**Expected Counterexamples**:
- `cw_request_email_site` に値があっても「サイト登録依頼してください」が返る
- 原因: 条件3が `cw_request_email_site` を参照していない

### Fix Checking

**Goal**: バグ条件に該当する全入力で、修正後の関数が正しい動作をすることを検証する。

**Pseudocode:**
```
FOR ALL task WHERE isBugCondition(task) DO
  result := calculateTaskStatus_fixed(task)
  ASSERT NOT result.startsWith('サイト登録依頼してください')
END FOR
```

### Preservation Checking

**Goal**: バグ条件に該当しない全入力で、修正後の関数が元の関数と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL task WHERE NOT isBugCondition(task) DO
  ASSERT calculateTaskStatus_original(task) = calculateTaskStatus_fixed(task)
END FOR
```

**Testing Approach**: プロパティベーステストが保持チェックに推奨される理由：
- 入力ドメイン全体で多数のテストケースを自動生成できる
- 手動ユニットテストでは見逃しがちなエッジケースを検出できる
- 非バグ入力全体で動作が変わらないことを強く保証できる

**Test Plan**: 未修正コードで `cw_request_email_site` が空の場合の動作を観察し、
修正後も同じ動作が保持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **cw_request_email_site空の保持テスト**: `cw_request_email_site = null`、`site_registration_requestor = null`、`site_registration_deadline = '2026-04-22'` → 修正前後ともに「サイト登録依頼してください 4/22」が返ることを確認
2. **サイト登録要確認の保持テスト**: `site_registration_confirm_request_date` が設定されており `site_registration_confirmed` が空 → 修正前後ともに「サイト登録要確認」が返ることを確認
3. **売買契約条件の保持テスト**: `sales_contract_confirmed = '確認中'` → 修正前後ともに「売買契約　営業確認中」が返ることを確認
4. **保留の保持テスト**: `on_hold` が設定されている → 修正前後ともに「保留」が返ることを確認

### Unit Tests

- `cw_request_email_site = 'N'` の場合に条件3をスキップして条件9に進むことを確認
- `cw_request_email_site = 'Y'` の場合に条件3をスキップして条件9に進むことを確認
- `cw_request_email_site = null` の場合に条件3が適用されることを確認
- `cw_request_email_site = ''` の場合に条件3が適用されることを確認（空文字も空とみなす）
- AA13983と同じ条件で「サイト依頼済み納品待ち」が返ることを確認

### Property-Based Tests

- ランダムな `WorkTask` を生成し、`cw_request_email_site` が空でない場合は「サイト登録依頼してください」が返らないことを検証（Property 1）
- ランダムな `WorkTask` を生成し、`cw_request_email_site` が空の場合は修正前後で同じ結果が返ることを検証（Property 2）
- 全カテゴリーにわたって多数のシナリオで保持チェックを実施

### Integration Tests

- AA13983の実際のDBデータと同じ条件でエンドツーエンドのカテゴリー分類を確認
- 業務リストページでAA13983が「サイト依頼済み納品待ち」カテゴリーに表示されることを確認
- 他のタスクのカテゴリー分類が変わっていないことを確認
