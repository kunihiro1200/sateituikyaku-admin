# 査定額同期先列修正 Bugfix Design

## Overview

通話モードページにおいて、DBの査定額1、2、3がスプレッドシートの間違った列（CB、CC、CD列：手動入力用、列79-81）と同期されている問題を修正します。本来は**BC、BD、BE列（自動計算用、列54-56）**と同期されるべきです。

この問題により、通話モードページで表示される査定額が、スプレッドシートの自動計算値ではなく手動入力値（または空欄）になっており、ユーザーが正しい査定額を確認できない状態になっています。

修正により、通話モードページで常に最新の自動計算査定額が表示されるようになります。

## Glossary

- **Bug_Condition (C)**: 査定額の同期先列が間違っている状態 - `column-mapping.json`が`valuation_amount_1/2/3`を「査定額1/2/3」（CB/CC/CD列）にマッピングしている
- **Property (P)**: 正しい同期先列への修正 - `valuation_amount_1/2/3`が「査定額1（自動計算）v/査定額2（自動計算）v/査定額3（自動計算）v」（BC/BD/BE列）にマッピングされる
- **Preservation**: 既存の査定額優先順位ロジック（手動入力優先、なければ自動計算）と単位変換ロジック（万円→円）が維持される
- **BC/BD/BE列**: スプレッドシートの列54-56、「査定額1（自動計算）v」「査定額2（自動計算）v」「査定額3（自動計算）v」カラム（自動計算値）
- **CB/CC/CD列**: スプレッドシートの列79-81、「査定額1」「査定額2」「査定額3」カラム（手動入力値）
- **column-mapping.json**: スプレッドシートとデータベースのカラムマッピング定義ファイル
- **EnhancedAutoSyncService**: スプレッドシートとデータベースの同期を担当するサービス

## Bug Details

### Bug Condition

バグは、`column-mapping.json`の`databaseToSpreadsheet`セクションで、`valuation_amount_1/2/3`が間違った列（CB/CC/CD列：手動入力用）にマッピングされている場合に発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(columnMapping)
  INPUT: columnMapping of type Object (column-mapping.json の内容)
  OUTPUT: boolean
  
  RETURN columnMapping.databaseToSpreadsheet['valuation_amount_1'] == '査定額1'
         AND columnMapping.databaseToSpreadsheet['valuation_amount_2'] == '査定額2'
         AND columnMapping.databaseToSpreadsheet['valuation_amount_3'] == '査定額3'
         AND NOT (columnMapping.databaseToSpreadsheet['valuation_amount_1'] == '査定額1（自動計算）v')
