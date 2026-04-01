# 営業担当「外す」有効値修正 Design

## Overview

営業担当フィールドに「外す」という値が入力されている場合、現在のシステムは「外す」を**空欄扱い**している。しかし、「外す」は「営業担当を外す」という明示的な指示であり、**有効な営業担当の値**として扱うべきである。

この修正により、営担が「外す」の売主が正しいサイドバーカテゴリ（訪問後他決）に分類されるようになる。

**修正箇所**:
1. GAS（gas_complete_code.js）- 695行目
2. バックエンド（EnhancedAutoSyncService.ts）- 797行目、1293行目、1594行目
3. バックエンド（SellerService.supabase.ts）- 1051行目、1099行目
4. フロントエンド（sellerStatusFilters.ts）- 203行目、678行目、922行目、938行目、989行目

## Glossary

- **Bug_Condition (C)**: 営業担当が「外す」の場合に発生するバグ条件
- **Property (P)**: 「外す」を有効な営業担当の値として扱う
- **Preservation**: 空欄（`''`）、`null`、有効なイニシャル（`'Y'`, `'I'`, `'K'`等）の扱いは変更しない
- **営担（visit_assignee）**: 営業担当フィールド（スプレッドシート・データベース共通）
- **isVisitAssigneeValid**: 営業担当が有効かどうかを判定する変数（GAS）
- **訪問後他決**: 営担ありの他決売主のサイドバーカテゴリ
- **未訪問他決**: 営担なしの他決売主のサイドバーカテゴリ

## Bug Details

### Bug Condition

営業担当が「外す」の場合、GAS、バックエンド、フロントエンドの全てで「外す」を**空欄扱い**している。これにより、営担が「外す」の売主が誤ったサイドバーカテゴリに分類される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SellerData
  OUTPUT: boolean
  
  RETURN input.visit_assignee = '外す'
         AND input.status IN ('他決→追客', '他決→追客不要', '一般→他決', '他社買取')
         AND input.next_call_date ≠ today
         AND input.exclusive_other_decision_meeting ≠ '完了'
         AND NOT isCorrectlyClassified(input)
END FUNCTION

FUNCTION isCorrectlyClassified(input)
  // 現在は「未訪問他決」に分類されている（バグ）
  // 正しくは「訪問後他決」に分類されるべき
  RETURN input.sidebar_category = '訪問後他決'
