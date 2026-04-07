# 買主サイドバーフィルタ全件表示バグ修正 Design

## Overview

買主リストページにおいて、サイドバーのカテゴリ件数表示は正しいが、カテゴリをクリックすると全件が表示されてしまう問題を修正します。この問題は、サイドバーカウントの高速取得（300ms）と全件データのバックグラウンド取得（23秒）の間にタイミングギャップが存在し、ユーザーが早期にカテゴリをクリックした場合にフィルタリングロジックが実行されないことが原因です。

修正方針は、全件データ未取得時にAPIにフィルタパラメータを渡してバックエンドでフィルタリングを実行し、全件データ取得済みの場合はフロント側でフィルタリングを継続することです。

## Glossary

- **Bug_Condition (C)**: サイドバーカウント取得後（300ms）、全件データ取得前（23秒）にカテゴリをクリックした場合
- **Property (P)**: 該当カテゴリに属する買主のみが表示される
- **Preservation**: 全件データ取得済みの場合のフロント側フィルタリング、検索クエリとの併用、サイドバーカウント表示
- **allBuyersWithStatusRef**: フロント側でキャッシュされた全買主データ（`BuyerWithStatus[]`）
- **sidebarLoadedRef**: サイドバーデータ読み込み済みフラグ（`boolean`）
- **selectedCalculatedStatus**: 選択されたカテゴリキー（例: `'assigned:Y'`, `'todayCallAssigned:I'`, `'viewingDayBefore'`）
- **categoryKeyToDisplayName**: サイドバーのカテゴリキーを日本語の表示名に変換するマッピング

## Bug Details

### Bug Condition

バグは、ユーザーがサイドバーカウント取得後（300ms）、全件データ取得前（23秒）にカテゴリをクリックした場合に発生します。`BuyersPage.tsx`の148-150行目の条件`if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0)`が評価され、`allBuyersWithStatusRef.current`が空の場合、フロント側フィルタリングがスキップされ、APIから全件データが取得されてしまいます。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { clickTime: number, sidebarLoadTime: number, fullDataLoadTime: number, selectedStatus: string | null }
  OUTPUT: boolean
  
  RETURN input.selectedStatus !== null
         AND input.clickTime > input.sidebarLoadTime
         AND input.clickTime < input.fullDataLoadTime
         AND allBuyersWithStatusRef.current.length === 0
