# call-mode-past-log-filter バグ修正設計

## Overview

通話モードページ（`CallModePage`）のサイドバーにある「過去の追客ログ」セクション（`FollowUpLogHistoryTable`）に、通話履歴（`phone_call` タイプのアクティビティ）が表示されている。

このバグの修正方針は、`CallModePage` において `FollowUpLogHistoryTable` の代わりに、activitiesテーブルから `email` および `sms` タイプのみをフィルタリングして表示するコンポーネントを使用することである。

**重要な前提**: `FollowUpLogHistoryTable` はAPPSHEETスプレッドシートから取得した過去の追客ログ（通話記録）を表示するコンポーネントであり、activitiesテーブルとは別のデータソースを使用している。一方、`CallLogDisplay` はactivitiesテーブルの `phone_call` タイプのみを表示している。

修正は最小限にとどめ、`CallModePage` 内で `FollowUpLogHistoryTable` に渡すデータをフィルタリングするか、または新しいフィルタリングpropsを追加する方針とする。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 「過去の追客ログ」セクションに通話履歴（`phone_call` タイプ）が表示されること
- **Property (P)**: 期待される正しい動作 — 「過去の追客ログ」セクションにEmailおよびSMS送信履歴のみが表示されること
- **Preservation**: 修正によって変更してはならない既存の動作
- **FollowUpLogHistoryTable**: `frontend/frontend/src/components/FollowUpLogHistoryTable.tsx` に実装されたコンポーネント。APPSHEETスプレッドシートから過去の追客ログを取得・表示する
- **CallLogDisplay**: `frontend/frontend/src/components/CallLogDisplay.tsx` に実装されたコンポーネント。activitiesテーブルの `phone_call` タイプのみを表示する「売主追客ログ」セクション
- **activitiesテーブル**: Supabaseデータベースのテーブル。`type` フィールドに `phone_call`、`email`、`sms` などのアクティビティタイプを持つ
- **FollowUpLogHistoryEntry**: APPSHEETスプレッドシートから取得した追客ログの1エントリー。現在はタイプ区別フィールドを持たない

## Bug Details

### Bug Condition

「過去の追客ログ」セクション（`FollowUpLogHistoryTable`）は、APPSHEETスプレッドシートから取得した全追客ログを表示している。このスプレッドシートには通話記録が含まれており、それが「売主追客ログ」セクション（`CallLogDisplay`）の通話履歴と重複して表示されている。

**Formal Specification:**
```
FUNCTION isBugCondition(context)
  INPUT: context of type { section: string, displayedData: FollowUpLogHistoryEntry[] }
  OUTPUT: boolean

  RETURN context.section = 'FollowUpLogHistoryTable'
         AND context.displayedData に通話記録（電話架電に関するエントリー）が含まれる
END FUNCTION
```

### Examples

- **バグあり**: 「過去の追客ログ」セクションに「2026/03/16 12:14 - 担当: Y」のような通話記録が表示される → 「売主追客ログ」セクションと重複
- **バグあり**: 「過去の追客ログ」セクションに通話記録のみが存在する場合、Email/SMS履歴がないにもかかわらず通話記録が表示される
- **修正後**: 「過去の追客ログ」セクションにはEmail送信履歴のみが表示される
- **修正後**: 「過去の追客ログ」セクションにはSMS送信履歴のみが表示される
- **修正後**: Email/SMS履歴が存在しない場合、「この売主の履歴データはありません」と表示される

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 「売主追客ログ」セクション（`CallLogDisplay`）は引き続き通話履歴（`phone_call` タイプ）を正しく表示する
- 「過去の追客ログ」セクションにEmail/SMS送信履歴が存在する場合、引き続きそれらを正しく表示する
- `FollowUpLogHistoryTable` のキャッシュ機能（5分TTL）は変更しない
- `FollowUpLogHistoryTable` の手動更新ボタン機能は変更しない
- `FollowUpLogHistoryTable` のデータ取得ロジック（スプレッドシートからの取得）は変更しない

**スコープ:**
通話履歴（`phone_call` タイプ）に関係しない全ての入力・操作は、この修正によって影響を受けてはならない。具体的には:
- マウスクリックによるボタン操作
- Email/SMS送信履歴の表示
- キャッシュ・更新機能

## Hypothesized Root Cause

コードを調査した結果、以下の点が明らかになった:

1. **データソースの違い**: `FollowUpLogHistoryTable` はAPPSHEETスプレッドシートからデータを取得しており、activitiesテーブルとは別のデータソースを使用している。スプレッドシートには通話記録が含まれている。

2. **タイプフィールドの欠如**: `FollowUpLogHistoryEntry` 型にはアクティビティタイプ（`phone_call`/`email`/`sms`）を区別するフィールドが存在しない。スプレッドシートのカラムマッピング（`follow-up-log-history-column-mapping.json`）にタイプフィールドが定義されていない可能性がある。

3. **フィルタリングの欠如**: `FollowUpLogHistoryService.getHistoricalLogs()` は売主番号でのフィルタリングのみを行い、アクティビティタイプによるフィルタリングを行っていない。

4. **最も可能性の高い根本原因**: APPSHEETスプレッドシートの追客ログには通話記録とEmail/SMS記録が混在しており、`FollowUpLogHistoryTable` はそれらを区別せずに全件表示している。

## Correctness Properties

Property 1: Bug Condition - 通話履歴の除外