END FUNCTION
```

### Examples

**例1: AA9484（バグの具体例）**
- 営業担当: 「外す」
- 状況（当社）: 「他決→追客」
- 次電日: 今日ではない
- 専任他決打合せ: 「完了」ではない
- **現在の分類**: 「未訪問他決」（バグ）
- **期待される分類**: 「訪問後他決」（正しい）

**例2: 営担が空欄の売主**
- 営業担当: `''`（空欄）
- 状況（当社）: 「他決→追客」
- 次電日: 今日ではない
- 専任他決打合せ: 「完了」ではない
- **現在の分類**: 「未訪問他決」（正しい）
- **期待される分類**: 「未訪問他決」（変更なし）

**例3: 営担が有効なイニシャルの売主**
- 営業担当: 「Y」
- 状況（当社）: 「他決→追客」
- 次電日: 今日ではない
- 専任他決打合せ: 「完了」ではない
- **現在の分類**: 「訪問後他決」（正しい）
- **期待される分類**: 「訪問後他決」（変更なし）

**例4: 営担が「外す」で状況が他決以外の売主**
- 営業担当: 「外す」
- 状況（当社）: 「追客中」
- 次電日: 今日
- **現在の分類**: 「当日TEL分」（正しい）
- **期待される分類**: 「当日TEL分」（変更なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 空文字（`''`）は引き続き担当なしとして扱う
- `null` は引き続き担当なしとして扱う
- 有効なイニシャル（`'Y'`, `'I'`, `'K'`等）は引き続き有効な担当として扱う
- サイドバーカテゴリの他の条件（状況、次電日、専任他決打合せ等）は引き続き正しく判定される

**Scope:**
営業担当が「外す」以外の値（空欄、`null`、有効なイニシャル）の場合、全ての動作は完全に変更されない。これには以下が含まれる：
- 空欄の営担を持つ売主の分類
- `null` の営担を持つ売主の分類
- 有効なイニシャルの営担を持つ売主の分類
- サイドバーカテゴリの他の条件による分類

## Hypothesized Root Cause

営業担当「外す」が空欄扱いされている根本原因は、以下の3つの問題が重なっている：

1. **GASの判定ロジック**: `isVisitAssigneeValid` の判定で「外す」を明示的に除外している
   - 695行目: `visitAssignee !== '外す'` という条件が含まれている
   - これにより、「外す」は空欄と同じ扱いになる

2. **バックエンドの同期ロジック**: スプレッドシートからデータベースへの同期時に「外す」を `null` に変換している
   - 797行目: `rawSheetVisitAssignee === '外す'` の場合に `null` に変換
   - 1293行目、1594行目: `visitAssignee === '外す'` の場合に `null` に変換
   - これにより、データベースには「外す」が保存されない

3. **バックエンドのサイドバーカウント集計**: 営担が「外す」の売主を明示的に除外している
   - 1051行目、1099行目: `.neq('visit_assignee', '外す')` で除外
   - これにより、「外す」の売主がサイドバーカウントに含まれない

4. **フロントエンドのフィルタリングロジック**: 営担が「外す」の場合に `hasVisitAssignee()` が `false` を返す
   - 203行目: `visitAssignee.trim() === '外す'` の場合に `false` を返す
   - これにより、「外す」は担当なしとして扱われる

## Correctness Properties

Property 1: Bug Condition - 営業担当「外す」を有効な値として扱う

_For any_ 売主データ where 営業担当が「外す」の場合（isBugCondition returns true）、修正後のシステム SHALL 「外す」を有効な営業担当の値として扱い、営担ありの売主として分類する。具体的には、訪問後他決の条件を満たす場合、「訪問後他決」カテゴリに含まれる。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他の値の扱いは変更しない

_For any_ 売主データ where 営業担当が「外す」以外の値（空欄、`null`、有効なイニシャル）の場合（isBugCondition returns false）、修正後のシステム SHALL 修正前と全く同じ動作を保持し、空欄は担当なし、`null` は担当なし、有効なイニシャルは有効な担当として扱う。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `gas_complete_code.js`

**Function**: `updateSidebarCounts_`

**Specific Changes**:
1. **695行目の判定ロジックを修正**: `&& visitAssignee !== '外す'` を削除
   - 修正前: `var isVisitAssigneeValid = visitAssignee && visitAssignee !== '' && visitAssignee !== '外す';`
   - 修正後: `var isVisitAssigneeValid = visitAssignee && visitAssignee !== '';`

**File 2**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function**: `syncSingleSeller`, `updateSingleSeller`

**Specific Changes**:
1. **797行目の変換ロジックを修正**: `rawSheetVisitAssignee === '外す'` の条件を削除
   - 修正前: `const sheetVisitAssignee = (rawSheetVisitAssignee === '外す' || rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);`
   - 修正後: `const sheetVisitAssignee = (rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);`

2. **1293行目、1594行目の変換ロジックを修正**: `visitAssignee === '外す'` の条件を削除
   - 修正前: `if (visitAssignee === '外す' || visitAssignee === '') { updateData.visit_assignee = null; }`
   - 修正後: `if (visitAssignee === '') { updateData.visit_assignee = null; }`

**File 3**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getVisitOtherDecisionSellers`, `getUnvisitedOtherDecisionSellers`

**Specific Changes**:
1. **1051行目、1099行目の除外条件を削除**: `.neq('visit_assignee', '外す')` を削除
   - 修正前: `.neq('visit_assignee', '外す')`
   - 修正後: （この行を削除）

**File 4**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `hasVisitAssignee`, `isVisitOtherDecision`, `isUnvisitedOtherDecision`, `isExclusiveOtherDecision`, `isGeneralOtherDecision`

**Specific Changes**:
1. **203行目の判定ロジックを修正**: `|| visitAssignee.trim() === '外す'` を削除
   - 修正前: `if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') { return false; }`
   - 修正後: `if (!visitAssignee || visitAssignee.trim() === '') { return false; }`

