# 売主訪問日・訪問時間形式修正 Bugfix Design

## Overview

売主AA13729を含む複数の売主で、訪問日（visit_date）と訪問時間（visit_time）が異常な形式で保存されており、訪問日前日カテゴリーに正しく表示されない問題を修正します。

**根本原因**:
- スプレッドシート → データベース同期時に、訪問日・訪問時間のパース処理が不適切
- 訪問日: `2026/04/04 1899/12/30` という異常な形式（日付が2つ連結）
- 訪問時間: `1899/12/30` という日付形式（時刻ではなく日付）
- **データベース構造の問題**: 日付と時間が別々のカラムに分かれているため、同期が複雑

**修正方針（オプション1: データベースをTIMESTAMP型に統一）**:
1. **データベース構造を変更**: `visit_date`をTIMESTAMP型に変更し、`visit_time`カラムを削除
2. **GAS同期処理を修正**: スプレッドシートの日付と時間を結合してTIMESTAMPとして保存
3. **バックエンドAPIを修正**: `visit_date`をTIMESTAMP型として扱う
4. **フロントエンドを修正**: `visit_date`から日付と時間を表示
5. **既存データをマイグレーション**: `visit_date`と`visit_time`を結合してTIMESTAMPに変換

## Glossary

- **Bug_Condition (C)**: スプレッドシートから訪問日・訪問時間を同期する際に、異常な形式でデータベースに保存される条件
- **Property (P)**: 訪問日時は `YYYY-MM-DD HH:MM:SS` 形式のTIMESTAMPで保存される
- **Preservation**: 訪問日時以外のフィールドの同期処理は変更しない
- **TIMESTAMP型**: PostgreSQLの日時型（日付と時刻を1つのカラムで管理）
- **formatVisitDateTime**: GASの訪問日時フォーマット関数（日付と時間を結合）
- **isVisitDayBefore**: フロントエンドの訪問日前日判定関数（`sellerStatusFilters.ts`）

## Bug Details

### Bug Condition

スプレッドシートから訪問日・訪問時間を同期する際、以下の条件で異常な形式がデータベースに保存されます。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SpreadsheetRow
  OUTPUT: boolean
  
  visitDateValue = input['訪問日 \nY/M/D']
  visitTimeValue = input['訪問時間']
  
  RETURN (visitDateValue IS NOT NULL AND visitDateValue CONTAINS ' ')
         OR (visitTimeValue IS NOT NULL AND visitTimeValue MATCHES '\d{4}/\d{2}/\d{2}')
END FUNCTION
```

### Examples

**訪問日の異常例**:
- スプレッドシート: `2026/04/04 1899/12/30`（日付が2つ連結）
- データベース: `2026-04-04 1899-12-30`（そのまま保存される）
- 期待値: `2026-04-04`（最初の日付のみ）

**訪問時間の異常例**:
- スプレッドシート: `1899/12/30`（日付形式）
- データベース: `1899-12-30`（日付として保存される）
- 期待値: `10:00`（時刻形式）

**正常例**:
- スプレッドシート訪問日: `2026/04/04`
- データベース訪問日: `2026-04-04`
- スプレッドシート訪問時間: `10:00`
- データベース訪問時間: `10:00`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 訪問日・訪問時間以外のフィールドの同期処理は変更しない
- 既に正しい形式で保存されているデータは維持する
- 訪問日前日カテゴリー以外のサイドバーカテゴリーの判定ロジックは変更しない

**Scope:**
訪問日・訪問時間以外のフィールド（名前、電話番号、査定額など）の同期処理は完全に変更しません。

## Hypothesized Root Cause

バグの根本原因を分析した結果、以下の問題が特定されました：

1. **訪問日のパース処理が不完全**
   - `formatVisitDate()` 関数は日付形式を正規化するが、スペースで区切られた複数の日付を処理していない
   - 例: `2026/04/04 1899/12/30` → 最初の日付のみを抽出すべきだが、現在は処理していない

2. **訪問時間のパース処理が存在しない**
   - `EnhancedAutoSyncService.ts` に訪問時間（visit_time）のパース処理が実装されていない
   - `ColumnMapper.ts` でも訪問時間の型変換が定義されていない
   - スプレッドシートの値がそのままデータベースに保存される

3. **Excelシリアル値の誤変換**
   - スプレッドシートの時刻セルがExcelシリアル値（例: `0.4166666667`）で取得される場合がある
   - これを日付として変換すると `1899/12/30` になる（Excelの基準日）
   - 時刻として変換すべきだが、現在は日付として処理している

4. **フロントエンドの防御的プログラミング不足**
   - `isVisitDayBefore()` 関数は訪問日が正しい形式であることを前提としている
   - 異常な形式のデータに対する検証がない

## Correctness Properties

Property 1: Bug Condition - 訪問日・訪問時間の正しい形式での保存

_For any_ スプレッドシートの行データで訪問日または訪問時間に値が含まれる場合、修正後の同期処理は訪問日を `YYYY/MM/DD` 形式、訪問時間を `HH:MM` 形式でデータベースに保存する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 訪問日・訪問時間以外のフィールドの同期処理

_For any_ スプレッドシートの行データで訪問日・訪問時間以外のフィールドを同期する場合、修正後の同期処理は既存の同期ロジックを変更せず、同じ結果を生成する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の5つの修正を実施します：

**File 1**: データベースマイグレーション

**Script**: `backend/migrations/migrate-visit-date-to-timestamp.sql`

**Specific Changes**:
1. **visit_timeカラムを削除**
   ```sql
   ALTER TABLE sellers DROP COLUMN IF EXISTS visit_time;
   ```

2. **visit_dateをTIMESTAMP型に変更**
   ```sql
   ALTER TABLE sellers ALTER COLUMN visit_date TYPE TIMESTAMP USING visit_date::timestamp;
   ```

3. **既存データを移行**
   - `visit_date`と`visit_time`を結合してTIMESTAMPに変換
   - 例: `visit_date='2026-04-04'`, `visit_time='10:00'` → `visit_date='2026-04-04 10:00:00'`

**File 2**: `gas_complete_code.js`

**Function**: `syncUpdatesToSupabase_()`

**Specific Changes**:
1. **訪問日時を結合してTIMESTAMPとして保存**
   ```javascript
   // 訪問日と訪問時間を結合
   const visitDate = row['訪問日 Y/M/D'];  // 2026/04/04
   const visitTime = row['訪問時間'];      // Date object: Sat Dec 30 1899 10:00:00
   
   if (visitDate) {
     let visitDateTime = visitDate;  // 2026/04/04
     
     // 訪問時間がDate型の場合、時刻を抽出
     if (visitTime instanceof Date) {
       const hours = visitTime.getHours();
       const minutes = visitTime.getMinutes();
       visitDateTime += ' ' + hours + ':' + minutes + ':00';  // 2026/04/04 10:00:00
     }
     
     updateData.visit_date = visitDateTime;
   }
   
   // visit_timeは削除（もう使わない）
   ```

**File 3**: `backend/src/services/SellerService.supabase.ts`

**Function**: `decryptSeller()`

**Specific Changes**:
1. **visit_dateをTIMESTAMP型として扱う**
   ```typescript
   visitDate: seller.visit_date,  // TIMESTAMP型（例: 2026-04-04 10:00:00）
   // visitTimeは削除
   ```

2. **フロントエンドに返すデータ形式を調整**
   - `visitDate`: ISO 8601形式（例: `2026-04-04T10:00:00.000Z`）

**File 4**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `isVisitDayBefore()`

**Specific Changes**:
1. **visit_dateから日付部分のみを抽出**
   ```typescript
   const visitDate = seller.visitDate?.split('T')[0];  // 2026-04-04
   ```

2. **訪問日前日判定ロジックは変更なし**

**File 5**: `frontend/frontend/src/pages/CallModePage.tsx`

**Component**: 訪問予定日時表示

**Specific Changes**:
1. **visit_dateから日付と時刻を表示**
   ```typescript
   const visitDateTime = seller.visitDate 
     ? new Date(seller.visitDate).toLocaleString('ja-JP', {
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit'
       })
     : '';
   // 例: 2026/04/04 10:00
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正コードでバグを再現する探索的テストを実行し、次に修正後のコードで正しく動作することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は再分析が必要。

