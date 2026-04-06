# 買主リスト「●問合時ヒアリング」同期不具合 修正設計

## Overview

買主リストのスプレッドシート列「●問合時ヒアリング」がデータベースの`inquiry_hearing`カラムに同期されない不具合を修正します。カラムマッピング定義は正しく設定されているにもかかわらず、`EnhancedAutoSyncService`の変更検出ロジックまたは更新処理で`inquiry_hearing`フィールドが正しく処理されていないことが原因と推測されます。

この不具合により、スプレッドシートで「●問合時ヒアリング」を更新しても買主詳細画面に反映されず、業務に支障が出ています。

## Glossary

- **Bug_Condition (C)**: スプレッドシートの「●問合時ヒアリング」列を更新しても、データベースの`inquiry_hearing`カラムが更新されない状態
- **Property (P)**: スプレッドシートの「●問合時ヒアリング」列を更新した場合、データベースの`inquiry_hearing`カラムが正しく更新される
- **Preservation**: 他のフィールド（「●氏名・会社名」「●内覧日(最新）」など）の同期処理は変更せず、正常に動作し続ける
- **EnhancedAutoSyncService**: `backend/src/services/EnhancedAutoSyncService.ts` - スプレッドシートとデータベースの自動同期を管理するサービス
- **detectUpdatedBuyers**: 買主の変更を検出するメソッド（全フィールドを比較）
- **updateSingleBuyer**: 買主データをデータベースに更新するメソッド
- **BuyerColumnMapper**: `backend/src/services/BuyerColumnMapper.ts` - スプレッドシート列とデータベースカラムのマッピングを管理

## Bug Details

### Bug Condition

スプレッドシートの「●問合時ヒアリング」列を更新しても、`EnhancedAutoSyncService`の同期処理が変更を検出せず、または検出しても更新処理で`inquiry_hearing`カラムが更新されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerNumber: string, sheetInquiryHearing: string, dbInquiryHearing: string }
  OUTPUT: boolean
  
  RETURN input.sheetInquiryHearing !== input.dbInquiryHearing
         AND syncProcessExecuted()
         AND input.dbInquiryHearing NOT UPDATED