END FUNCTION
```

### Examples

- **現在の間違った状態**: `column-mapping.json`で`valuation_amount_1`が「査定額1」（CB列、列79）にマッピング → 通話モードページで手動入力値（または空欄）が表示される
- **期待される正しい状態**: `column-mapping.json`で`valuation_amount_1`が「査定額1（自動計算）v」（BC列、列54）にマッピング → 通話モードページで自動計算値が表示される
- **影響範囲**: 査定額1、査定額2、査定額3の3つのフィールド全て
- **ユーザーへの影響**: 通話モードページで正しい査定額を確認できない、営業活動に支障が出る

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 査定額以外のフィールド（名前、電話番号、物件住所等）の同期ロジックは変更しない
- 手動入力査定額（CB/CC/CD列）が存在する場合の優先順位ロジック（「手動入力優先、なければ自動計算」）は維持する
- 査定額の単位変換ロジック（万円→円、×10,000）は維持する
- スプレッドシートの取得範囲（`B:CZ`）は維持する

**Scope:**
査定額の同期先列のマッピング変更のみを行います。以下は変更しません：
- `EnhancedAutoSyncService.ts`の同期ロジック（優先順位ロジック、単位変換ロジック）
- スプレッドシートの取得範囲
- 他のフィールドのマッピング

## Hypothesized Root Cause

バグの根本原因は以下の通りです：

1. **間違ったマッピング定義**: `column-mapping.json`の`databaseToSpreadsheet`セクションで、`valuation_amount_1/2/3`が「査定額1/2/3」（CB/CC/CD列）にマッピングされている
   - 正しくは「査定額1（自動計算）v/査定額2（自動計算）v/査定額3（自動計算）v」（BC/BD/BE列）にマッピングすべき

2. **ステアリングドキュメントの記載ミス**: `seller-spreadsheet-column-mapping.md`に間違った列位置（CB/CC/CD = 列79-81）が記載されている
   - 正しくは列54-56（BC/BD/BE列）と記載すべき

3. **過去の修正の影響**: 過去に査定額の優先順位ロジック（手動入力優先）を実装した際、`databaseToSpreadsheet`のマッピングも誤って変更してしまった可能性がある

## Correctness Properties

Property 1: Bug Condition - 査定額同期先列の修正

_For any_ データベースからスプレッドシートへの同期処理において、`valuation_amount_1/2/3`フィールドは「査定額1（自動計算）v」「査定額2（自動計算）v」「査定額3（自動計算）v」（BC/BD/BE列、列54-56）にマッピングされ、正しい自動計算値が同期される。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 既存同期ロジックの維持

_For any_ 査定額以外のフィールドの同期処理、および査定額の優先順位ロジック（手動入力優先）と単位変換ロジック（万円→円）において、修正後も既存のロジックが正しく動作し、データの整合性が保たれる。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を実施します：

**File 1**: `backend/src/config/column-mapping.json`

**Section**: `databaseToSpreadsheet`

**Specific Changes**:
1. **査定額1のマッピング修正**:
   - 変更前: `"valuation_amount_1": "査定額1"`
   - 変更後: `"valuation_amount_1": "査定額1（自動計算）v"`

2. **査定額2のマッピング修正**:
   - 変更前: `"valuation_amount_2": "査定額2"`
   - 変更後: `"valuation_amount_2": "査定額2（自動計算）v"`

3. **査定額3のマッピング修正**:
   - 変更前: `"valuation_amount_3": "査定額3"`
   - 変更後: `"valuation_amount_3": "査定額3（自動計算）v"`

**File 2**: `.kiro/steering/seller-spreadsheet-column-mapping.md`

**Section**: 完全なカラムマッピング表

**Specific Changes**:
1. **列位置の修正**: 査定額1/2/3の列位置を「列79-81（CB/CC/CD）」から「列54-56（BC/BD/BE）」に修正
2. **カラム名の修正**: 「査定額1/2/3」から「査定額1（自動計算）v/査定額2（自動計算）v/査定額3（自動計算）v」に修正
3. **説明の追加**: 「自動計算値」であることを明記

**File 3**: `backend/src/services/EnhancedAutoSyncService.ts`

**Section**: なし（変更不要）

**Reason**: 
- 同期ロジック自体は正しく実装されている（優先順位ロジック、単位変換ロジック）
- `column-mapping.json`のマッピングを修正するだけで、正しい列から同期されるようになる

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチを採用します：まず、修正前のコードでバグを再現し、次に修正後のコードで正しく動作することを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 
1. 現在の`column-mapping.json`を確認し、`valuation_amount_1/2/3`が「査定額1/2/3」（CB/CC/CD列）にマッピングされていることを確認
2. スプレッドシートで、CB/CC/CD列（手動入力）が空欄、BC/BD/BE列（自動計算）に値が入っている売主を選択
3. 同期を実行し、DBの`valuation_amount_1/2/3`が空欄（または手動入力値）になることを確認
4. 通話モードページで査定額が表示されない（または手動入力値が表示される）ことを確認

**Test Cases**:
1. **CB/CC/CD列が空欄の売主**: 同期後、DBの査定額が空欄になる（バグ再現）
2. **CB/CC/CD列に手動入力値がある売主**: 同期後、DBの査定額が手動入力値になる（BC/BD/BE列の自動計算値ではない）
3. **BC/BD/BE列に自動計算値がある売主**: 同期後、DBの査定額にBC/BD/BE列の値が反映されない（バグ再現）

**Expected Counterexamples**:
- CB/CC/CD列が空欄の場合、DBの査定額も空欄になる
- BC/BD/BE列の自動計算値がDBに反映されない

### Fix Checking

**Goal**: 修正後のコードで、正しい列（BC/BD/BE列）から査定額が同期されることを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE BC/BD/BE列に自動計算値がある DO
  同期を実行
  result := DBから査定額を取得
  ASSERT result.valuation_amount_1 == BC列の値（万円→円変換後）
  ASSERT result.valuation_amount_2 == BD列の値（万円→円変換後）
  ASSERT result.valuation_amount_3 == BE列の値（万円→円変換後）
END FOR
```

