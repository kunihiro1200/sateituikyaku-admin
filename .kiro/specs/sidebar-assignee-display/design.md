# サイドバー担当者表示 Bugfix Design

## Overview

売主リストのサイドバーに「担当（Y）」「担当（I）」などの担当者別メインカテゴリーと、その配下に「当日TEL(Y)」「当日TEL(I)」のサブカテゴリーを表示する機能が実装されていないバグを修正する。

現在のサイドバーは固定カテゴリー（当日TEL分、当日TEL（内容）、未査定、査定（郵送））のみを表示しており、`visit_assignee`（営担）に値がある売主を担当者別に分類・表示する機能が欠落している。

修正方針は、売主データから担当者のユニークなイニシャルを動的に抽出し、担当者ごとのメインカテゴリーとサブカテゴリーをサイドバーに追加表示することである。

## Glossary

- **Bug_Condition (C)**: `visit_assignee`に有効な値（「外す」以外）が入力されている売主が存在するにもかかわらず、サイドバーに担当者別カテゴリーが表示されない状態
- **Property (P)**: 担当者別カテゴリーが正しく表示され、クリックで該当売主がフィルタリングされる動作
- **Preservation**: 既存の当日TEL分・当日TEL（内容）・未査定・査定（郵送）・当日TEL_未着手・Pinrich空欄カテゴリーの動作が変わらないこと
- **visit_assignee**: 営担フィールド。売主に割り当てられた営業担当者のイニシャル（例: "Y", "I"）
- **next_call_date**: 次電日フィールド。次回電話予定日
- **isTodayCallAssigned**: `visit_assignee`に有効な値があり、かつ`next_call_date`が今日以前の場合にtrueを返す既存関数
- **hasVisitAssignee**: `visit_assignee`に有効な値（「外す」以外）があるかどうかを判定する既存関数
- **担当カテゴリー**: 動的に生成される担当者別カテゴリー。`visitAssigned:{イニシャル}`形式のIDを使用
- **当日TELサブカテゴリー**: 担当カテゴリーの配下に表示されるサブカテゴリー。`todayCallAssigned:{イニシャル}`形式のIDを使用

## Bug Details

### Fault Condition

`visit_assignee`に有効な値が入力されている売主が存在するにもかかわらず、サイドバーに担当者別カテゴリーが表示されない。`SellerStatusSidebar.tsx`は固定カテゴリーのみをレンダリングしており、動的な担当者別カテゴリーを生成・表示するロジックが存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition(sellers)
  INPUT: sellers - 売主データの配列
  OUTPUT: boolean
  
  assignees = UNIQUE_VALUES(sellers.map(s => s.visit_assignee).filter(hasVisitAssignee))
  
  RETURN assignees.length > 0
         AND サイドバーに担当者別カテゴリーが表示されていない
