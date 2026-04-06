# 買主リスト「業者問合せあり」誤表示バグ修正 Design

## Overview

買主リスト7260において、スプレッドシートの「業者向けアンケート」フィールドが「確認済み」になっているにもかかわらず、サイドバーに「業者問合せあり」として表示される問題を修正します。

この問題は、データベースの`broker_survey`フィールドとスプレッドシートの「業者向けアンケート」列の同期が正しく行われていないことが原因と推測されます。

## Glossary

- **Bug_Condition (C)**: スプレッドシートの「業者向けアンケート」が「確認済み」だが、データベースの`broker_survey`が「未」のままになっている状態
- **Property (P)**: スプレッドシートとデータベースの`broker_survey`フィールドが常に同期され、正しいステータスが表示される状態
- **Preservation**: 他の買主のステータス計算とサイドバー表示が影響を受けないこと
- **broker_survey**: データベースの`buyers`テーブルの列（業者向けアンケートの状態を保存）
- **BuyerStatusCalculator**: `backend/src/services/BuyerStatusCalculator.ts`の買主ステータス算出ロジック
- **GAS同期**: `gas_buyer_complete_code.js`のスプレッドシート→データベース同期処理

## Bug Details

### Bug Condition

バグは、スプレッドシートの「業者向けアンケート」列の値がデータベースの`broker_survey`フィールドに正しく同期されない場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type BuyerRecord
  OUTPUT: boolean
  
  RETURN spreadsheet.業者向けアンケート = "確認済み"
         AND database.broker_survey = "未"
         AND sidebar.status = "業者問合せあり"
