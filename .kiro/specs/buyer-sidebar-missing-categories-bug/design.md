# 買主リストサイドバー欠落カテゴリ修正 Bugfix Design

## Overview

買主リストサイドバーに「①内覧日前日」と「すべて」しか表示されない問題を修正します。根本原因は、GASコード（`gas_buyer_complete_code.js`）の`updateBuyerSidebarCounts_()`関数が一部のカテゴリ（4種類）しか計算・挿入していないため、`buyer_sidebar_counts`テーブルに欠落カテゴリのデータが存在せず、フロントエンドで表示できないことです。

売主GASコード（`gas_complete_code.js`）には全カテゴリの完全な実装があるため、それを参考に買主用のカテゴリ計算ロジックを実装します。

## Glossary

- **Bug_Condition (C)**: GASの`updateBuyerSidebarCounts_()`関数が実行されるが、一部のカテゴリ（4種類）しか計算・挿入しない状態
- **Property (P)**: GASの`updateBuyerSidebarCounts_()`関数が実行されると、全カテゴリ（12種類以上）を計算して`buyer_sidebar_counts`テーブルに挿入する
- **Preservation**: 既存の4種類のカテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）の計算ロジックは変更しない
- **`updateBuyerSidebarCounts_()`**: `gas_buyer_complete_code.js`の関数で、買主サイドバーカウントを計算して`buyer_sidebar_counts`テーブルに挿入する
- **`buyer_sidebar_counts`**: 買主サイドバーカウントを保存するSupabaseテーブル（主キー: `category`, `label`, `assignee`）
- **GAS（Google Apps Script）**: Google スプレッドシートに紐づいたスクリプトで、10分ごとに実行される

## Bug Details

### Bug Condition

バグは、GASの`updateBuyerSidebarCounts_()`関数が実行されるが、以下の4種類のカテゴリしか計算・挿入しない場合に発生します：

1. `viewingDayBefore`（内覧日前日）
2. `todayCall`（当日TEL分）
3. `inquiryEmailNotResponded`（問合せメール未対応）
4. `assigned`（担当別）

その結果、`buyer_sidebar_counts`テーブルに欠落カテゴリのデータが存在せず、フロントエンドのサイドバーに表示されません。

**Formal Specification:**
```
FUNCTION isBugCondition(gasExecution)
  INPUT: gasExecution of type GASExecution
  OUTPUT: boolean
  
  RETURN gasExecution.functionName == 'updateBuyerSidebarCounts_'
         AND gasExecution.insertedCategories.length == 4
         AND gasExecution.insertedCategories CONTAINS ['viewingDayBefore', 'todayCall', 'inquiryEmailNotResponded', 'assigned']
         AND NOT gasExecution.insertedCategories CONTAINS ['visitCompleted', 'unvaluated', 'mailingPending', ...]
END FUNCTION
```

### Examples

- **例1**: GASが10分トリガーで実行される → `updateBuyerSidebarCounts_()`が実行される → `buyer_sidebar_counts`テーブルに4種類のカテゴリのみ挿入される → フロントエンドのサイドバーに「①内覧日前日」と「すべて」しか表示されない
- **例2**: ユーザーが買主リストページを開く → バックエンドが`buyer_sidebar_counts`テーブルを読み取る → 欠落カテゴリのデータが存在しない → サイドバーに表示されない
- **例3**: 売主リストページでは全カテゴリが表示される（売主GASコードは全カテゴリを計算・挿入している）
- **エッジケース**: 手動で`updateBuyerSidebarCounts_()`を実行しても、同じ4種類のカテゴリしか挿入されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 既存の4種類のカテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）の計算ロジックは変更しない
- GASの10分トリガーは変更しない（同じ間隔で実行され続ける）
- `buyer_sidebar_counts`テーブルのスキーマは変更しない
- バックエンドの`BuyerService.getSidebarCounts()`メソッドは変更しない（既に全カテゴリのマッピングが実装されている）