2. **678行目、922行目、938行目、989行目の判定ロジックを修正**: `&& visitAssignee.trim() !== '外す'` を削除
   - 修正前: `if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') { ... }`
   - 修正後: `if (!visitAssignee || visitAssignee.trim() === '') { ... }`

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従う：まず、修正前のコードでバグを実証する反例を表面化させ、次に修正が正しく機能し、既存の動作を保持することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを実証する反例を表面化させる。根本原因分析を確認または反証する。反証した場合、再仮説が必要。

**Test Plan**: 営担が「外す」の売主をシミュレートし、サイドバーカテゴリが正しく分類されることをアサートするテストを書く。修正前のコードでこれらのテストを実行し、失敗を観察して根本原因を理解する。

**Test Cases**:
1. **AA9484テスト**: 営担が「外す」、状況が「他決→追客」、次電日が今日ではない、専任他決打合せが「完了」ではない売主をシミュレート（修正前のコードで失敗）
2. **GAS判定テスト**: `isVisitAssigneeValid` が「外す」の場合に `false` を返すことを確認（修正前のコードで失敗）
3. **バックエンド同期テスト**: 「外す」が `null` に変換されることを確認（修正前のコードで失敗）
4. **フロントエンドフィルタテスト**: `hasVisitAssignee()` が「外す」の場合に `false` を返すことを確認（修正前のコードで失敗）

**Expected Counterexamples**:
- 営担が「外す」の売主が「未訪問他決」に分類される（期待: 「訪問後他決」）
- Possible causes: GASの判定ロジック、バックエンドの同期ロジック、バックエンドのサイドバーカウント集計、フロントエンドのフィルタリングロジック

### Fix Checking

**Goal**: 営業担当が「外す」の全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := processVisitAssignee_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Expected Behavior:**
```
FUNCTION expectedBehavior(result)
  // 「外す」は有効な値として扱われる
  RETURN result.isValid = true
         AND result.value = '外す'
         AND result.sidebarCategory = '訪問後他決'  // 訪問後他決の条件を満たす場合
END FUNCTION
```

### Preservation Checking

**Goal**: 営業担当が「外す」以外の全ての入力に対して、修正後の関数が修正前の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT processVisitAssignee_original(input) = processVisitAssignee_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは保存チェックに推奨される。理由：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動の単体テストが見逃す可能性のあるエッジケースをキャッチする
- 全ての非バグ入力に対して動作が変更されていないという強力な保証を提供する

**Test Plan**: 修正前のコードで空欄、`null`、有効なイニシャルの動作を観察し、その動作をキャプチャするproperty-based testsを書く。

**Test Cases**:
1. **空欄保存テスト**: 営担が空欄（`''`）の売主が引き続き「未訪問他決」に分類されることを検証
2. **null保存テスト**: 営担が `null` の売主が引き続き「未訪問他決」に分類されることを検証
3. **有効なイニシャル保存テスト**: 営担が有効なイニシャル（`'Y'`, `'I'`, `'K'`等）の売主が引き続き「訪問後他決」に分類されることを検証
4. **他の条件保存テスト**: サイドバーカテゴリの他の条件（状況、次電日、専任他決打合せ等）が引き続き正しく判定されることを検証

### Unit Tests

- GASの `isVisitAssigneeValid` 判定ロジックをテスト（「外す」、空欄、有効なイニシャル）
- バックエンドの同期ロジックをテスト（「外す」が `null` に変換されないことを確認）
- バックエンドのサイドバーカウント集計をテスト（「外す」の売主が含まれることを確認）
- フロントエンドの `hasVisitAssignee()` をテスト（「外す」の場合に `true` を返すことを確認）

### Property-Based Tests

- ランダムな営業担当値を生成し、「外す」が有効な値として扱われることを検証
- ランダムな売主データを生成し、空欄、`null`、有効なイニシャルの動作が保存されることを検証
- 多くのシナリオで全ての非バグ入力が引き続き正しく動作することをテスト

### Integration Tests

- AA9484の売主データで完全なフローをテスト（GAS → バックエンド → フロントエンド）
- サイドバーカテゴリが正しく分類されることを確認（「訪問後他決」に含まれる）
- 空欄、`null`、有効なイニシャルの売主データで完全なフローをテスト（動作が変更されていないことを確認）