END FUNCTION
```

### Examples

- visit_assignee="Y"の売主が存在する → 「担当（Y）」カテゴリーが表示されるべきだが表示されない
- visit_assignee="Y"かつnext_call_date=今日以前の売主が存在する → 「当日TEL(Y)」サブカテゴリーが表示されるべきだが表示されない
- visit_assignee="Y"とvisit_assignee="I"の売主が両方存在する → 「担当（Y）」「担当（I）」が個別に表示されるべきだが表示されない
- visit_assignee="外す"の売主のみ存在する → 担当カテゴリーは表示されない（正常動作）

## Expected Behavior

### Preservation Requirements

**変更しない動作:**
- `visit_assignee`が空欄の売主は引き続き「③当日TEL分」カテゴリーに分類される
- `visit_assignee`が空欄の売主は引き続き「④当日TEL（内容）」カテゴリーに分類される
- サイドバーのカテゴリーをクリックすると該当カテゴリーの売主一覧がフィルタリングされる
- 未査定・査定（郵送）・当日TEL_未着手・Pinrich空欄の各カテゴリーは影響を受けない
- `isTodayCall`、`isTodayCallWithInfo`、`isUnvaluated`、`isMailingPending`、`isTodayCallNotStarted`、`isPinrichEmpty`の各フィルター関数は変更しない

**スコープ:**
`visit_assignee`が空欄または「外す」の売主に関する全ての動作は、この修正によって一切影響を受けない。

## Hypothesized Root Cause

バグの根本原因は以下の通りである：

1. **SellerStatusSidebar.tsxに動的カテゴリー生成ロジックが存在しない**: 現在のサイドバーは`renderAllCategories()`関数内で固定カテゴリーのみをレンダリングしており、`visit_assignee`の値を元に動的にカテゴリーを生成するロジックが実装されていない

2. **StatusCategory型が動的カテゴリーに対応していない**: 現在の`StatusCategory`型は固定の文字列リテラルのみを定義しており、`visitAssigned:Y`のような動的なカテゴリーIDを表現できない

3. **CategoryCounts型に担当者別カウントが含まれていない**: `CategoryCounts`インターフェースは担当者別の件数を保持するフィールドを持っていない

4. **filterSellersByCategory関数が動的カテゴリーを処理できない**: 現在の実装は固定カテゴリーのswitch文のみであり、動的な担当者別カテゴリーのフィルタリングに対応していない

## Correctness Properties

Property 1: Fault Condition - 担当者別カテゴリーの表示

_For any_ 売主データの配列において、`visit_assignee`に有効な値（「外す」以外）を持つ売主が存在する場合、修正後のサイドバーは担当者のイニシャルごとに「担当（{イニシャル}）」メインカテゴリーを表示し、`next_call_date`が今日以前の売主が存在する場合はその配下に「当日TEL({イニシャル})」サブカテゴリーを表示しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存カテゴリーの動作維持

_For any_ 売主データの配列において、`visit_assignee`が空欄または「外す」の売主に関する全ての分類・フィルタリング動作は、修正前と修正後で同一の結果を返さなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**変更内容**:
1. **StatusCategory型の拡張**: 動的カテゴリーIDをサポートするため、`string`型との合成型に変更する
   ```typescript
   export type StatusCategory = 'all' | 'todayCall' | 'todayCallWithInfo' | 'todayCallAssigned' 
     | 'visitScheduled' | 'visitCompleted' | 'unvaluated' | 'mailingPending' 
     | 'todayCallNotStarted' | 'pinrichEmpty'
     | `visitAssigned:${string}`      // 担当カテゴリー（例: visitAssigned:Y）
     | `todayCallAssigned:${string}`; // 当日TELサブカテゴリー（例: todayCallAssigned:Y）
   ```

2. **担当者別フィルター関数の追加**:
   ```typescript
   // 特定の担当者（イニシャル）に該当する売主を判定
   export const isVisitAssignedTo = (seller: Seller | any, assignee: string): boolean => {
     const visitAssignee = seller.visitAssignee || seller.visit_assignee || '';
     return visitAssignee.trim() === assignee;
   };
   
   // 特定の担当者の当日TEL対象かどうかを判定
   export const isTodayCallAssignedTo = (seller: Seller | any, assignee: string): boolean => {
     return isVisitAssignedTo(seller, assignee) && isTodayCallAssigned(seller);
   };
   
   // 売主リストからユニークな担当者イニシャルを取得
   export const getUniqueAssignees = (sellers: (Seller | any)[]): string[] => {
     const assignees = sellers
       .map(s => s.visitAssignee || s.visit_assignee || '')
       .filter(a => a && a.trim() !== '' && a.trim() !== '外す');
     return [...new Set(assignees)].sort();
   };
   ```

3. **filterSellersByCategory関数の拡張**: 動的カテゴリーIDのパターンマッチングを追加
   ```typescript
   // 動的カテゴリーの処理
   if (category.startsWith('visitAssigned:')) {
     const assignee = category.replace('visitAssigned:', '');
     return sellers.filter(s => isVisitAssignedTo(s, assignee));
   }
   if (category.startsWith('todayCallAssigned:')) {
     const assignee = category.replace('todayCallAssigned:', '');
     return sellers.filter(s => isTodayCallAssignedTo(s, assignee));
   }
   ```

---

**File**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

**変更内容**:
1. **新しいimportの追加**: `getUniqueAssignees`、`isTodayCallAssigned`、`isVisitAssignedTo`、`isTodayCallAssignedTo`をインポート

2. **担当者別カテゴリーのレンダリング関数を追加**:
   ```typescript
   const renderAssigneeCategories = () => {
     const assignees = getUniqueAssignees(validSellers);
     return assignees.map(assignee => {
       const assignedSellers = validSellers.filter(s => isVisitAssignedTo(s, assignee));
       const todayCallSellers = validSellers.filter(s => isTodayCallAssignedTo(s, assignee));
       
       return (
         <Box key={assignee}>
           {/* 担当（Y）メインカテゴリー */}
           {renderCategoryButton(
             `visitAssigned:${assignee}` as StatusCategory,
             `担当（${assignee}）`,
             '#ff5722',
             assignedSellers.length
           )}
           {/* 当日TEL(Y)サブカテゴリー（インデント付き） */}
           {todayCallSellers.length > 0 && (
             <Box sx={{ pl: 2 }}>
               {renderCategoryButton(
                 `todayCallAssigned:${assignee}` as StatusCategory,
                 `当日TEL(${assignee})`,
                 '#ff5722',
                 todayCallSellers.length
               )}
             </Box>
           )}
         </Box>
       );
     });
   };
   ```

3. **renderAllCategories関数の更新**: 担当者別カテゴリーを既存カテゴリーの前に追加
   ```typescript
   const renderAllCategories = () => (
     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
       {/* All */}
       ...
       {/* 担当者別カテゴリー（動的生成） */}
       {renderAssigneeCategories()}
       {/* 既存カテゴリー */}
       {renderCategoryButton('todayCall', '③当日TEL分', '#d32f2f')}
       ...
     </Box>
   );
   ```

4. **filterSellersByCategory関数の更新**: 動的カテゴリーIDに対応

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず修正前のコードでバグを確認し（探索的テスト）、次に修正後のコードで正しい動作を検証する（修正確認テスト・保全確認テスト）。

### Exploratory Fault Condition Checking

**Goal**: 修正前のコードでバグを確認し、根本原因を特定する。

**Test Plan**: `visit_assignee`に値がある売主データを用意し、サイドバーに担当者別カテゴリーが表示されないことを確認する。

**Test Cases**:
1. **担当者カテゴリー未表示テスト**: `visit_assignee="Y"`の売主が存在する状態でサイドバーをレンダリングし、「担当（Y）」が表示されないことを確認（修正前は失敗する）
2. **サブカテゴリー未表示テスト**: `visit_assignee="Y"`かつ`next_call_date`が今日以前の売主が存在する状態で「当日TEL(Y)」が表示されないことを確認（修正前は失敗する）
3. **複数担当者テスト**: `visit_assignee="Y"`と`visit_assignee="I"`の売主が両方存在する状態で個別エントリーが表示されないことを確認（修正前は失敗する）

**Expected Counterexamples**:
- `renderAllCategories()`が担当者別カテゴリーを生成しないため、どの担当者イニシャルでも表示されない
- `StatusCategory`型が動的カテゴリーIDをサポートしていないため、型エラーが発生する可能性がある

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して期待される動作が実現されることを検証する。

**Pseudocode:**
```
FOR ALL sellers WHERE isBugCondition(sellers) DO
  assignees = getUniqueAssignees(sellers)
  FOR EACH assignee IN assignees DO
    ASSERT サイドバーに「担当（{assignee}）」が表示される
    IF isTodayCallAssigned条件を満たす売主が存在する THEN
      ASSERT 「担当（{assignee}）」の配下に「当日TEL({assignee})」が表示される
    END IF
  END FOR
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない入力（`visit_assignee`が空欄の売主）に対して、修正前と同一の動作が維持されることを検証する。