END FUNCTION
```

### Examples

- **例1**: スプレッドシートで買主7001の「●問合時ヒアリング」を「予算3000万円、駅近希望」に更新 → 同期処理実行 → データベースの`inquiry_hearing`は空のまま
- **例2**: スプレッドシートで買主7002の「●問合時ヒアリング」を「ペット可物件希望」に更新 → 同期処理実行 → データベースの`inquiry_hearing`は更新されない
- **例3**: スプレッドシートで買主7003の「●問合時ヒアリング」を空欄に変更 → 同期処理実行 → データベースの`inquiry_hearing`は以前の値のまま
- **エッジケース**: 新規買主作成時に「●問合時ヒアリング」を入力 → 期待される動作：`inquiry_hearing`に正しく保存される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のフィールド（「●氏名・会社名」「●内覧日(最新）」「●希望時期」など）の同期処理は正常に動作し続ける
- 新規買主作成時の全フィールド同期は正常に動作し続ける
- 買主削除の同期処理は正常に動作し続ける

**Scope:**
「●問合時ヒアリング」以外のフィールドの同期処理は完全に影響を受けない。これには以下が含まれる：
- 基本情報フィールド（氏名、電話番号、メールアドレスなど）
- 日付フィールド（内覧日、受付日など）
- 選択肢フィールド（問合せ元、配信種別など）
- 数値フィールド（駐車台数など）

## Hypothesized Root Cause

コード分析に基づく推測される原因：

1. **`detectUpdatedBuyers`での比較対象外**: `inquiry_hearing`フィールドが比較ロジックから漏れている可能性
   - `detectUpdatedBuyers`メソッドは全フィールドを比較するが、`inquiry_hearing`が`skipFields`に含まれている
   - または、`BuyerColumnMapper.mapSpreadsheetToDatabase()`が`inquiry_hearing`を正しくマッピングしていない

2. **`BuyerColumnMapper`の変換処理の問題**: `inquiry_hearing`が文字列フィールドとして正しく処理されていない
   - `convertValue`メソッドで空文字が`null`に変換され、比較時に差分として検出されない
   - HTMLタグのストリップ処理で内容が失われている

3. **`updateSingleBuyer`での更新対象外**: `inquiry_hearing`が`manualPriorityFields`に含まれ、更新がスキップされている
   - 手動入力優先フィールドとして誤って設定されている

4. **カラムマッピングの読み込み失敗**: `buyer-column-mapping.json`の`inquiry_hearing`マッピングが実行時に正しく読み込まれていない
   - JSONファイルのパース時にエラーが発生している
   - または、マッピングキーの不一致（スペース、改行文字など）

## Correctness Properties

Property 1: Bug Condition - 「●問合時ヒアリング」フィールドの同期

_For any_ 買主レコードにおいて、スプレッドシートの「●問合時ヒアリング」列が更新され、同期処理が実行された場合、修正後のシステムSHALLデータベースの`inquiry_hearing`カラムをスプレッドシートの値と一致するように更新する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他フィールドの同期処理

_For any_ 買主レコードにおいて、「●問合時ヒアリング」以外のフィールドが更新された場合、修正後のシステムSHALL修正前と同じ動作で該当フィールドをデータベースに同期し、既存の同期処理を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正内容：

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Method**: `detectUpdatedBuyers`

**Specific Changes**:
1. **比較ロジックの確認**: `inquiry_hearing`フィールドが比較対象に含まれているか確認
   - `BuyerColumnMapper.mapSpreadsheetToDatabase()`の戻り値に`inquiry_hearing`が含まれているか検証
   - デバッグログを追加して、スプレッドシートの「●問合時ヒアリング」が正しくマッピングされているか確認

2. **skipFieldsの確認**: `inquiry_hearing`が`skipFields`に誤って含まれていないか確認
   - 含まれている場合は削除

3. **文字列比較ロジックの修正**: 空文字と`null`の扱いを統一
   - 現在の実装：`sheetStr !== dbStr`で比較（空文字と`null`を同一視）
   - `inquiry_hearing`が空文字→`null`変換されている場合、差分として検出されない可能性

**File**: `backend/src/services/BuyerColumnMapper.ts`

**Method**: `mapSpreadsheetToDatabase`

**Specific Changes**:
1. **マッピング確認**: 「●問合時ヒアリング」→`inquiry_hearing`のマッピングが正しく動作しているか確認
   - `this.spreadsheetToDb['●問合時ヒアリング']`が`'inquiry_hearing'`を返すか検証
   - デバッグログを追加

2. **convertValueの確認**: `inquiry_hearing`が文字列として正しく処理されているか確認
   - HTMLストリップ処理が不要な内容を削除していないか検証
   - 空文字の扱いを確認（`null`に変換されていないか）

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Method**: `updateSingleBuyer`

**Specific Changes**:
1. **manualPriorityFieldsの確認**: `inquiry_hearing`が含まれていないか確認
   - 含まれている場合は削除

2. **updateDataの確認**: `inquiry_hearing`が`updateData`に含まれているか確認
   - デバッグログを追加して、更新前の`updateData`の内容を出力

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチを採用：まず、未修正コードで不具合を再現し、根本原因を特定する。次に、修正後のコードで正しく同期されることを検証し、既存機能が保持されていることを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで不具合を再現し、根本原因を確認または反証する。反証された場合は再仮説を立てる。

**Test Plan**: スプレッドシートで「●問合時ヒアリング」を更新し、同期処理を実行。デバッグログを追加して、各処理段階で`inquiry_hearing`の値を追跡する。

**Test Cases**:
1. **基本ケース**: 買主7001の「●問合時ヒアリング」を「予算3000万円」に更新 → 同期実行 → データベースが更新されない（未修正コードで失敗）
2. **空欄ケース**: 買主7002の「●問合時ヒアリング」を空欄に変更 → 同期実行 → データベースがクリアされない（未修正コードで失敗）
3. **長文ケース**: 買主7003の「●問合時ヒアリング」に長文（500文字）を入力 → 同期実行 → データベースが更新されない（未修正コードで失敗）
4. **新規作成ケース**: 新規買主を作成し「●問合時ヒアリング」を入力 → 同期実行 → データベースに正しく保存される（期待される動作）

**Expected Counterexamples**:
- `detectUpdatedBuyers`で`inquiry_hearing`の変更が検出されない
- または、`updateSingleBuyer`で`inquiry_hearing`が更新対象から除外されている
- Possible causes: `skipFields`に含まれている、`BuyerColumnMapper`のマッピング失敗、`manualPriorityFields`に含まれている

### Fix Checking

**Goal**: 修正後のコードで、`inquiry_hearing`フィールドの変更が正しく検出され、データベースに反映されることを検証する。

**Pseudocode:**
```
FOR ALL buyerRecord WHERE isBugCondition(buyerRecord) DO
  result := syncUpdatedBuyers_fixed([buyerRecord.buyerNumber])
  dbValue := fetchFromDatabase(buyerRecord.buyerNumber, 'inquiry_hearing')
  ASSERT dbValue = buyerRecord.sheetInquiryHearing
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、「●問合時ヒアリング」以外のフィールドの同期処理が変更前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL buyerRecord WHERE NOT isBugCondition(buyerRecord) DO
  ASSERT syncUpdatedBuyers_original(buyerRecord) = syncUpdatedBuyers_fixed(buyerRecord)