END FUNCTION
```

### Examples

- **買主7260**: スプレッドシート「業者向けアンケート」= "確認済み"、データベース`broker_survey` = "未"（推測）、サイドバー表示 = "業者問合せあり"（誤り）
- **正常な買主**: スプレッドシート「業者向けアンケート」= "未"、データベース`broker_survey` = "未"、サイドバー表示 = "業者問合せあり"（正しい）
- **正常な買主**: スプレッドシート「業者向けアンケート」= "確認済み"、データベース`broker_survey` = "確認済み"、サイドバー表示 = 表示されない（正しい）
- **エッジケース**: スプレッドシート「業者向けアンケート」= 空欄、データベース`broker_survey` = null、サイドバー表示 = 表示されない（正しい）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `broker_survey = "未"`の買主は引き続き「業者問合せあり」カテゴリに表示される
- `broker_survey`が空欄の買主は引き続き「業者問合せあり」カテゴリに表示されない
- 他のサイドバーカテゴリ（「内覧日前日」「当日TEL」など）の表示ロジックは影響を受けない

**Scope:**
スプレッドシートの「業者向けアンケート」列以外のフィールドの同期は、この修正の影響を受けません。これには以下が含まれます：
- 次電日（★次電日）
- 最新状況（★最新状況）
- 業者問合せ（業者問合せ）← 「業者向けアンケート」とは別フィールド
- その他全てのフィールド

## Hypothesized Root Cause

バグ報告と過去の類似バグ（`buyer-vendor-survey-sync-bug`）の分析に基づき、最も可能性の高い原因は以下の通りです：

1. **GASのカラムマッピング不整合**: `gas_buyer_complete_code.js`の`BUYER_COLUMN_MAPPING`に「業者向けアンケート」→`broker_survey`のマッピングが存在しない、または誤っている
   - 過去に`vendor_survey`フィールドが使われていた可能性がある
   - `broker_survey`への移行が不完全だった可能性がある

2. **データ移行の不完全性**: 過去に`vendor_survey`から`broker_survey`へのデータ移行が行われたが、買主7260のデータが移行されなかった
   - `bulk-migrate-vendor-survey.ts`スクリプトが実行されたが、一部のデータが漏れた

3. **手動編集による不整合**: スプレッドシートで「業者向けアンケート」を「確認済み」に変更したが、GAS同期が実行されなかった、または同期時にエラーが発生した

4. **フィールド名の混同**: `broker_survey`と`vendor_survey`の2つのフィールドが存在し、スプレッドシートは`vendor_survey`に同期されているが、ステータス計算は`broker_survey`を参照している

## Correctness Properties

Property 1: Bug Condition - スプレッドシートとデータベースの同期

_For any_ 買主において、スプレッドシートの「業者向けアンケート」列の値が変更された場合、GAS同期実行後にデータベースの`broker_survey`フィールドは同じ値を持つべきである。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他の買主のステータス表示

_For any_ 買主において、`broker_survey`フィールドが正しく同期されている場合、修正前と修正後でサイドバーのステータス表示は同じであるべきである。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の仮説に基づき、以下の修正を実施します：

**Phase 1: 原因調査**

1. **買主7260のデータ確認**
   - スプレッドシートの「業者向けアンケート」列の値を確認
   - データベースの`broker_survey`フィールドの値を確認
   - データベースの`vendor_survey`フィールドの値を確認（存在する場合）

2. **GASカラムマッピング確認**
   - `gas_buyer_complete_code.js`の`BUYER_COLUMN_MAPPING`に「業者向けアンケート」→`broker_survey`のマッピングが存在するか確認
   - マッピングが正しいか確認

**Phase 2: 修正実施**

**ケース1: GASマッピングが存在しない場合**

**File**: `gas_buyer_complete_code.js`

**Function**: `BUYER_COLUMN_MAPPING`

**Specific Changes**:
1. **マッピング追加**: `BUYER_COLUMN_MAPPING`に以下を追加
   ```javascript
   '業者向けアンケート': 'broker_survey'
   ```

2. **GASデプロイ**: 修正したGASコードをスプレッドシートに紐づいたGASエディタにデプロイ

3. **手動同期実行**: `syncSingleBuyer('7260')`を実行して買主7260のデータを同期

**ケース2: データ移行が不完全な場合**

**File**: `backend/fix-7260-broker-survey.ts`（新規作成）

**Specific Changes**:
1. **データ移行スクリプト作成**: 買主7260の`vendor_survey`の値を`broker_survey`にコピーするスクリプトを作成
   ```typescript
   // vendor_surveyの値をbroker_surveyに移行
   if (buyer.vendor_survey && !buyer.broker_survey) {
     await supabase
       .from('buyers')
       .update({
         broker_survey: buyer.vendor_survey,
         vendor_survey: null,
       })
       .eq('buyer_number', '7260');
   }
   ```

2. **スクリプト実行**: `npx tsx backend/fix-7260-broker-survey.ts`を実行

**ケース3: 両方のフィールドが存在し、混同されている場合**

**File**: `backend/src/services/BuyerStatusCalculator.ts`

**Function**: `calculateBuyerStatus`

**Specific Changes**:
1. **フォールバック追加**: `broker_survey`が空の場合、`vendor_survey`を参照するロジックを追加（一時的な措置）
   ```typescript
   // Priority 2: 業者問合せあり
   const brokerSurveyValue = buyer.broker_survey || buyer.vendor_survey;
   if (equals(brokerSurveyValue, '未')) {
     const status = '業者問合せあり';
     return { status, priority: 2, matchedCondition: '業者向けアンケート = 未', color: getStatusColor(status) };
   }
   ```

2. **全買主のデータ移行**: `bulk-migrate-vendor-survey.ts`を再実行して全買主のデータを移行

3. **フォールバックロジック削除**: データ移行完了後、フォールバックロジックを削除

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正コードでバグを再現し（探索的バグ条件チェック）、次に修正後のコードで正しく動作することを検証します（修正チェック）。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認または反証する。反証された場合は、再仮説を立てる必要があります。

**Test Plan**: 買主7260のスプレッドシートデータとデータベースデータを比較し、不整合を確認します。未修正コードでステータス計算を実行し、「業者問合せあり」と誤って表示されることを確認します。

**Test Cases**:
1. **買主7260のデータ確認**: スプレッドシート「業者向けアンケート」= "確認済み"、データベース`broker_survey` = "未"（または`vendor_survey` = "未"）を確認（未修正コードで失敗）
2. **GASマッピング確認**: `BUYER_COLUMN_MAPPING`に「業者向けアンケート」→`broker_survey`のマッピングが存在しないことを確認（未修正コードで失敗）
3. **ステータス計算確認**: `calculateBuyerStatus({ broker_survey: '未' })`が「業者問合せあり」を返すことを確認（未修正コードで失敗）
4. **サイドバー表示確認**: 買主7260が「業者問合せあり」カテゴリに含まれることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- スプレッドシートとデータベースの`broker_survey`フィールドが不整合
- 可能性のある原因: GASマッピング不足、データ移行不完全、フィールド名混同

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して、期待される動作が実現されることを検証します。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  // スプレッドシートの「業者向けアンケート」を「確認済み」に変更
  spreadsheet.業者向けアンケート := "確認済み"
  
  // GAS同期を実行
  syncBuyer(buyer.buyer_number)
  
  // データベースの値を確認
  ASSERT database.broker_survey = "確認済み"
  
  // ステータス計算を実行
  status := calculateBuyerStatus(buyer)
  
  // サイドバーに「業者問合せあり」と表示されないことを確認
  ASSERT status != "業者問合せあり"
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正前と修正後で同じ結果が得られることを検証します。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  // 修正前のステータス計算
  status_before := calculateBuyerStatus_original(buyer)
  
  // 修正後のステータス計算
  status_after := calculateBuyerStatus_fixed(buyer)
  
  // 同じ結果が得られることを確認
  ASSERT status_before = status_after
END FOR
```

