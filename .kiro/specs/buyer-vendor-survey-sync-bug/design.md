# buyer-vendor-survey-sync-bug バグ修正デザイン

## Overview

買主リストにおいて、スプレッドシートの「業者向けアンケート」列（DBカラム: `vendor_survey`）がGASの定期同期でデータベースに反映されないバグ。

GASの買主リスト同期スクリプト内の `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` のマッピングが存在しないため、`buyerMapRowToRecord` 関数がこのカラムをスキップしている。

修正は最小限で、`BUYER_COLUMN_MAPPING` に1行追加するだけで完結する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — スプレッドシートの買主行に「業者向けアンケート」列の値が存在し、かつGASの定期同期が実行される状況
- **Property (P)**: 期待される正しい動作 — 同期後にDBの `vendor_survey` カラムがスプレッドシートの値と一致すること
- **Preservation**: 修正によって変更してはならない既存の動作 — 他の買主フィールドの同期動作
- **BUYER_COLUMN_MAPPING**: GASスクリプト内の定数。スプレッドシートのヘッダー名からDBカラム名へのマッピングを定義する
- **buyerMapRowToRecord**: GASの関数。`BUYER_COLUMN_MAPPING` を参照してスプレッドシートの1行をDBレコードに変換する
- **vendor_survey**: `buyers` テーブルのカラム名。スプレッドシートの「業者向けアンケート」列に対応する

## Bug Details

### Bug Condition

スプレッドシートの買主行に「業者向けアンケート」列の値が入力されている場合、GASの `buyerMapRowToRecord` 関数は `BUYER_COLUMN_MAPPING` を参照してDBレコードを構築するが、このマッピングに `'業者向けアンケート': 'vendor_survey'` が存在しないため、当該フィールドがスキップされる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerSpreadsheetRow
  OUTPUT: boolean

  RETURN input['業者向けアンケート'] IS NOT NULL
         AND input['業者向けアンケート'] != ''
         AND '業者向けアンケート' NOT IN BUYER_COLUMN_MAPPING