END FOR
```

**Testing Approach**: Property-based testingを推奨する理由：
- 多数のテストケースを自動生成し、入力ドメイン全体をカバー
- 手動テストでは見逃しやすいエッジケースを検出
- 「●問合時ヒアリング」以外の全フィールドで動作が変わっていないことを強力に保証

**Test Plan**: 未修正コードで他フィールドの同期動作を観察し、その動作を再現するProperty-based testを作成する。

**Test Cases**:
1. **基本情報フィールドの保持**: 「●氏名・会社名」を更新 → 未修正コードと同じ動作で同期される
2. **日付フィールドの保持**: 「●内覧日(最新）」を更新 → 未修正コードと同じ動作で同期される
3. **数値フィールドの保持**: 「●P台数」を更新 → 未修正コードと同じ動作で同期される
4. **新規作成の保持**: 新規買主を作成 → 「●問合時ヒアリング」を含む全フィールドが正しく保存される

### Unit Tests

- `detectUpdatedBuyers`で`inquiry_hearing`の変更が正しく検出されることをテスト
- `BuyerColumnMapper.mapSpreadsheetToDatabase`で「●問合時ヒアリング」が`inquiry_hearing`に正しくマッピングされることをテスト
- `updateSingleBuyer`で`inquiry_hearing`が更新対象に含まれることをテスト
- エッジケース：空文字、`null`、長文、特殊文字を含む文字列

### Property-Based Tests

- ランダムな買主データを生成し、「●問合時ヒアリング」の同期が正しく動作することを検証
- ランダムな買主データを生成し、他フィールドの同期動作が保持されることを検証
- 多数のシナリオで、修正前後の動作が一致することをテスト（「●問合時ヒアリング」以外）

### Integration Tests

- スプレッドシート→データベース→買主詳細画面の全フローで「●問合時ヒアリング」が正しく表示されることをテスト
- 複数買主の一括同期で「●問合時ヒアリング」が正しく更新されることをテスト
- 新規作成、更新、削除の全操作で「●問合時ヒアリング」が正しく処理されることをテスト