**Test Cases**:
1. **BC/BD/BE列に自動計算値がある売主**: 同期後、DBの査定額がBC/BD/BE列の値（万円→円変換後）になる
2. **CB/CC/CD列に手動入力値、BC/BD/BE列に自動計算値がある売主**: 同期後、DBの査定額がCB/CC/CD列の値（手動入力優先）になる
3. **CB/CC/CD列が空欄、BC/BD/BE列に自動計算値がある売主**: 同期後、DBの査定額がBC/BD/BE列の値になる

### Preservation Checking

**Goal**: 修正後も、査定額以外のフィールドの同期、優先順位ロジック、単位変換ロジックが正しく動作することを確認する。

**Pseudocode:**
```
FOR ALL seller DO
  同期を実行（修正前）
  result_before := DBから全フィールドを取得
  
  同期を実行（修正後）
  result_after := DBから全フィールドを取得
  
  // 査定額以外のフィールドは変更されていないことを確認
  ASSERT result_before.name == result_after.name
  ASSERT result_before.phone_number == result_after.phone_number
  ASSERT result_before.property_address == result_after.property_address
  
  // 優先順位ロジックが維持されていることを確認
  IF CB/CC/CD列に手動入力値がある THEN
    ASSERT result_after.valuation_amount_1 == CB列の値（手動入力優先）
  END IF
  
  // 単位変換ロジックが維持されていることを確認
  ASSERT result_after.valuation_amount_1 == スプレッドシートの値 * 10000
END FOR
```

**Testing Approach**: 修正前後で、査定額以外のフィールドの同期結果を比較し、変更がないことを確認します。

**Test Cases**:
1. **名前、電話番号、物件住所等の同期**: 修正前後で同じ値が同期される
2. **手動入力査定額の優先順位**: CB/CC/CD列に値がある場合、修正後もCB/CC/CD列の値が優先される
3. **単位変換**: 修正後も万円→円の変換（×10,000）が正しく行われる
4. **スプレッドシート取得範囲**: 修正後も`B:CZ`の範囲でデータが取得される

### Unit Tests

- `column-mapping.json`のマッピングが正しいことを確認するテスト
- `EnhancedAutoSyncService.ts`の同期ロジックが正しい列から値を取得することを確認するテスト
- 単位変換ロジック（万円→円）が正しく動作することを確認するテスト

### Property-Based Tests

- ランダムな売主データを生成し、同期後にDBの査定額がBC/BD/BE列の値（または手動入力値）になることを確認
- ランダムな売主データを生成し、査定額以外のフィールドが正しく同期されることを確認
- 優先順位ロジック（手動入力優先）が全ての売主で正しく動作することを確認

### Integration Tests

- 実際のスプレッドシートとDBを使用して、同期処理が正しく動作することを確認
- 通話モードページで査定額が正しく表示されることを確認
- 売主詳細ページで査定額が正しく表示されることを確認
