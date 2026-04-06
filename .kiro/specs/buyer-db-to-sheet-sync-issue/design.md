# 買主リスト「●問合時ヒアリング」同期不具合修正 Design

## Overview

買主リストの詳細画面において、データベースの`inquiry_hearing`フィールド（スプレッドシート列名：「●問合時ヒアリング」）を更新しても、スプレッドシートへ即時同期されない不具合を修正します。

この不具合により、買主詳細画面で「●問合時ヒアリング」を入力・更新しても、スプレッドシートに反映されない状態が発生しています（買主番号7294で確認）。他のフィールドは正常に同期されており、この列のみが同期されない状況です。

過去に同様の即時同期機能が実装されており（コミット`49672ef7`、`0d9f517a`）、`BuyerWriteService.updateRowPartial`を使用して数式を上書きしないように実装されています。

## Glossary

- **Bug_Condition (C)**: `inquiry_hearing`フィールドがデータベースで更新されたが、スプレッドシートに反映されない状態
- **Property (P)**: `inquiry_hearing`フィールドの更新がスプレッドシートに即座に反映される
- **Preservation**: 他のフィールドの同期機能、数式保護機能、HTMLストリップ処理が変更されないこと
- **inquiry_hearing**: データベースの`inquiry_hearing`カラム（スプレッドシート列名：「●問合時ヒアリング」）
- **BuyerWriteService**: 買主データをスプレッドシートに書き込むサービス（`backend/src/services/BuyerWriteService.ts`）
- **BuyerColumnMapper**: データベースとスプレッドシートのカラムマッピングを管理するサービス（`backend/src/services/BuyerColumnMapper.ts`）
- **updateRowPartial**: スプレッドシートの行を部分更新するメソッド（数式を上書きしない）

## Bug Details

### Bug Condition

買主詳細画面で「●問合時ヒアリング」フィールドを更新した際、データベースには保存されるが、スプレッドシートに即時同期されない。`BuyerService.updateWithSync`が呼び出され、`BuyerWriteService.updateFields`が実行されるが、スプレッドシートに反映されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, buyerNumber: string, newValue: any }
  OUTPUT: boolean
  
  RETURN input.fieldName == 'inquiry_hearing'
         AND databaseUpdateSuccessful(input.buyerNumber, input.fieldName, input.newValue)
         AND NOT spreadsheetUpdated(input.buyerNumber, input.fieldName, input.newValue)