**Testing Approach**: プロパティベーステストは保全チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多数のテストケースを自動生成
- 手動ユニットテストでは見逃す可能性のあるエッジケースを検出
- 全ての非バグ入力に対して動作が変更されていないことを強力に保証

**Test Plan**: 未修正コードで`broker_survey = "未"`の買主が「業者問合せあり」と表示されることを観察し、修正後も同じ動作を維持することを検証します。

**Test Cases**:
1. **broker_survey = "未"の保全**: `broker_survey = "未"`の買主が引き続き「業者問合せあり」と表示されることを確認
2. **broker_survey = 空欄の保全**: `broker_survey`が空欄の買主が引き続き「業者問合せあり」と表示されないことを確認
3. **他のステータスの保全**: 「内覧日前日」「当日TEL」などの他のステータスが正しく表示されることを確認
4. **他のフィールドの同期保全**: 「業者向けアンケート」以外のフィールドの同期が影響を受けないことを確認

### Unit Tests

- 買主7260のデータ確認テスト（スプレッドシートとデータベースの比較）
- GASマッピング確認テスト（`BUYER_COLUMN_MAPPING`の存在確認）
- ステータス計算テスト（`broker_survey = "未"`→「業者問合せあり」）
- ステータス計算テスト（`broker_survey = "確認済み"`→「業者問合せあり」でない）

### Property-Based Tests

- 任意の`broker_survey`値に対して、スプレッドシートとデータベースが同期されることを検証
- 任意の買主に対して、修正前と修正後でステータス計算結果が同じであることを検証（バグ条件を満たさない場合）
- 多数のシナリオで他のフィールドの同期が影響を受けないことを検証

### Integration Tests

- 買主7260の完全な修正フロー（スプレッドシート編集→GAS同期→ステータス計算→サイドバー表示）
- 複数の買主に対する一括同期テスト
- サイドバーカテゴリのフィルタリングテスト（「業者問合せあり」カテゴリをクリックして正しい買主のみが表示されることを確認）
