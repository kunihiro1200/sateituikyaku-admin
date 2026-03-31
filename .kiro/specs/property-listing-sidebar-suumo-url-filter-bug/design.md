# AA12497「レインズ登録＋SUUMO登録」誤表示バグ修正設計

## Overview

物件番号AA12497が、Suumo URLが正しく入力されているにもかかわらず、物件リストページのサイドバーで「レインズ登録＋SUUMO登録」カテゴリーに誤って表示されるバグを修正します。

根本原因は、`PropertySidebarStatus`コンポーネントが`calculatePropertyStatus()`を呼び出す際に`workTaskMap`パラメータを渡していないため、条件6のSuumo URLチェックが実行されないことです。

修正方針は、`PropertyListingsPage`で業務依頼データを取得して`workTaskMap`を作成し、`PropertySidebarStatus`コンポーネントに渡すことです。

## Glossary

- **Bug_Condition (C)**: `workTaskMap`が`undefined`のため、条件6のSuumo URLチェックがスキップされる状態
- **Property (P)**: Suumo URLが入力されている物件は「レインズ登録＋SUUMO登録」カテゴリーに表示されない
- **Preservation**: Suumo URLが空の物件は引き続き「レインズ登録＋SUUMO登録」カテゴリーに表示される
- **workTaskMap**: 物件番号をキーとして公開予定日を値とするMapオブジェクト（`Map<string, Date | null>`）
- **calculatePropertyStatus**: 物件のステータスを計算する関数（`frontend/frontend/src/utils/propertyListingStatusUtils.ts`）
- **PropertySidebarStatus**: サイドバーのステータスカテゴリーを表示するコンポーネント（`frontend/frontend/src/components/PropertySidebarStatus.tsx`）
- **条件6**: 公開中で、公開予定日が昨日以前、Suumo URLが空、Suumo登録が「S不要」でない場合に「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」を表示する条件

## Bug Details

### Bug Condition

バグは、`PropertySidebarStatus`コンポーネントが`calculatePropertyStatus()`を呼び出す際に`workTaskMap`パラメータを渡していない場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { listing: PropertyListing, workTaskMap: Map<string, Date | null> | undefined }
  OUTPUT: boolean
  
  RETURN input.workTaskMap === undefined
         AND input.listing.suumo_url IS NOT EMPTY
         AND input.listing.atbb_status IN ['専任・公開中', '一般・公開中']
         AND hasPublishScheduledDate(input.listing.property_number)
         AND publishScheduledDate <= yesterday
         AND input.listing.suumo_registered !== 'S不要'
END FUNCTION
```

### Examples

**例1: AA12497（バグが発生）**
- `suumo_url`: `https://suumo.jp/chukoikkodate/oita/sc_oita/nc_20541403/`（入力済み）
- `atbb_status`: `専任・公開中`
- `publish_scheduled_date`: 昨日以前
- `suumo_registered`: `S不要`でない
- `workTaskMap`: `undefined`（渡されていない）
- **結果**: 条件6の`if (isPublic && workTaskMap)`が`false`になり、Suumo URLチェックがスキップされる → 「レインズ登録＋SUUMO登録」に誤表示

**例2: Suumo URLが空の物件（正常動作）**
- `suumo_url`: `null`または空文字列
- `atbb_status`: `専任・公開中`
- `publish_scheduled_date`: 昨日以前
- `suumo_registered`: `S不要`でない
- `workTaskMap`: `undefined`（渡されていない）
- **結果**: 条件6がスキップされるが、`sidebar_status`が「レインズ登録＋SUUMO登録」として保存されているため、サイドバーに表示される

**例3: 一般公開中でSuumo URLが空（正常動作）**
- `suumo_url`: `null`
- `atbb_status`: `一般・公開中`
- `publish_scheduled_date`: 昨日以前
- `suumo_registered`: `S不要`でない
- `workTaskMap`: `undefined`
- **結果**: `sidebar_status`が「SUUMO URL　要登録」として保存されているため、サイドバーに表示される

