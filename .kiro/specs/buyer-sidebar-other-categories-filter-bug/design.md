# 買主サイドバー「内覧済み」「担当」カテゴリフィルタ不具合修正 Design

## Overview

買主リストページのサイドバーで「②内覧済み」「担当(Y)」などのカテゴリをクリックしても、「買主データが見つかりませんでした」と表示される問題を修正します。

サイドバーのカウント表示は正しく動作しており（例：内覧済み 1546件、担当(Y) 210件）、データベースにも該当する買主が存在しますが、`BuyerStatusCalculator.calculateBuyerStatus()`が優先度の高いステータス（査定アンケート、業者問合せ、内覧日前日など）のみを返し、「内覧済み」「担当」などの基本カテゴリのステータスを返していないことが根本原因です。

修正方針は、`BuyerStatusCalculator.ts`の`calculateBuyerStatusComplete()`関数に、優先度の低い基本カテゴリのステータス判定ロジックを追加することです。フロントエンドのフィルタリングロジックは既に正しく実装されているため、バックエンドの修正のみで解決できます。

## Glossary

- **Bug_Condition (C)**: `BuyerStatusCalculator.calculateBuyerStatus()`が優先度の高いステータスに該当しない買主に対して空文字列を返す条件
- **Property (P)**: 優先度の高いステータスに該当しない買主に対して「内覧済み」「担当(イニシャル)」などの基本カテゴリのステータスを返すべき動作
- **Preservation**: 優先度の高いステータス（査定アンケート、業者問合せ、内覧日前日など）の判定ロジックと、既存のフィルタリング・検索機能
- **`calculateBuyerStatus()`**: `backend/src/services/BuyerStatusCalculator.ts`の関数で、買主のステータスを優先度順に判定する
- **`calculateBuyerStatusComplete()`**: `calculateBuyerStatus()`から呼び出される関数で、優先度16以降のステータスを判定する
- **`calculated_status`**: データベースの`buyers`テーブルに保存される買主のステータス文字列（例：「内覧済み」「担当(Y)」）

## Bug Details

### Bug Condition

バグは、`BuyerStatusCalculator.calculateBuyerStatus()`が優先度の高いステータス（Priority 1-15）に該当しない買主に対して、基本カテゴリのステータス（「内覧済み」「担当(イニシャル)」など）を返さず、空文字列を返す場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type BuyerData
  OUTPUT: boolean
  
  // 優先度の高いステータス（Priority 1-15）に該当しない
  highPriorityStatus := calculateBuyerStatus(buyer).priority IN [1..15]
  
  // 内覧済みの条件を満たす
  isVisitCompleted := buyer.viewing_date IS NOT NULL 
                      AND buyer.viewing_date < TODAY
  
  // 担当の条件を満たす
  hasAssignee := buyer.follow_up_assignee IS NOT NULL 
                 AND buyer.follow_up_assignee != ''
  
  // バグ条件：優先度の高いステータスに該当せず、かつ基本カテゴリの条件を満たすが、空文字列が返される
  RETURN NOT highPriorityStatus 
         AND (isVisitCompleted OR hasAssignee)
         AND calculateBuyerStatus(buyer).status == ''