**Scope:**
GASの`updateBuyerSidebarCounts_()`関数以外のコードは変更しません。これには以下が含まれます：
- `syncBuyerList()`関数（買主データの同期）
- `rowToObject()`関数（スプレッドシート行をオブジェクトに変換）
- `formatDateToISO_()`関数（日付フォーマット）
- その他のヘルパー関数

## Hypothesized Root Cause

バグ説明に基づくと、最も可能性が高い原因は以下の通りです：

1. **不完全な実装**: `updateBuyerSidebarCounts_()`関数が最初に実装された際、一部のカテゴリ（4種類）のみが実装され、残りのカテゴリが実装されなかった
   - 売主GASコードには全カテゴリの実装があるが、買主GASコードには移植されていない
   - 実装者が途中で作業を中断した可能性がある

2. **カテゴリ定義の不一致**: 買主用のカテゴリ定義が売主用と異なるため、一部のカテゴリが実装されなかった
   - しかし、バックエンドの`BuyerService.getSidebarCounts()`には全カテゴリのマッピングが実装されている
   - これは、カテゴリ定義は存在するが、GASコードに実装されていないことを示唆している

3. **フィールド名の違い**: 買主スプレッドシートのフィールド名が売主スプレッドシートと異なるため、売主GASコードをそのままコピーできなかった
   - 例: 売主は「営担」、買主は「初動担当」「後続担当」
   - 例: 売主は「訪問日 Y/M/D」、買主は「●内覧日(最新）」

4. **優先順位の問題**: 最初に重要なカテゴリ（内覧日前日、当日TEL分）のみを実装し、残りのカテゴリは後回しにされた
   - その後、残りのカテゴリの実装が忘れられた

## Correctness Properties

Property 1: Bug Condition - 全カテゴリの計算・挿入

_For any_ GAS実行において、`updateBuyerSidebarCounts_()`関数が実行される場合、修正後の関数は以下の全カテゴリを計算して`buyer_sidebar_counts`テーブルに挿入する：
- `viewingDayBefore`（内覧日前日）
- `visitCompleted`（内覧済み）
- `todayCall`（当日TEL分）
- `todayCallAssigned`（当日TEL担当別）
- `todayCallWithInfo`（当日TEL内容）
- `unvaluated`（未査定）
- `mailingPending`（査定郵送）
- `todayCallNotStarted`（当日TEL未着手）
- `pinrichEmpty`（Pinrich空欄）
- `exclusive`（専任）
- `general`（一般）
- `visitOtherDecision`（訪問後他決）
- `unvisitedOtherDecision`（未訪問他決）
- `assigned`（担当別）

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存カテゴリの計算ロジック

_For any_ GAS実行において、既存の4種類のカテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）の計算ロジックは、修正前と同じ結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

売主GASコード（`gas_complete_code.js`）の`updateSidebarCounts_()`関数を参考に、買主用のカテゴリ計算ロジックを実装します。

**File**: `gas_buyer_complete_code.js`

**Function**: `updateBuyerSidebarCounts_()`

**Specific Changes**:

1. **カウント変数の初期化を拡張**:
   ```javascript
   var counts = {
     todayCall: 0,
     todayCallWithInfo: {},
     todayCallAssigned: {},
     assigned: {},
     inquiryEmailNotResponded: 0,
     viewingDayBefore: 0,
     // ✅ 追加: 欠落カテゴリ
     visitCompleted: {},           // 内覧済み（担当別）
     unvaluated: 0,                // 未査定
     mailingPending: 0,            // 査定郵送
     todayCallNotStarted: 0,       // 当日TEL未着手
     pinrichEmpty: 0,              // Pinrich空欄
     exclusive: 0,                 // 専任
     general: 0,                   // 一般
     visitOtherDecision: 0,        // 訪問後他決
     unvisitedOtherDecision: 0     // 未訪問他決
   };
   ```

2. **内覧済みカテゴリの計算ロジックを追加**:
   ```javascript
   // 内覧済み: viewing_date が昨日以前 AND assignee が存在
   var viewingDate = formatDateToISO_(row['●内覧日(最新）']);
   if (viewingDate && isAssigneeValid && viewingDate < todayStr) {
     var assigneeKey = String(assignee);
     counts.visitCompleted[assigneeKey] = (counts.visitCompleted[assigneeKey] || 0) + 1;
   }
   ```

3. **未査定カテゴリの計算ロジックを追加**:
   ```javascript
   // 未査定: 査定額が全て空 AND 反響日付が2025/12/8以降 AND 査定不要ではない AND 担当なし AND 追客中
   var val1 = row['査定額1'] || row['査定額1（自動計算）'];
   var val2 = row['査定額2'] || row['査定額2（自動計算）'];
   var val3 = row['査定額3'] || row['査定額3（自動計算）'];
   var hasValuation = !!(val1 || val2 || val3);
   var valuationMethod = row['査定方法'] ? String(row['査定方法']) : '';
   var isValuationNotNeeded = valuationMethod === '査定不要';
   var inquiryDateStr = formatDateToISO_(row['反響日付']);
   var cutoffDate = '2025-12-08';
   
   if (status.indexOf('追客中') !== -1 && !hasValuation && !isValuationNotNeeded &&
       !isAssigneeValid && inquiryDateStr && inquiryDateStr >= cutoffDate) {
     counts.unvaluated++;
   }
   ```

4. **査定郵送カテゴリの計算ロジックを追加**:
   ```javascript
   // 査定郵送: 郵送ステータスが「未」
   var mailingStatus = row['郵送ステータス'] ? String(row['郵送ステータス']) : '';
   if (mailingStatus === '未') {
     counts.mailingPending++;
   }
   ```

5. **当日TEL未着手カテゴリの計算ロジックを追加**:
   ```javascript
   // 当日TEL未着手: 当日TEL分の条件 + 不通が空欄 + 反響日付が2026/1/1以降
   var unreachable = row['不通'] ? String(row['不通']) : '';
   var cutoffDate2 = '2026-01-01';
   
   if (status.indexOf('追客中') !== -1 && nextCallDate && isTodayOrBefore(nextCallDate) &&
       !isAssigneeValid && !hasContactInfo(row) && !unreachable &&
       inquiryDateStr && inquiryDateStr >= cutoffDate2) {
     counts.todayCallNotStarted++;
   }
   ```

6. **Pinrich空欄カテゴリの計算ロジックを追加**:
   ```javascript
   // Pinrich空欄: 当日TEL分の条件 + Pinrichが空欄
   var pinrich = row['Pinrich'] ? String(row['Pinrich']) : '';
   
   if (status.indexOf('追客中') !== -1 && nextCallDate && isTodayOrBefore(nextCallDate) &&
       !isAssigneeValid && !hasContactInfo(row) && !pinrich) {
     counts.pinrichEmpty++;
   }
   ```

7. **専任・一般・訪問後他決・未訪問他決カテゴリの計算ロジックを追加**:
   ```javascript
   // 専任他決打合せカテゴリ（4つの新カテゴリ）
   var exclusiveOtherDecisionMeeting = row['専任他決打合せ'] ? String(row['専任他決打合せ']) : '';
   var contractYearMonth = formatDateToISO_(row['契約年月']);
   var generalCutoffDate = '2025-06-23';
   
   // 専任: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況 IN ("専任媒介", "他決→専任", "リースバック（専任）")
   if (exclusiveOtherDecisionMeeting !== '完了' &&
       (!nextCallDate || nextCallDate !== todayStr) &&
       (status === '専任媒介' || status === '他決→専任' || status === 'リースバック（専任）')) {
     counts.exclusive++;
   }
   
   // 一般: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況 = "一般媒介" AND 契約年月 >= "2025-06-23"
   if (exclusiveOtherDecisionMeeting !== '完了' &&
       (!nextCallDate || nextCallDate !== todayStr) &&
       status === '一般媒介' &&
       contractYearMonth && contractYearMonth >= generalCutoffDate) {
     counts.general++;
   }
   
   // 訪問後他決: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況 IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND 担当あり
   if (exclusiveOtherDecisionMeeting !== '完了' &&
       (!nextCallDate || nextCallDate !== todayStr) &&
       (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
       isAssigneeValid) {
     counts.visitOtherDecision++;
   }
   
   // 未訪問他決: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況 IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND 担当なし
   if (exclusiveOtherDecisionMeeting !== '完了' &&
       (!nextCallDate || nextCallDate !== todayStr) &&
       (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
       !isAssigneeValid) {
     counts.unvisitedOtherDecision++;
   }
   ```

8. **Supabaseへの保存処理を拡張**:
   ```javascript
   // 内覧済み（担当別）
   for (var va in counts.visitCompleted) {
     upsertRows.push({
       category: 'visitCompleted',
       count: counts.visitCompleted[va],
       label: '',
       assignee: va,
       updated_at: now
     });
   }
   
   // 未査定
   upsertRows.push({
     category: 'unvaluated',
     count: counts.unvaluated,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // 査定郵送
   upsertRows.push({
     category: 'mailingPending',
     count: counts.mailingPending,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // 当日TEL未着手
   upsertRows.push({
     category: 'todayCallNotStarted',
     count: counts.todayCallNotStarted,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // Pinrich空欄
   upsertRows.push({
     category: 'pinrichEmpty',
     count: counts.pinrichEmpty,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // 専任
   upsertRows.push({
     category: 'exclusive',
     count: counts.exclusive,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // 一般
   upsertRows.push({
     category: 'general',
     count: counts.general,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // 訪問後他決
   upsertRows.push({
     category: 'visitOtherDecision',
     count: counts.visitOtherDecision,
     label: '',
     assignee: '',
     updated_at: now
   });
   
   // 未訪問他決
   upsertRows.push({
     category: 'unvisitedOtherDecision',
     count: counts.unvisitedOtherDecision,
     label: '',
     assignee: '',
     updated_at: now
   });
   ```

### 買主特有のフィールド名への調整

売主GASコードと買主GASコードでは、スプレッドシートのフィールド名が異なるため、以下の対応が必要です：

| 売主フィールド名 | 買主フィールド名 | 説明 |
|---------------|---------------|------|
| `営担` | `後続担当` または `初動担当` | 担当者（後続担当を優先） |
| `訪問日 Y/M/D` | `●内覧日(最新）` | 訪問日/内覧日 |
| `状況（当社）` | `★最新状況\n` | 状況 |
| `次電日` | `★次電日` | 次回電話日 |

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードで欠落カテゴリが計算されないことを確認し、次に修正後のコードで全カテゴリが正しく計算されることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで欠落カテゴリが計算・挿入されないことを確認し、根本原因分析を検証する。

**Test Plan**: 現在の`updateBuyerSidebarCounts_()`関数を手動実行し、`buyer_sidebar_counts`テーブルに挿入されるカテゴリを確認する。修正前のコードでは4種類のカテゴリのみが挿入されることを観察する。

**Test Cases**:
1. **GAS手動実行テスト**: GASエディタで`updateBuyerSidebarCounts_()`を手動実行 → ログで4種類のカテゴリのみが挿入されることを確認（修正前のコードで失敗）
2. **データベース確認テスト**: `buyer_sidebar_counts`テーブルをクエリ → 4種類のカテゴリのみが存在することを確認（修正前のコードで失敗）
3. **フロントエンド表示テスト**: 買主リストページを開く → サイドバーに「①内覧日前日」と「すべて」しか表示されないことを確認（修正前のコードで失敗）
4. **売主との比較テスト**: 売主リストページを開く → サイドバーに全カテゴリが表示されることを確認（売主GASコードは正常）

**Expected Counterexamples**:
- `buyer_sidebar_counts`テーブルに`visitCompleted`, `unvaluated`, `mailingPending`などのカテゴリが存在しない
- 可能な原因: `updateBuyerSidebarCounts_()`関数が一部のカテゴリのみを計算・挿入している

### Fix Checking

**Goal**: 修正後のコードで、全カテゴリが正しく計算・挿入されることを検証する。

**Pseudocode:**
```
FOR ALL gasExecution WHERE isBugCondition(gasExecution) DO
  result := updateBuyerSidebarCounts_fixed()
  ASSERT result.insertedCategories.length >= 12
  ASSERT result.insertedCategories CONTAINS ['visitCompleted', 'unvaluated', 'mailingPending', ...]
END FOR
```

**Test Plan**: 修正後の`updateBuyerSidebarCounts_()`関数を手動実行し、`buyer_sidebar_counts`テーブルに全カテゴリが挿入されることを確認する。

**Test Cases**:
1. **GAS手動実行テスト**: GASエディタで修正後の`updateBuyerSidebarCounts_()`を手動実行 → ログで12種類以上のカテゴリが挿入されることを確認
2. **データベース確認テスト**: `buyer_sidebar_counts`テーブルをクエリ → 全カテゴリが存在することを確認
3. **フロントエンド表示テスト**: 買主リストページを開く → サイドバーに全カテゴリが表示されることを確認（カウントが0より大きい場合）
4. **カウント正確性テスト**: 各カテゴリのカウント数が正しいことを確認（スプレッドシートのデータと照合）

### Preservation Checking

**Goal**: 修正後のコードで、既存の4種類のカテゴリの計算ロジックが変更されていないことを検証する。

**Pseudocode:**
```
FOR ALL gasExecution WHERE NOT isBugCondition(gasExecution) DO
  ASSERT updateBuyerSidebarCounts_original(gasExecution) = updateBuyerSidebarCounts_fixed(gasExecution)
END FOR
```

**Testing Approach**: Property-based testingは推奨されませんが、手動テストで既存カテゴリのカウント数が修正前後で一致することを確認します。

**Test Plan**: 修正前のコードで既存カテゴリのカウント数を記録し、修正後のコードで同じカウント数が返されることを確認する。

**Test Cases**:
1. **内覧日前日カウント保存テスト**: 修正前のコードで`viewingDayBefore`のカウント数を記録 → 修正後のコードで同じカウント数が返されることを確認
2. **当日TEL分カウント保存テスト**: 修正前のコードで`todayCall`のカウント数を記録 → 修正後のコードで同じカウント数が返されることを確認
3. **担当別カウント保存テスト**: 修正前のコードで`assigned`のカウント数を記録 → 修正後のコードで同じカウント数が返されることを確認
4. **GAS10分トリガー保存テスト**: GASの10分トリガーが修正後も同じ間隔で実行されることを確認

### Unit Tests

- GASの`updateBuyerSidebarCounts_()`関数を手動実行して、各カテゴリのカウント数を確認
- `buyer_sidebar_counts`テーブルをクエリして、全カテゴリが存在することを確認
- フロントエンドで買主リストページを開いて、サイドバーに全カテゴリが表示されることを確認

### Property-Based Tests

Property-based testingはGAS環境では実装が困難なため、手動テストで代替します。

### Integration Tests

- GASの10分トリガーが実行される → `updateBuyerSidebarCounts_()`が実行される → `buyer_sidebar_counts`テーブルに全カテゴリが挿入される → フロントエンドのサイドバーに全カテゴリが表示される
- 買主データがスプレッドシートで更新される → GASの10分トリガーが実行される → `buyer_sidebar_counts`テーブルが更新される → フロントエンドのサイドバーが更新される
- 売主リストページと買主リストページの両方で、サイドバーに全カテゴリが表示されることを確認