END FUNCTION
```

### Examples

- **買主番号7294**: 「●問合時ヒアリング」に「テスト内容」を入力 → データベースには保存されるが、スプレッドシートのM列（「●問合時ヒアリング」）は空のまま
- **買主番号7294**: 「●問合時ヒアリング」に「<p>HTMLタグ付き</p>」を入力 → データベースには保存されるが、スプレッドシートには反映されない
- **買主番号7294**: 「●氏名・会社名」を更新 → データベースとスプレッドシートの両方に正常に反映される（他のフィールドは正常）
- **Edge Case**: 「●問合時ヒアリング」を空文字に更新 → データベースには`null`が保存されるが、スプレッドシートには反映されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のフィールド（「●氏名・会社名」「●内覧日(最新）」「●希望時期」など）の即時同期機能は変更されない
- `BuyerWriteService.updateRowPartial`による数式保護機能は変更されない
- 他のHTMLフィールド（`viewing_result_follow_up`、`message_to_assignee`）のHTMLストリップ処理は変更されない

**Scope:**
`inquiry_hearing`以外のフィールドの更新は、全て既存の動作を維持する。スプレッドシートからデータベースへの同期（逆方向）も変更されない。

## Hypothesized Root Cause

ユーザーから提供された情報と過去の実装（コミット`0d9f517a`）を参考に、以下の根本原因を仮説として立てます：

1. **`BuyerColumnMapper.mapDatabaseToSpreadsheet`で`inquiry_hearing`のマッピングが漏れている可能性**
   - `buyer-column-mapping.json`には`inquiry_hearing`のマッピングが存在する（確認済み）
   - しかし、`BuyerColumnMapper.mapDatabaseToSpreadsheet`メソッドで`databaseToSpreadsheet`マッピングを使用する際に、`inquiry_hearing`が除外されている可能性がある

2. **HTMLストリップ処理が`inquiry_hearing`に適用されていない可能性**
   - `BuyerColumnMapper.formatValueForSpreadsheet`メソッドで、HTMLフィールドのリストに`inquiry_hearing`が含まれていない可能性がある
   - 現在のコード: `const htmlFields = ['inquiry_hearing', 'viewing_result_follow_up', 'message_to_assignee'];`
   - しかし、実際には`inquiry_hearing`が処理されていない可能性がある

3. **`BuyerWriteService.updateFields`で`inquiry_hearing`が除外されている可能性**
   - `updateFields`メソッドで特定のフィールドをフィルタリングしている可能性がある
   - ただし、現在のコードを確認した限りでは、そのような処理は見当たらない

4. **`updateRowPartial`の呼び出し前に`inquiry_hearing`がフィルタリングされている可能性**
   - `mapDatabaseToSpreadsheet`の結果から`inquiry_hearing`が除外されている可能性がある

## Correctness Properties

Property 1: Bug Condition - inquiry_hearingフィールドの即時同期

_For any_ 買主詳細画面での`inquiry_hearing`フィールドの更新において、データベース更新が成功した場合、修正後のシステムSHALLスプレッドシートの「●問合時ヒアリング」列を即座に更新し、HTMLタグが含まれる場合はプレーンテキストに変換してから書き込む。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他のフィールドの同期機能

_For any_ `inquiry_hearing`以外のフィールドの更新において、修正後のシステムSHALL既存の即時同期機能を維持し、数式保護機能とHTMLストリップ処理を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の仮説に基づき、以下の変更を実施します：

**File**: `backend/src/services/BuyerColumnMapper.ts`

**Function**: `mapDatabaseToSpreadsheet`

**Specific Changes**:
1. **マッピング確認**: `databaseToSpreadsheet`マッピングに`inquiry_hearing`が含まれているか確認
   - `buyer-column-mapping.json`の`databaseToSpreadsheet`セクションに`"inquiry_hearing": "●問合時ヒアリング"`が存在するか確認
   - 存在しない場合は追加する

2. **HTMLストリップ処理の確認**: `formatValueForSpreadsheet`メソッドで`inquiry_hearing`がHTMLフィールドとして認識されているか確認
   - `const htmlFields = ['inquiry_hearing', 'viewing_result_follow_up', 'message_to_assignee'];`
   - `inquiry_hearing`が含まれていることを確認

3. **デバッグログの追加**: `mapDatabaseToSpreadsheet`メソッドに詳細なログを追加して、`inquiry_hearing`がマッピングされているか確認
   - `console.log`で`inquiry_hearing`のマッピング結果を出力

4. **`BuyerWriteService.updateFields`の確認**: `updateFields`メソッドで`inquiry_hearing`が除外されていないか確認
   - 現在のコードでは特にフィルタリング処理は見当たらないが、念のため確認

5. **テスト**: 買主番号7294で「●問合時ヒアリング」を更新して、スプレッドシートに反映されるか確認

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、未修正コードでバグを再現し、根本原因を特定します。次に、修正後のコードで正しく動作することを確認し、既存機能が保持されていることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認または反証する。反証された場合は、再度仮説を立てる。

**Test Plan**: 買主番号7294で「●問合時ヒアリング」を更新し、データベースには保存されるがスプレッドシートに反映されないことを確認する。`BuyerColumnMapper.mapDatabaseToSpreadsheet`と`BuyerWriteService.updateFields`にデバッグログを追加して、`inquiry_hearing`がどの段階で除外されているか特定する。

**Test Cases**:
1. **買主番号7294でinquiry_hearingを更新**: 「テスト内容」を入力 → データベースには保存されるが、スプレッドシートには反映されない（未修正コードで失敗）
2. **mapDatabaseToSpreadsheetのログ確認**: `inquiry_hearing`がマッピングされているか確認 → マッピングが漏れている可能性（未修正コードで失敗）
3. **updateFieldsのログ確認**: `formattedValues`に`inquiry_hearing`が含まれているか確認 → 含まれていない可能性（未修正コードで失敗）
4. **HTMLタグ付きinquiry_hearingを更新**: 「<p>HTMLタグ付き</p>」を入力 → HTMLストリップ処理が適用されていない可能性（未修正コードで失敗）

**Expected Counterexamples**:
- `inquiry_hearing`が`mapDatabaseToSpreadsheet`の結果に含まれていない
- Possible causes: `databaseToSpreadsheet`マッピングに`inquiry_hearing`が含まれていない、`formatValueForSpreadsheet`で`inquiry_hearing`が処理されていない

### Fix Checking

**Goal**: `inquiry_hearing`フィールドの更新がスプレッドシートに即座に反映されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := BuyerWriteService.updateFields_fixed(input.buyerNumber, { inquiry_hearing: input.newValue })
  ASSERT spreadsheetUpdated(input.buyerNumber, 'inquiry_hearing', input.newValue)
END FOR
```