END FUNCTION
```

### Examples

- **例1**: ユーザーがページ読み込み後500msで「担当(Y)」をクリック → 全件が表示される（バグ）
- **例2**: ユーザーがページ読み込み後1秒で「当日TEL(Y)」をクリック → 全件が表示される（バグ）
- **例3**: ユーザーがページ読み込み後25秒で「内覧日前日」をクリック → 該当カテゴリのみ表示される（正常）
- **エッジケース**: ユーザーが「All」をクリック → 全件が表示される（正常動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- サイドバーの「All」カテゴリをクリックした場合、全件を表示し続ける
- サイドバーカウントの表示が正しく動作している場合、カウント表示を変更せずに維持する
- 全件データが取得済みの状態でフィルタリングが実行される場合、既存のフロント側フィルタリングロジックを使用し続ける
- 検索クエリが入力されている状態でカテゴリフィルタが適用される場合、検索とカテゴリフィルタの両方を適用し続ける

**Scope:**
全件データが既に取得済みの状態でのフィルタリング操作は完全に影響を受けません。これには以下が含まれます:
- フロント側フィルタリングロジック（`BuyersPage.tsx` 148-200行目）
- 検索クエリとの併用（`debouncedSearch`）
- ページネーション処理

## Hypothesized Root Cause

Bugfix Requirements文書とコードレビューに基づき、最も可能性の高い原因は以下の通りです:

1. **フィルタリング条件の不備**: `BuyersPage.tsx`の148行目の条件`if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0)`が、全件データ未取得時にフロント側フィルタリングをスキップしている

2. **APIパラメータの欠如**: 全件データ未取得時のAPIコール（`BuyersPage.tsx` 206-213行目）で`selectedCalculatedStatus`がAPIに渡されていない

3. **バックエンドのフィルタリング未実装**: `/api/buyers`エンドポイント（`backend/src/routes/buyers.ts` 18-73行目）が`calculatedStatus`パラメータを受け取っていない

4. **タイミング問題**: サイドバーカウント取得（300ms）と全件データ取得（23秒）の間に22.7秒のギャップがあり、ユーザーが早期にクリックする可能性が高い

## Correctness Properties

Property 1: Bug Condition - カテゴリフィルタリングの正確性

_For any_ ユーザー操作で、サイドバーのカテゴリ（例: 「担当(Y)」「当日TEL(Y)」「内覧日前日」）をクリックした場合、システムは該当カテゴリに属する買主のみを表示し、全件データの取得状況に関わらず正しくフィルタリングを実行する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存機能の保持

_For any_ 全件データが既に取得済みの状態でのフィルタリング操作、または「All」カテゴリの選択、または検索クエリとの併用の場合、システムは既存のフロント側フィルタリングロジックを使用し、サイドバーカウント表示を維持し、検索とカテゴリフィルタの両方を適用する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更が必要です:

**File**: `frontend/frontend/src/pages/BuyersPage.tsx`

**Function**: `useEffect` (fetchBuyers)

**Specific Changes**:
1. **フィルタリング条件の修正**: 148行目の条件を修正し、全件データ未取得時でも`selectedCalculatedStatus`が指定されている場合はAPIにフィルタパラメータを渡す
   - 修正前: `if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0)`
   - 修正後: `if (sidebarLoadedRef.current && allBuyersWithStatusRef.current.length > 0 && selectedCalculatedStatus !== null)`

2. **APIパラメータの追加**: 全件データ未取得時のAPIコール（206-213行目）に`calculatedStatus`パラメータを追加
   - 追加: `if (selectedCalculatedStatus) quickParams.calculatedStatus = selectedCalculatedStatus;`

3. **バックエンドルートの修正**: `/api/buyers`エンドポイント（`backend/src/routes/buyers.ts` 18-73行目）で`calculatedStatus`パラメータを受け取り、`getBuyersByStatus`を呼び出す
   - 追加: `calculatedStatus`パラメータの処理ロジック

4. **カテゴリキー変換の追加**: フロント側で`selectedCalculatedStatus`（カテゴリキー）を日本語表示名に変換してからAPIに渡す
   - 追加: `categoryKeyToDisplayName`マッピングの使用

5. **エラーハンドリングの追加**: APIエラー時のフォールバック処理を追加
   - 追加: `catch`ブロックでエラーログを出力し、空配列を返す

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従います: まず、未修正コードでバグを再現する探索的テストを実行し、次に修正後のコードで正しく動作することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は再仮説を立てる。

**Test Plan**: ブラウザの開発者ツールでネットワークタブを開き、ページ読み込み後500ms以内にサイドバーのカテゴリをクリックする。APIリクエストに`calculatedStatus`パラメータが含まれていないこと、およびレスポンスが全件を返すことを確認する。

**Test Cases**:
1. **早期クリックテスト（担当カテゴリ）**: ページ読み込み後500msで「担当(Y)」をクリック（未修正コードで全件が表示される）
2. **早期クリックテスト（当日TELカテゴリ）**: ページ読み込み後1秒で「当日TEL(Y)」をクリック（未修正コードで全件が表示される）
3. **早期クリックテスト（内覧日前日カテゴリ）**: ページ読み込み後500msで「内覧日前日」をクリック（未修正コードで全件が表示される）
4. **遅延クリックテスト**: ページ読み込み後25秒で「担当(Y)」をクリック（未修正コードでも正しくフィルタリングされる）

**Expected Counterexamples**:
- APIリクエストに`calculatedStatus`パラメータが含まれていない
- Possible causes: フィルタリング条件の不備、APIパラメータの欠如、バックエンドのフィルタリング未実装

### Fix Checking

**Goal**: 全件データ未取得時にカテゴリをクリックした場合、修正後のコードが該当カテゴリのみを表示することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fetchBuyers_fixed(input.selectedStatus)
  ASSERT result.data.length > 0
  ASSERT result.data.every(buyer => buyer.calculated_status === input.selectedStatus OR matchesAssignedCategory(buyer, input.selectedStatus))
END FOR
```

### Preservation Checking

**Goal**: 全件データ取得済みの状態でカテゴリをクリックした場合、修正後のコードが既存のフロント側フィルタリングロジックを使用し続けることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fetchBuyers_original(input) = fetchBuyers_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは保存チェックに推奨されます。理由は以下の通りです:
- 入力ドメイン全体で多数のテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを捕捉する
- 全ての非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: まず未修正コードで全件データ取得済みの状態でのフィルタリング動作を観察し、次にその動作を捕捉するproperty-based testを記述する。

**Test Cases**:
1. **フロント側フィルタリング保存**: 全件データ取得済みの状態で「担当(Y)」をクリックし、フロント側フィルタリングが継続することを検証
2. **検索クエリ併用保存**: 検索クエリ入力後に「内覧日前日」をクリックし、検索とカテゴリフィルタの両方が適用されることを検証
3. **Allカテゴリ保存**: 「All」をクリックし、全件が表示されることを検証
4. **サイドバーカウント保存**: カテゴリクリック後もサイドバーカウントが正しく表示されることを検証

### Unit Tests

- 全件データ未取得時のAPIコールに`calculatedStatus`パラメータが含まれることをテスト
- バックエンドの`/api/buyers`エンドポイントが`calculatedStatus`パラメータを正しく処理することをテスト
- フロント側フィルタリング条件が正しく評価されることをテスト

### Property-Based Tests

- ランダムなカテゴリ選択とクリックタイミングを生成し、フィルタリングが正しく動作することを検証
- ランダムな検索クエリとカテゴリ選択を生成し、両方のフィルタが正しく適用されることを検証
- 多数のシナリオで全件データ取得済みの状態でのフロント側フィルタリングが保存されることをテスト

### Integration Tests

- ページ読み込みから早期クリックまでの完全なフローをテスト
- サイドバーカウント取得、カテゴリクリック、テーブル表示の一連の流れをテスト
- 検索クエリ入力、カテゴリクリック、フィルタリング結果表示の統合テスト