**Test Plan**: 異常な形式の訪問日・訪問時間を含むテストデータを作成し、未修正コードで同期を実行して、データベースに異常な形式で保存されることを確認する。

**Test Cases**:
1. **訪問日スペース区切りテスト**: `2026/04/04 1899/12/30` → データベースに `2026-04-04 1899-12-30` として保存される（未修正コードで失敗）
2. **訪問時間日付形式テスト**: `1899/12/30` → データベースに `1899-12-30` として保存される（未修正コードで失敗）
3. **訪問時間Excelシリアル値テスト**: `0.4166666667` → データベースに `1899-12-30` として保存される（未修正コードで失敗）
4. **訪問日前日判定テスト**: 異常な形式の訪問日を持つ売主が訪問日前日カテゴリーに表示されない（未修正コードで失敗）

**Expected Counterexamples**:
- 訪問日にスペースが含まれる場合、2つの日付が連結されて保存される
- 訪問時間が日付形式で保存される
- 訪問日前日判定が正しく動作しない

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := syncSingleSeller_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. **訪問日スペース区切り修正テスト**: `2026/04/04 1899/12/30` → データベースに `2026-04-04` として保存される
2. **訪問時間日付形式修正テスト**: `1899/12/30` → データベースに `null` として保存される
3. **訪問時間Excelシリアル値修正テスト**: `0.4166666667` → データベースに `10:00` として保存される
4. **訪問日前日判定修正テスト**: 修正後の訪問日を持つ売主が訪問日前日カテゴリーに正しく表示される

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncSingleSeller_original(input) = syncSingleSeller_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは、入力ドメイン全体で多くのテストケースを自動生成するため、保存チェックに推奨されます。

**Test Plan**: 正常な形式の訪問日・訪問時間を持つ売主データで、未修正コードと修正後コードの動作が同じであることを確認する。

**Test Cases**:
1. **正常な訪問日保存テスト**: `2026/04/04` → データベースに `2026-04-04` として保存される（修正前後で同じ）
2. **正常な訪問時間保存テスト**: `10:00` → データベースに `10:00` として保存される（修正前後で同じ）
3. **訪問日なし保存テスト**: 訪問日が空の場合、`null` として保存される（修正前後で同じ）
4. **他のフィールド保存テスト**: 名前、電話番号、査定額などのフィールドが正しく保存される（修正前後で同じ）

### Unit Tests

- 訪問日のスペース区切り処理をテスト
- 訪問時間のExcelシリアル値変換をテスト
- 訪問時間の日付形式除外をテスト
- 訪問日前日判定の形式検証をテスト

### Property-Based Tests

- ランダムな訪問日・訪問時間を生成して、正しい形式で保存されることを検証
- ランダムな売主データを生成して、訪問日・訪問時間以外のフィールドが保存されることを検証
- 多くのシナリオで訪問日前日判定が正しく動作することをテスト

### Integration Tests

- スプレッドシートから訪問日・訪問時間を同期する完全なフローをテスト
- マイグレーションスクリプトで既存データを修正するフローをテスト
- フロントエンドで訪問日前日カテゴリーが正しく表示されることをテスト