### Preservation Checking

**Goal**: `inquiry_hearing`以外のフィールドの更新において、既存の同期機能が変更されていないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT BuyerWriteService.updateFields_original(input.buyerNumber, input.updates) 
         = BuyerWriteService.updateFields_fixed(input.buyerNumber, input.updates)
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを検出する
- 全ての非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 未修正コードで他のフィールド（「●氏名・会社名」「●内覧日(最新）」など）の動作を観察し、その後、修正後のコードで同じ動作が維持されていることを確認するプロパティベーステストを作成する。

**Test Cases**:
1. **他のフィールドの同期保持**: 未修正コードで「●氏名・会社名」を更新 → スプレッドシートに正常に反映されることを確認し、修正後も同じ動作が維持されることをテスト
2. **数式保護機能の保持**: 未修正コードでスプレッドシートの数式列を確認 → 修正後も数式が上書きされていないことをテスト
3. **HTMLストリップ処理の保持**: 未修正コードで`viewing_result_follow_up`にHTMLタグを含む値を更新 → プレーンテキストに変換されることを確認し、修正後も同じ動作が維持されることをテスト
4. **スプレッドシートからDBへの同期保持**: 未修正コードでスプレッドシートの「●問合時ヒアリング」を更新 → データベースに正常に反映されることを確認し、修正後も同じ動作が維持されることをテスト

### Unit Tests

- 買主番号7294で「●問合時ヒアリング」を更新し、スプレッドシートに反映されることをテスト
- HTMLタグを含む「●問合時ヒアリング」を更新し、プレーンテキストに変換されることをテスト
- 空文字の「●問合時ヒアリング」を更新し、スプレッドシートに空文字が反映されることをテスト
- 他のフィールド（「●氏名・会社名」など）を更新し、既存の同期機能が維持されることをテスト

### Property-Based Tests

- ランダムな買主番号と`inquiry_hearing`の値を生成し、スプレッドシートに正しく反映されることを検証
- ランダムなHTMLタグを含む`inquiry_hearing`の値を生成し、プレーンテキストに変換されることを検証
- ランダムな他のフィールドの値を生成し、既存の同期機能が維持されることを検証

### Integration Tests

- 買主詳細画面で「●問合時ヒアリング」を入力し、保存ボタンをクリック → スプレッドシートに即座に反映されることをテスト
- 買主詳細画面で「●問合時ヒアリング」にHTMLタグを含む値を入力し、保存 → スプレッドシートにプレーンテキストとして反映されることをテスト
- 買主詳細画面で他のフィールドを更新し、既存の同期機能が維持されることをテスト