END FUNCTION
```

### Examples

- **例1（バグあり）**: 買主番号7260のスプレッドシート行に「業者向けアンケート」= "確認済み" が入力されている → GAS同期後もDBの `vendor_survey` は `NULL` のまま
- **例2（バグあり）**: 「業者向けアンケート」= "未確認" の買主行が同期される → DBに反映されない
- **例3（バグなし）**: 「業者向けアンケート」列が空欄の買主行が同期される → 他のフィールドは正常に同期される（このケースはバグ条件を満たさない）
- **エッジケース**: 「業者向けアンケート」列が空欄 → `vendor_survey` に `NULL` または空値が設定される（修正後も同様）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `next_call_date`、`latest_status`、`broker_survey` 等、他の買主フィールドのスプレッドシート→DB同期は従来通り動作すること
- 「業者向けアンケート」列が空欄の買主行が同期される場合、他のフィールドは正常に同期され、`vendor_survey` には `NULL` または空値が設定されること
- `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` に定義された全カラムは従来通り同期されること

**スコープ:**
「業者向けアンケート」列以外の全フィールドの同期動作は、この修正によって一切影響を受けてはならない。

## Hypothesized Root Cause

バグの根本原因は明確に特定されている：

1. **BUYER_COLUMN_MAPPING へのマッピング未追加**: GASスクリプトの `BUYER_COLUMN_MAPPING` 定数に `'業者向けアンケート': 'vendor_survey'` が存在しない。`buyerMapRowToRecord` はこのマッピングを参照してDBレコードを構築するため、マッピングにないカラムは無視される。

2. **buyer-column-mapping.json との不整合**: バックエンドの `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` には `"業者向けアンケート": "broker_survey"` が定義されているが、`vendor_survey` へのマッピングは存在しない。また、GASの `BUYER_COLUMN_MAPPING` とバックエンドのJSONは独立して管理されており、片方を更新しても他方には反映されない。

3. **`vendor_survey` カラムの追加時にGAS更新が漏れた**: DBマイグレーションで `vendor_survey` カラムを追加した際、GASの `BUYER_COLUMN_MAPPING` への追加が漏れたと推測される（`buyer-column-sync-rule.md` に記載の既知パターン）。

## Correctness Properties

Property 1: Bug Condition - 業者向けアンケートのDB同期

_For any_ 買主スプレッドシート行において「業者向けアンケート」列に値が存在する場合（isBugCondition が true を返す場合）、修正後の `buyerMapRowToRecord` 関数はその値をDBレコードの `vendor_survey` フィールドに含め、GAS同期後にDBの `buyers.vendor_survey` がスプレッドシートの値と一致すること。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他フィールドの同期動作維持

_For any_ 買主スプレッドシート行において「業者向けアンケート」列以外のフィールドが更新される場合（isBugCondition が false を返す場合）、修正後の `buyerMapRowToRecord` 関数は修正前と同一の結果を返し、既存の全フィールドの同期動作が維持されること。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `gas_complete_code.js`（GASプロジェクトにデプロイされるスクリプト）

**対象**: `BUYER_COLUMN_MAPPING` 定数

**Specific Changes**:

1. **BUYER_COLUMN_MAPPING への追加**: `'業者向けアンケート': 'vendor_survey'` を追加する

   ```javascript
   // 修正前（マッピングなし）
   var BUYER_COLUMN_MAPPING = {
     // ... 既存のマッピング ...
     '業者向けアンケート': 'broker_survey'  // ← broker_surveyは別フィールド
     // vendor_survey へのマッピングが存在しない
   };

   // 修正後
   var BUYER_COLUMN_MAPPING = {
     // ... 既存のマッピング ...
     '業者向けアンケート': 'broker_survey',  // 既存
     '業者向けアンケート': 'vendor_survey'   // ← 追加
   };
   ```

   **注意**: `broker_survey` と `vendor_survey` は別カラムであることを確認する。スプレッドシートの列名が同一の場合、マッピングの重複に注意が必要。実際のスプレッドシートのヘッダー名を確認して正確なキー名を使用すること。

2. **buyer-column-mapping.json の確認**: `spreadsheetToDatabaseExtended` に `"業者向けアンケート": "vendor_survey"` が存在しない場合は追加する。

3. **GASのデプロイ**: 修正後のスクリプトをスプレッドシートに紐づいたGASプロジェクトにデプロイする。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを実行し、次に修正後のコードで正しい動作とリグレッションがないことを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `buyerMapRowToRecord` 関数に「業者向けアンケート」列を含む買主行を渡し、返却されたレコードに `vendor_survey` フィールドが含まれないことを確認する。

**Test Cases**:
1. **基本バグ再現テスト**: 「業者向けアンケート」= "確認済み" の行を `buyerMapRowToRecord` に渡す → 返却レコードに `vendor_survey` が含まれないことを確認（未修正コードで失敗）
2. **買主番号7260テスト**: 実際の買主番号7260の行データを使用して同期をシミュレート → DBの `vendor_survey` が更新されないことを確認（未修正コードで失敗）
3. **空欄テスト**: 「業者向けアンケート」が空欄の行を渡す → 他フィールドは正常に処理されることを確認

**Expected Counterexamples**:
- `buyerMapRowToRecord` の返却オブジェクトに `vendor_survey` キーが存在しない
- 原因: `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` が存在しない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全入力に対して期待される動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  record := buyerMapRowToRecord_fixed(input)
  ASSERT record['vendor_survey'] == input['業者向けアンケート']
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない入力に対して修正前と同一の結果が得られることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT buyerMapRowToRecord_original(input) == buyerMapRowToRecord_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 多様な買主行データを自動生成して網羅的に検証できる
- 手動テストでは見落としやすいエッジケースを検出できる
- 「業者向けアンケート」以外の全フィールドが影響を受けないことを強く保証できる

**Test Cases**:
1. **他フィールド保持テスト**: `next_call_date`、`latest_status`、`broker_survey` 等を含む行を渡し、修正前後で同一の結果が返ることを確認
2. **空欄行テスト**: 「業者向けアンケート」が空欄の行で、他フィールドの同期結果が変わらないことを確認
3. **全フィールド網羅テスト**: `BUYER_COLUMN_MAPPING` に定義された全カラムが修正後も正しくマッピングされることを確認

### Unit Tests

- `buyerMapRowToRecord` に「業者向けアンケート」を含む行を渡し、`vendor_survey` が正しくマッピングされることを確認
- 「業者向けアンケート」が空欄の場合、`vendor_survey` が `null` または空値になることを確認
- 既存の全マッピング（`next_call_date`、`latest_status` 等）が引き続き正しく動作することを確認

### Property-Based Tests

- ランダムな買主行データを生成し、`BUYER_COLUMN_MAPPING` に定義された全カラムが正しくマッピングされることを確認
- 「業者向けアンケート」以外のフィールドを含む行で、修正前後の結果が一致することを確認
- 様々な値（空文字、長い文字列、特殊文字等）で `vendor_survey` が正しく処理されることを確認

### Integration Tests

- GASの定期同期（`syncBuyerList` 相当）を実行し、買主番号7260の `vendor_survey` がDBに反映されることを確認
- 修正後の同期で、他の買主フィールドが従来通り正常に同期されることを確認
- `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` との整合性を確認