END FUNCTION
```

### Examples

- **買主7282**: `viewing_date = 2026-04-03`（過去）、`follow_up_assignee = 'Y'`、優先度の高いステータスに該当しない → `calculated_status = ''`（空文字列）が返される → 「②内覧済み」カテゴリで表示されない
- **買主5641**: `viewing_date = 2026-04-05`（過去）、`follow_up_assignee = '林'`、優先度の高いステータスに該当しない → `calculated_status = ''`（空文字列）が返される → 「担当(林)」カテゴリで表示されない
- **買主1234**: `viewing_date = NULL`、`follow_up_assignee = 'Y'`、優先度の高いステータスに該当しない → `calculated_status = ''`（空文字列）が返される → 「担当(Y)」カテゴリで表示されない
- **買主5678**: `viewing_date = 2026-04-10`（未来）、`follow_up_assignee = NULL`、優先度の高いステータスに該当しない → `calculated_status = ''`（空文字列）が返される → どのカテゴリにも表示されない（期待される動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 優先度の高いステータス（査定アンケート、業者問合せ、内覧日前日など、Priority 1-15）の判定ロジックは変更しない
- 既存のフィルタリング機能（買主番号、氏名、電話番号での検索）は変更しない
- 既存のページネーション機能は変更しない
- サイドバーのカウント表示ロジックは変更しない

**Scope:**
優先度の高いステータス（Priority 1-15）に該当する買主、または基本カテゴリの条件を満たさない買主（内覧日が未来、担当者なし）は、この修正の影響を受けません。

## Hypothesized Root Cause

Bugfix Requirementsドキュメントと現在の実装を分析した結果、最も可能性が高い原因は以下の通りです：

1. **基本カテゴリのステータス判定ロジックが不足**
   - `calculateBuyerStatusComplete()`関数は、Priority 16-35のステータス判定ロジックを実装している
   - しかし、「内覧済み」「担当(イニシャル)」などの基本カテゴリのステータス判定ロジックが実装されていない
   - Priority 23-30で担当者別のステータスを返しているが、これは`follow_up_assignee`が存在する場合のみ
   - 「内覧済み」カテゴリのステータス判定ロジックが完全に欠落している

2. **優先度の設定が不適切**
   - 「内覧済み」「担当(イニシャル)」は最も優先度が低い基本カテゴリであるべき
   - しかし、現在の実装では、Priority 35（メアド確認必要）の後に何も判定ロジックがない
   - そのため、基本カテゴリの条件を満たす買主が空文字列を返される

3. **フロントエンドのフィルタリングロジックは正しい**
   - フロントエンドは`calculated_status`が「内覧済み」「担当(Y)」などの文字列であることを期待している
   - サイドバーのカウント表示は正しく動作しているため、フロントエンドのロジックは正しい
   - バックエンドが正しいステータスを返せば、フロントエンドは正しく動作する

## Correctness Properties

Property 1: Bug Condition - 基本カテゴリのステータス判定

_For any_ 買主データで、優先度の高いステータス（Priority 1-35）に該当せず、かつ内覧日が過去の日付である場合、修正後の`calculateBuyerStatus()`関数は「内覧済み(イニシャル)」ステータスを返す。また、優先度の高いステータスに該当せず、かつ担当者（`follow_up_assignee`）が存在する場合、「担当(イニシャル)」ステータスを返す。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 優先度の高いステータスの判定

_For any_ 買主データで、優先度の高いステータス（Priority 1-15）の条件を満たす場合、修正後の`calculateBuyerStatus()`関数は、修正前と同じステータスを返す。既存のフィルタリング機能、検索機能、ページネーション機能も変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると、以下の変更が必要です：

**File**: `backend/src/services/BuyerStatusCalculator.ts`

**Function**: `calculateBuyerStatusComplete()`

**Specific Changes**:

1. **Priority 36: 内覧済み(イニシャル)の判定ロジックを追加**
   - 条件: `viewing_date`が過去の日付 かつ `follow_up_assignee`が存在する
   - ステータス: `内覧済み(イニシャル)`（例：`内覧済み(Y)`、`内覧済み(林)`）
   - 優先度: 36（Priority 35の後）

2. **Priority 37: 担当(イニシャル)の判定ロジックを追加**
   - 条件: `follow_up_assignee`が存在する（内覧日の有無に関係なく）
   - ステータス: `担当(イニシャル)`（例：`担当(Y)`、`担当(林)`）
   - 優先度: 37（Priority 36の後）
   - 注意: Priority 23-30の担当者別ステータスと重複しないように、Priority 23-30に該当しない場合のみ適用

3. **Priority 38: 内覧済みの判定ロジックを追加**
   - 条件: `viewing_date`が過去の日付 かつ `follow_up_assignee`が存在しない
   - ステータス: `内覧済み`
   - 優先度: 38（Priority 37の後）

4. **デバッグログの追加**
   - 各判定ロジックで、条件を満たした場合にログを出力
   - 例: `console.log('[calculateBuyerStatusComplete] Priority 36: 内覧済み(Y) for buyer:', buyer.buyer_number);`

5. **エラーハンドリングの強化**
   - 既存のtry-catchブロックを維持
   - エラーが発生した場合、買主番号とエラー詳細をログに出力

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する探索的テストを実行し、次に修正後のコードで正しい動作を検証するテストを実行します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は、再度仮説を立てる必要があります。

**Test Plan**: 優先度の高いステータスに該当しない買主データ（内覧日が過去、担当者あり）を用意し、`calculateBuyerStatus()`を呼び出して、空文字列が返されることを確認します。修正前のコードで実行します。

**Test Cases**:
1. **内覧済み(Y)テスト**: `viewing_date = 2026-04-03`（過去）、`follow_up_assignee = 'Y'`、優先度の高いステータスに該当しない → `calculated_status = ''`が返される（修正前のコードで失敗）
2. **担当(林)テスト**: `viewing_date = NULL`、`follow_up_assignee = '林'`、優先度の高いステータスに該当しない → `calculated_status = ''`が返される（修正前のコードで失敗）
3. **内覧済みテスト**: `viewing_date = 2026-04-03`（過去）、`follow_up_assignee = NULL`、優先度の高いステータスに該当しない → `calculated_status = ''`が返される（修正前のコードで失敗）
4. **エッジケース: 内覧日が未来**: `viewing_date = 2026-04-10`（未来）、`follow_up_assignee = 'Y'` → `calculated_status = '担当(Y)'`が返される（修正前のコードで失敗する可能性）

**Expected Counterexamples**:
- `calculateBuyerStatus()`が空文字列を返す
- 可能性のある原因: 基本カテゴリのステータス判定ロジックが不足、優先度の設定が不適切

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての買主データに対して、正しいステータスが返されることを検証します。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := calculateBuyerStatus_fixed(buyer)
  ASSERT result.status IN ['内覧済み(Y)', '内覧済み(林)', '担当(Y)', '担当(林)', '内覧済み']
  ASSERT result.status != ''
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない全ての買主データに対して、修正前と同じステータスが返されることを検証します。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT calculateBuyerStatus_original(buyer).status = calculateBuyerStatus_fixed(buyer).status
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動のユニットテストでは見逃す可能性のあるエッジケースを検出する
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: まず、修正前のコードで優先度の高いステータス（Priority 1-15）の動作を観察し、次にその動作を捕捉するproperty-based testを作成します。

**Test Cases**:
1. **査定アンケート回答ありの保存**: 修正前のコードで`valuation_survey`が非空、`valuation_survey_confirmed`が空の買主が「査定アンケート回答あり」ステータスを返すことを観察し、修正後も同じステータスを返すことを検証
2. **業者問合せありの保存**: 修正前のコードで`vendor_survey = '未'`の買主が「業者問合せあり」ステータスを返すことを観察し、修正後も同じステータスを返すことを検証
3. **内覧日前日の保存**: 修正前のコードで内覧日が明日（または木曜日の場合は2日後）の買主が「内覧日前日」ステータスを返すことを観察し、修正後も同じステータスを返すことを検証
4. **フィルタリング・検索機能の保存**: 修正前のコードで買主番号、氏名、電話番号での検索が正しく動作することを観察し、修正後も同じ動作を検証

### Unit Tests

- 各基本カテゴリのステータス判定ロジックをテスト（内覧済み(Y)、担当(林)、内覧済み）
- エッジケース（内覧日が未来、担当者なし、内覧日と担当者の両方なし）をテスト
- 優先度の高いステータスが正しく優先されることをテスト

### Property-Based Tests

- ランダムな買主データを生成し、基本カテゴリのステータスが正しく返されることを検証
- ランダムな買主データを生成し、優先度の高いステータスの動作が保存されることを検証
- 多くのシナリオで、フィルタリング・検索機能が正しく動作することをテスト

### Integration Tests

- 買主リストページで「②内覧済み」カテゴリをクリックし、内覧済みの買主が表示されることをテスト
- 買主リストページで「担当(Y)」カテゴリをクリックし、担当Yの買主が表示されることをテスト
- 買主リストページで「担当(林)」カテゴリをクリックし、担当林の買主が表示されることをテスト
- サイドバーのカウント表示と一覧表示の件数が一致することをテスト