_For any_ 売主番号に対して「過去の追客ログ」セクション（`FollowUpLogHistoryTable`）が表示される場合、修正後の実装は通話記録（電話架電に関するエントリー）を除外し、EmailおよびSMS送信履歴のみを表示しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非通話履歴の動作保持

_For any_ 入力において通話履歴の除外条件が成立しない場合（Email/SMS履歴の表示、`CallLogDisplay` の動作、キャッシュ・更新機能）、修正後のコードは元のコードと同一の動作を保持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の変更を行う:

**調査が必要な点:**
まず `backend/src/config/follow-up-log-history-column-mapping.json` を確認し、スプレッドシートにアクティビティタイプを区別するカラムが存在するかを確認する。

**ケース1: スプレッドシートにタイプカラムが存在する場合**

**File**: `backend/src/types/followUpLogHistory.ts`

**変更内容**:
1. `FollowUpLogHistoryEntry` 型に `activityType` フィールドを追加

**File**: `backend/src/services/FollowUpLogHistoryService.ts`

**変更内容**:
1. `mapRowToEntry()` でタイプカラムをマッピング
2. `getHistoricalLogs()` でEmail/SMSタイプのみをフィルタリング

**ケース2: スプレッドシートにタイプカラムが存在しない場合（最も可能性が高い）**

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**変更内容**:
1. `FollowUpLogHistoryTable` の代わりに、activitiesテーブルから `email` および `sms` タイプのみを取得して表示する新しいコンポーネントまたはセクションを使用する

**具体的な変更:**
```typescript
// CallModePage.tsx の変更箇所（行 2903-2906 付近）

// 変更前:
{seller?.sellerNumber && (
  <FollowUpLogHistoryTable sellerNumber={seller.sellerNumber} />
)}

// 変更後（案1: FollowUpLogHistoryTableにフィルタリングpropsを追加）:
{seller?.sellerNumber && (
  <FollowUpLogHistoryTable 
    sellerNumber={seller.sellerNumber}
    excludeTypes={['phone_call']}  // 通話履歴を除外
  />
)}

// 変更後（案2: activitiesテーブルからemail/smsのみを表示）:
{id && (
  <PastFollowUpLogSection sellerId={id} />  // email/smsのみ表示する新コンポーネント
)}
```

**推奨アプローチ**: 実装の詳細はスプレッドシートのカラム構造を確認してから決定する。最もシンプルな修正は `FollowUpLogHistoryTable` コンポーネントにフィルタリングロジックを追加することである。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される: まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: 通話履歴を持つ売主の「過去の追客ログ」セクションを表示し、通話記録が表示されることを確認する。未修正コードでテストを実行して失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **通話履歴表示テスト**: 通話記録を持つ売主の `FollowUpLogHistoryTable` を表示し、通話記録が含まれることを確認（未修正コードで失敗するはず）
2. **Email履歴フィルタリングテスト**: Email送信履歴を持つ売主で、Email履歴のみが表示されることを確認（未修正コードで失敗するはず）
3. **空データテスト**: Email/SMS履歴がなく通話記録のみの売主で、「この売主の履歴データはありません」が表示されることを確認（未修正コードで失敗するはず）

**Expected Counterexamples**:
- 通話記録が「過去の追客ログ」セクションに表示される
- 「売主追客ログ」と「過去の追客ログ」に同じ通話記録が重複して表示される

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL sellerNumber WHERE isBugCondition(FollowUpLogHistoryTable(sellerNumber)) DO
  result := FollowUpLogHistoryTable_fixed(sellerNumber)
  ASSERT result に通話記録が含まれない
  ASSERT result に Email/SMS 履歴のみが含まれる（存在する場合）
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同一の動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT CallLogDisplay_original(input) = CallLogDisplay_fixed(input)
  ASSERT FollowUpLogHistoryTable_email_sms_original(input) = FollowUpLogHistoryTable_email_sms_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストが保持チェックに推奨される理由:
- 多様なテストケースを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 非バグ入力全体にわたって動作が変わらないことを強く保証できる

**Test Plan**: 未修正コードでEmail/SMS履歴の動作を観察し、修正後も同じ動作が保持されることを検証するプロパティベーステストを作成する。

**Test Cases**:
1. **CallLogDisplay保持テスト**: `CallLogDisplay` が引き続き通話履歴のみを正しく表示することを確認
2. **Email履歴表示保持テスト**: Email送信履歴が修正後も正しく表示されることを確認
3. **キャッシュ機能保持テスト**: 5分TTLのキャッシュ機能が修正後も正常に動作することを確認
4. **手動更新機能保持テスト**: 更新ボタンが修正後も正常に動作することを確認

### Unit Tests

- `FollowUpLogHistoryTable` のフィルタリングロジックのユニットテスト（通話記録が除外されること）
- Email/SMS履歴が存在しない場合の空状態表示テスト
- `CallLogDisplay` が `phone_call` タイプのみを表示することのテスト

### Property-Based Tests

- ランダムな売主データに対して、`FollowUpLogHistoryTable` が通話記録を含まないことを検証
- ランダムなアクティビティデータに対して、`CallLogDisplay` の動作が変わらないことを検証
- 多様なEmail/SMS履歴データに対して、正しく表示されることを検証

### Integration Tests

- 通話モードページ全体のフロー: `CallLogDisplay` と `FollowUpLogHistoryTable` が正しく分離して表示されること
- 通話記録を持つ売主で、「売主追客ログ」には表示され「過去の追客ログ」には表示されないことを確認
- Email/SMS送信後、「過去の追客ログ」に正しく反映されることを確認