**例4: Suumo登録が「S不要」（正常動作）**
- `suumo_url`: `null`
- `atbb_status`: `専任・公開中`
- `publish_scheduled_date`: 昨日以前
- `suumo_registered`: `S不要`
- **結果**: 条件6の`listing.suumo_registered !== 'S不要'`が`false`になり、カテゴリーに表示されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Suumo URLが空の物件は引き続き「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示される
- Suumo登録が「S不要」の物件は引き続きカテゴリーに表示されない
- 公開予定日が今日以降の物件は引き続きカテゴリーに表示されない
- ATBB状況が「公開中」でない物件は引き続きカテゴリーに表示されない
- その他のステータスカテゴリー（「未完了」「本日公開予定」など）の表示は変更されない

**Scope:**
Suumo URLが入力されている物件以外の全ての物件は、この修正の影響を受けません。これには以下が含まれます：
- Suumo URLが空の物件
- Suumo登録が「S不要」の物件
- 公開前の物件
- 非公開の物件

## Hypothesized Root Cause

バグ要件ドキュメントとコード分析に基づき、最も可能性の高い根本原因は以下の通りです：

1. **workTaskMapが渡されていない**: `PropertySidebarStatus`コンポーネントが`calculatePropertyStatus()`を呼び出す際に`workTaskMap`パラメータを渡していない
   - `PropertyListingsPage`で業務依頼データを取得していない
   - `PropertySidebarStatus`に`workTaskMap`をpropsとして渡していない
   - そのため、条件6の`if (isPublic && workTaskMap)`が常に`false`になる

2. **条件6がスキップされる**: `workTaskMap`が`undefined`のため、Suumo URLチェックが実行されない
   - 条件6: `if (isPublic && workTaskMap) { ... }`
   - `workTaskMap`が`undefined`の場合、この条件ブロック全体がスキップされる
   - そのため、Suumo URLの有無に関係なく、次の条件（条件7以降）に進む

3. **sidebar_statusへの依存**: サイドバー表示が`sidebar_status`カラムに依存している
   - `sidebar_status`は物件リスト同期サービスで計算されて保存される
   - しかし、フロントエンドで動的に再計算する際に`workTaskMap`が渡されていない
   - そのため、`sidebar_status`の値がそのまま使用される

4. **データベースのsidebar_statusが古い**: AA12497の`sidebar_status`が「レインズ登録＋SUUMO登録」として保存されている可能性
   - Suumo URLを入力する前に保存された値
   - Suumo URLを入力後、`sidebar_status`が再計算されていない

## Correctness Properties

Property 1: Bug Condition - Suumo URL入力済み物件の除外

_For any_ 物件で、Suumo URLが入力されており（空文字列でない）、ATBB状況が「専任・公開中」または「一般・公開中」で、公開予定日が昨日以前で、Suumo登録が「S不要」でない場合、修正後のシステムは、その物件を「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示しない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Suumo URL未入力物件の表示維持

_For any_ 物件で、Suumo URLが空（`null`、`undefined`、または空文字列）で、ATBB状況が「専任・公開中」または「一般・公開中」で、公開予定日が昨日以前で、Suumo登録が「S不要」でない場合、修正後のシステムは、修正前と同じく、その物件を「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更が必要です：

**File**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Function**: `PropertyListingsPage`

**Specific Changes**:

1. **業務依頼データの取得**: `fetchAllData()`で物件リストと一緒に業務依頼データを取得
   - APIエンドポイント: `/api/work-tasks`（既存）
   - レスポンス: `{ property_number, publish_scheduled_date }[]`

2. **workTaskMapの作成**: `createWorkTaskMap()`を使用してMapオブジェクトを作成
   - `import { createWorkTaskMap } from '../utils/propertyListingStatusUtils'`
   - `const workTaskMap = useMemo(() => createWorkTaskMap(workTasks), [workTasks])`

3. **PropertySidebarStatusにworkTaskMapを渡す**: propsに`workTaskMap`を追加
   - `<PropertySidebarStatus listings={allListings} workTaskMap={workTaskMap} ... />`

