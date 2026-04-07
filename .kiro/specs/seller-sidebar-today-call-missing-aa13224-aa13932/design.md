# 売主サイドバー「当日TEL」カテゴリ表示不具合修正 設計書

## Overview

売主リストのサイドバーにおいて、AA13224とAA13932が「当日TEL」カテゴリに表示されない問題を修正します。

調査の結果、`seller_sidebar_counts`テーブルが古いデータを保持していることが根本原因であることが判明しました。このテーブルはGAS（Google Apps Script）によって10分ごとに更新されますが、古いロジックまたは不完全なデータで更新される可能性があります。

修正方針として、`seller_sidebar_counts`テーブルを完全に削除し、`getSidebarCountsFallback()`メソッドを常に使用するようにします。このメソッドは既に正しいロジックを実装しており、データベースから直接最新のデータを取得してカウントを計算します。

## Glossary

- **Bug_Condition (C)**: `seller_sidebar_counts`テーブルが古いデータを保持している状態
- **Property (P)**: 「当日TEL」カテゴリの条件を満たす全ての売主が正しく表示される
- **Preservation**: 他のサイドバーカテゴリの表示とカウントが正しく維持される
- **getSidebarCounts()**: `backend/src/services/SellerService.supabase.ts`のメソッド。`seller_sidebar_counts`テーブルからカウントを取得し、テーブルが空の場合は`getSidebarCountsFallback()`にフォールバックする
- **getSidebarCountsFallback()**: `backend/src/services/SellerService.supabase.ts`のメソッド。データベースから直接クエリしてサイドバーカウントを計算する（正しいロジックを実装済み）
- **seller_sidebar_counts**: Supabaseのキャッシュテーブル。GASが10分ごとに更新する
- **当日TEL**: 次電日が今日以前、コミュニケーション情報が空、営業担当が空、ステータスが「追客中」または「他決→追客」の売主カテゴリ

## Bug Details

### Bug Condition

バグは、`seller_sidebar_counts`テーブルが古いデータを保持している場合に発生します。このテーブルはGASによって10分ごとに更新されますが、以下の理由で古いデータが残る可能性があります：

1. GASの同期ロジックが古い
2. GASの実行が失敗している
3. データベースの最新状態が反映されていない

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { seller_sidebar_counts_table: Table, sellers_table: Table }
  OUTPUT: boolean
  
  RETURN seller_sidebar_counts_table.todayCall != 
         COUNT(sellers WHERE 
           status IN ['追客中', '他決→追客'] AND
           next_call_date <= TODAY AND
           visit_assignee IS NULL OR visit_assignee = '' OR visit_assignee = '外す' AND
           phone_contact_person IS NULL OR phone_contact_person = '' AND
           preferred_contact_time IS NULL OR preferred_contact_time = '' AND
           contact_method IS NULL OR contact_method = ''
         )
END FUNCTION
```

### Examples

- **AA13224**: status="他決→追客", next_call_date="2026-04-07", visit_assignee=null, コミュニケーション情報=空 → 「当日TEL」に表示されるべきだが、表示されない
- **AA13932**: status="追客中", next_call_date="2026-04-06", visit_assignee=null, コミュニケーション情報=空 → 「当日TEL」に表示されるべきだが、表示されない
- **seller_sidebar_countsテーブル**: todayCall=21件（更新日時: 2026-04-07T02:33:49） → 実際の条件を満たす売主数（23件以上）と一致しない
- **getSidebarCountsFallback()**: 正しいロジックで23件以上を計算する → 期待される動作

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリ（「訪問日前日」「訪問済み」「未査定」「査定（郵送）」「当日TEL_未着手」「Pinrich空欄」「専任」「一般」「訪問後他決」「未訪問他決」）のカウントと表示が正しく維持される
- `getSidebarCountsFallback()`メソッドの既存のロジック（「追客中」をilike検索、「他決→追客」を完全一致検索、両方をマージ）が維持される
- サイドバーのフィルタリング機能が正しく動作し続ける

**Scope:**
`seller_sidebar_counts`テーブルを削除しても、`getSidebarCounts()`メソッドは自動的に`getSidebarCountsFallback()`にフォールバックするため、全ての機能が正常に動作し続けます。

## Hypothesized Root Cause

調査の結果、以下の根本原因が特定されました：

1. **seller_sidebar_countsテーブルの古いデータ**: テーブルのtodayCallカウントが21件（更新日時: 2026-04-07T02:33:49）だが、実際の条件を満たす売主数は23件以上

2. **GASの同期ロジックの問題**: GASが10分ごとに`seller_sidebar_counts`テーブルを更新するが、古いロジックまたは不完全なデータで更新される可能性がある

3. **getSidebarCountsFallback()は正しい**: このメソッドは既に正しいロジックを実装しており、「追客中」と「他決→追客」の両方のステータスを正しく取得する

4. **キャッシュテーブルの不要性**: `getSidebarCountsFallback()`は60秒のメモリキャッシュを使用しており、パフォーマンスも十分。`seller_sidebar_counts`テーブルは不要

## Correctness Properties

Property 1: Bug Condition - 当日TELカテゴリの正確な表示

_For any_ 売主データの状態において、「当日TEL」カテゴリの条件を満たす全ての売主（AA13224、AA13932を含む）が、修正後のシステムでは正しくサイドバーに表示され、カウントが正確に計算される。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他のカテゴリの表示維持

_For any_ サイドバーカテゴリにおいて、「当日TEL」以外のカテゴリ（「訪問日前日」「訪問済み」「未査定」など）は、修正後も修正前と同じカウントと表示を維持し、既存の機能が正しく動作し続ける。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

修正方針：`seller_sidebar_counts`テーブルを削除して、`getSidebarCountsFallback()`を常に使用する。

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSidebarCounts()`