**Pseudocode:**
```
FOR ALL sellers WHERE NOT isBugCondition(sellers) DO
  ASSERT filterSellersByCategory_original(sellers, 'todayCall') 
       = filterSellersByCategory_fixed(sellers, 'todayCall')
  ASSERT filterSellersByCategory_original(sellers, 'todayCallWithInfo') 
       = filterSellersByCategory_fixed(sellers, 'todayCallWithInfo')
END FOR
```

**Testing Approach**: 既存のフィルター関数（`isTodayCall`、`isTodayCallWithInfo`など）は変更しないため、これらの関数の動作は自動的に保全される。修正前のコードで各カテゴリーの件数を記録し、修正後も同一の件数になることを確認する。

**Test Cases**:
1. **当日TEL分の保全**: `visit_assignee`が空欄の売主が「当日TEL分」に正しく分類されることを確認
2. **当日TEL（内容）の保全**: `visit_assignee`が空欄でコミュニケーション情報がある売主が「当日TEL（内容）」に正しく分類されることを確認
3. **フィルタリング動作の保全**: 既存カテゴリーをクリックした際に正しい売主がフィルタリングされることを確認

### Unit Tests

- `getUniqueAssignees`関数のテスト（空配列、単一担当者、複数担当者、「外す」を含む場合）
- `isVisitAssignedTo`関数のテスト（一致する場合、一致しない場合、空文字の場合）
- `isTodayCallAssignedTo`関数のテスト（担当者一致かつ次電日が今日以前、担当者一致だが次電日が未来）
- `filterSellersByCategory`の動的カテゴリーIDテスト（`visitAssigned:Y`、`todayCallAssigned:I`）

### Property-Based Tests

- ランダムな`visit_assignee`値を持つ売主データを生成し、`getUniqueAssignees`が重複なくイニシャルを返すことを検証
- ランダムな売主データで`filterSellersByCategory('visitAssigned:X')`が`visit_assignee="X"`の売主のみを返すことを検証
- 修正前後で`isTodayCall`、`isTodayCallWithInfo`の結果が変わらないことをランダムデータで検証

### Integration Tests

- `visit_assignee="Y"`の売主が存在する状態でサイドバーをレンダリングし、「担当（Y）」が表示されることを確認
- 「担当（Y）」をクリックすると`visit_assignee="Y"`の売主のみが表示されることを確認
- 「当日TEL(Y)」をクリックすると`visit_assignee="Y"`かつ次電日が今日以前の売主のみが表示されることを確認
- 「③当日TEL分」が引き続き`visit_assignee`が空欄の売主のみを表示することを確認