**File**: `frontend/frontend/src/components/PropertySidebarStatus.tsx`

**Component**: `PropertySidebarStatus`

**Specific Changes**:

4. **propsにworkTaskMapを追加**: `PropertySidebarStatusProps`インターフェースに`workTaskMap`を追加
   - `workTaskMap?: Map<string, Date | null>`

5. **calculatePropertyStatusにworkTaskMapを渡す**: ステータス計算時に`workTaskMap`を渡す
   - `const computed = calculatePropertyStatus(listing as any, workTaskMap)`

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従います：まず、未修正コードでバグを再現する探索的テストを実行し、次に修正後のコードで正しい動作と既存動作の保持を検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認します。根本原因分析を確認または反証します。反証された場合は、再仮説が必要です。

**Test Plan**: `workTaskMap`を渡さずに`calculatePropertyStatus()`を呼び出し、Suumo URLが入力されている物件が「レインズ登録＋SUUMO登録」カテゴリーに分類されることを確認します。未修正コードで実行して失敗を観察し、根本原因を理解します。

**Test Cases**:
1. **AA12497テスト**: Suumo URLが入力されている専任公開中物件をテスト（未修正コードで失敗）
2. **workTaskMap未定義テスト**: `workTaskMap`が`undefined`の場合、条件6がスキップされることを確認（未修正コードで失敗）
3. **一般公開中テスト**: Suumo URLが入力されている一般公開中物件をテスト（未修正コードで失敗）
4. **エッジケース**: 公開予定日が今日の物件（未修正コードで失敗する可能性）

**Expected Counterexamples**:
- Suumo URLが入力されている物件が「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに分類される
- 可能性のある原因: `workTaskMap`が`undefined`、条件6がスキップされる、`sidebar_status`の古い値が使用される

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := calculatePropertyStatus_fixed(input.listing, input.workTaskMap)
  ASSERT result.key !== 'reins_suumo_required' AND result.key !== 'suumo_required'
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT calculatePropertyStatus_original(input.listing) = calculatePropertyStatus_fixed(input.listing, input.workTaskMap)
END FOR
```

**Testing Approach**: プロパティベーステストは保存チェックに推奨されます。理由：
- 入力ドメイン全体で多数のテストケースを自動生成
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチ
- バグのない入力に対して動作が変更されていないことを強力に保証

**Test Plan**: まず未修正コードでSuumo URLが空の物件とその他の入力の動作を観察し、その動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **Suumo URL空の保存**: Suumo URLが空の物件が引き続き「レインズ登録＋SUUMO登録」カテゴリーに表示されることを確認
2. **S不要の保存**: Suumo登録が「S不要」の物件が引き続きカテゴリーに表示されないことを確認
3. **公開前の保存**: 公開予定日が今日以降の物件が引き続きカテゴリーに表示されないことを確認
4. **非公開の保存**: ATBB状況が「公開中」でない物件が引き続きカテゴリーに表示されないことを確認

### Unit Tests

- `workTaskMap`が正しく作成されることをテスト
- Suumo URLが入力されている物件が「レインズ登録＋SUUMO登録」カテゴリーに表示されないことをテスト
- Suumo URLが空の物件が引き続きカテゴリーに表示されることをテスト
- エッジケース（公開予定日が今日、Suumo登録が「S不要」）をテスト

### Property-Based Tests

- ランダムな物件データを生成し、Suumo URLの有無によって正しくフィルタリングされることを検証
- ランダムなATBB状況と公開予定日を生成し、保存動作を検証
- 多数のシナリオで全ての非バグ入力が引き続き正しく動作することをテスト

### Integration Tests

- 物件リストページ全体のフローをテスト（データ取得 → workTaskMap作成 → ステータス計算 → サイドバー表示）
- サイドバーカテゴリーをクリックしてフィルタリングが正しく動作することをテスト
- AA12497が「レインズ登録＋SUUMO登録」カテゴリーに表示されないことをテスト