**Specific Changes**:
1. **getSidebarCounts()メソッドの修正**: `seller_sidebar_counts`テーブルからの取得を削除し、直接`getSidebarCountsFallback()`を呼び出すように変更
   - 現在のコード: `seller_sidebar_counts`テーブルから取得 → 失敗時に`getSidebarCountsFallback()`にフォールバック
   - 修正後のコード: 常に`getSidebarCountsFallback()`を呼び出す

2. **seller_sidebar_countsテーブルの削除**: Supabaseから`seller_sidebar_counts`テーブルを削除
   - SQLコマンド: `DROP TABLE IF EXISTS seller_sidebar_counts;`

3. **GASの同期ロジックの削除**: `gas_complete_code.js`の`updateSidebarCounts_()`関数を削除または無効化
   - この関数は`seller_sidebar_counts`テーブルを更新するが、テーブルを削除するため不要になる

4. **コメントの追加**: `getSidebarCounts()`メソッドに、なぜ`getSidebarCountsFallback()`を直接呼び出すかの説明コメントを追加

5. **パフォーマンスの確認**: `getSidebarCountsFallback()`は60秒のメモリキャッシュを使用しているため、パフォーマンスは十分

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正のコードでバグを実証する反例を表面化させ、次に修正が正しく機能し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正のコードでバグを実証する反例を表面化させる。根本原因分析を確認または反証する。反証した場合は、再仮説が必要。

**Test Plan**: `seller_sidebar_counts`テーブルの現在のデータと、`getSidebarCountsFallback()`が計算する正しいカウントを比較するテストを作成。未修正のコードで実行して、不一致を観察し、根本原因を理解する。

**Test Cases**:
1. **seller_sidebar_countsテーブルの確認**: テーブルのtodayCallカウントを取得（未修正のコードで失敗する - 21件）
2. **getSidebarCountsFallback()の確認**: 正しいカウントを計算（未修正のコードで成功する - 23件以上）
3. **AA13224の確認**: 「当日TEL」カテゴリの条件を満たすか確認（未修正のコードで表示されない）
4. **AA13932の確認**: 「当日TEL」カテゴリの条件を満たすか確認（未修正のコードで表示されない）

**Expected Counterexamples**:
- `seller_sidebar_counts`テーブルのtodayCallカウント（21件）と、`getSidebarCountsFallback()`が計算する正しいカウント（23件以上）が一致しない
- 可能な原因: GASの同期ロジックが古い、GASの実行が失敗している、データベースの最新状態が反映されていない

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getSidebarCounts_fixed()
  ASSERT result.todayCall == COUNT(sellers WHERE 
    status IN ['追客中', '他決→追客'] AND
    next_call_date <= TODAY AND
    visit_assignee IS NULL OR visit_assignee = '' OR visit_assignee = '外す' AND
    phone_contact_person IS NULL OR phone_contact_person = '' AND
    preferred_contact_time IS NULL OR preferred_contact_time = '' AND
    contact_method IS NULL OR contact_method = ''
  )
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL category WHERE category != 'todayCall' DO
  ASSERT getSidebarCounts_original()[category] = getSidebarCounts_fixed()[category]
END FOR
```

**Testing Approach**: 保存チェックにはプロパティベーステストが推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動のユニットテストでは見逃す可能性のあるエッジケースをキャッチする
- 全ての非バグ入力に対して動作が変更されていないという強力な保証を提供する

**Test Plan**: まず未修正のコードで他のカテゴリの動作を観察し、次にその動作をキャプチャするプロパティベーステストを作成する。

**Test Cases**:
1. **訪問日前日カテゴリの保存**: 未修正のコードで訪問日前日カテゴリが正しく動作することを観察し、修正後も継続することを検証するテストを作成
2. **訪問済みカテゴリの保存**: 未修正のコードで訪問済みカテゴリが正しく動作することを観察し、修正後も継続することを検証するテストを作成
3. **未査定カテゴリの保存**: 未修正のコードで未査定カテゴリが正しく動作することを観察し、修正後も継続することを検証するテストを作成
4. **他の全カテゴリの保存**: 未修正のコードで他の全カテゴリが正しく動作することを観察し、修正後も継続することを検証するテストを作成

### Unit Tests

- `getSidebarCounts()`が`getSidebarCountsFallback()`を直接呼び出すことをテスト
- `getSidebarCountsFallback()`が「追客中」と「他決→追客」の両方のステータスを正しく取得することをテスト
- AA13224とAA13932が「当日TEL」カテゴリの条件を満たすことをテスト
- 他のサイドバーカテゴリのカウントが正しく計算されることをテスト

### Property-Based Tests

- ランダムな売主データを生成し、「当日TEL」カテゴリのカウントが正しく計算されることを検証
- ランダムなサイドバーカテゴリを生成し、修正前後でカウントが一致することを検証（「当日TEL」以外）
- 多くのシナリオで全てのカテゴリが正しく動作することをテスト

### Integration Tests

- 売主リストページを開き、サイドバーに「当日TEL」カテゴリが正しく表示されることをテスト
- AA13224とAA13932が「当日TEL」カテゴリに表示されることをテスト
- 他のサイドバーカテゴリが正しく表示されることをテスト
- サイドバーのフィルタリング機能が正しく動作することをテスト
