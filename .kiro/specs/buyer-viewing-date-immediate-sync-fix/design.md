# 買主5641内覧日・時間即時同期バグ修正 Design

## Overview

買主5641の内覧日・時間をブラウザUIで保存すると、データベースには正常に保存されるが、GASの定期同期（10分ごと、スプシ→DB）が実行されると内覧日・時間が白紙（null）に戻ってしまうバグを修正します。

根本原因は、DB→スプレッドシートの即時同期が機能していないため、スプレッドシートには古いデータ（空欄）が残ったままとなり、GASの定期同期がスプレッドシートの空欄をDBに上書きしてしまうことです。

修正方針は、`BuyerService.updateWithSync()`メソッドが既に実装している即時同期機能を活用し、内覧日・時間フィールドが正しくスプレッドシートに同期されるようにすることです。

## Glossary

- **Bug_Condition (C)**: ブラウザUIで買主の内覧日・時間を保存した後、GASの定期同期（10分ごと）が実行されると、内覧日・時間がnullに戻る条件
- **Property (P)**: ブラウザUIで保存した内覧日・時間が、GASの定期同期後も維持される（nullに戻らない）という期待される動作
- **Preservation**: 他の買主フィールドの即時同期、GASの定期同期、スプレッドシートからの手動編集など、既存の動作が変更されないこと
- **`BuyerService.updateWithSync()`**: 買主データをDBに保存し、即座にスプレッドシートに同期するメソッド（`backend/src/services/BuyerService.ts`）
- **`BuyerWriteService.updateFields()`**: 買主データをスプレッドシートに書き込むメソッド（`backend/src/services/BuyerWriteService.ts`）
- **`BuyerColumnMapper`**: DBフィールド名とスプレッドシートカラム名のマッピングを管理するクラス（`backend/src/services/BuyerColumnMapper.ts`）
- **`viewing_date`**: 内覧日を格納するDBカラム（DATE型）
- **`viewing_time`**: 内覧時間を格納するDBカラム（TIME型）
- **I列「●内覧日(最新）」**: スプレッドシートの内覧日カラム
- **BP列「●時間」**: スプレッドシートの内覧時間カラム

## Bug Details

### Bug Condition

バグは、ユーザーがブラウザUIで買主の内覧日・時間を保存した後、GASの定期同期（10分ごと、スプシ→DB）が実行されると発生します。`BuyerService.updateWithSync()`メソッドは、DBへの保存後にスプレッドシートへの即時同期を試みますが、何らかの理由で同期が失敗または実行されず、スプレッドシートには古いデータ（空欄）が残ったままとなります。その結果、GASの定期同期がスプレッドシートの空欄をDBに上書きし、内覧日・時間がnullに戻ります。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerNumber: string, viewingDate: Date, viewingTime: string }
  OUTPUT: boolean
  
  RETURN input.viewingDate IS NOT NULL
         AND input.viewingTime IS NOT NULL
         AND userSavedViaUI(input.buyerNumber, input.viewingDate, input.viewingTime)
         AND NOT spreadsheetSyncedImmediately(input.buyerNumber)
         AND gasPeriodicSyncExecuted()
         AND databaseValueIsNull(input.buyerNumber, 'viewing_date')
END FUNCTION
```

### Examples

- **例1**: 買主5641の内覧日を「2026/04/05」、内覧時間を「14:00」に設定 → DBには保存される → スプレッドシートには同期されない → 10分後、GASの定期同期が実行 → DBの内覧日・時間がnullに戻る
- **例2**: 買主7282の内覧日を「2026/04/06」、内覧時間を「10:00」に設定 → DBには保存される → スプレッドシートには同期されない → 10分後、GASの定期同期が実行 → DBの内覧日・時間がnullに戻る
- **例3**: 買主1234の名前を「田中太郎」に変更 → DBには保存される → スプレッドシートにも即座に同期される → 10分後、GASの定期同期が実行 → DBの名前は「田中太郎」のまま維持される（正常動作）
- **エッジケース**: 内覧日のみを設定（内覧時間は空欄） → DBには保存される → スプレッドシートには同期されない → 10分後、GASの定期同期が実行 → DBの内覧日がnullに戻る

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他の買主フィールド（名前、電話番号、メールアドレスなど）をブラウザUIで保存した場合、引き続きDBとスプレッドシートの両方に即座に同期される
- GASの定期同期（10分ごと、スプシ→DB）が内覧日・時間以外のフィールドを同期する動作は変更されない
- スプレッドシートで直接内覧日・時間を編集した場合、引き続きGASの定期同期でDBに反映される

**Scope:**
内覧日・時間以外のフィールドの保存・同期動作は、全て変更されません。これには以下が含まれます：
- 買主の基本情報（名前、電話番号、メールアドレスなど）
- 買主の希望条件（希望エリア、希望価格など）
- 買主のステータス（追客中、契約済みなど）

## Hypothesized Root Cause

バグの根本原因として、以下の可能性が考えられます：

1. **`BuyerColumnMapper`のマッピング不足**: `viewing_date`と`viewing_time`のDBフィールド名とスプレッドシートカラム名のマッピングが`buyer-column-mapping.json`に定義されていない、または誤っている可能性があります。

2. **`BuyerWriteService.updateFields()`の実装不足**: `viewing_date`と`viewing_time`フィールドを正しくスプレッドシート形式に変換していない可能性があります（例: DATE型を「YYYY/MM/DD」形式に変換、TIME型を「HH:MM」形式に変換）。

3. **フロントエンドからのAPI呼び出し不足**: フロントエンドが`/api/buyers/:id`エンドポイントを呼び出す際に、`viewing_date`と`viewing_time`フィールドを含めていない可能性があります。

4. **スプレッドシートの列位置の誤り**: I列「●内覧日(最新）」とBP列「●時間」の列位置が、`BuyerColumnMapper`で正しく認識されていない可能性があります。

## Correctness Properties

Property 1: Bug Condition - 内覧日・時間の即時同期

_For any_ 買主データの更新において、`viewing_date`または`viewing_time`フィールドが含まれる場合、修正後の`BuyerService.updateWithSync()`メソッドは、DBへの保存後、即座にスプレッドシート（I列「●内覧日(最新）」、BP列「●時間」）にも同期し、GASの定期同期が実行されても内覧日・時間が維持されるようにする。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他フィールドの即時同期

_For any_ 買主データの更新において、`viewing_date`と`viewing_time`以外のフィールドが含まれる場合、修正後のコードは、既存の即時同期動作を維持し、DBとスプレッドシートの両方に正しく同期する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の修正を実施します：

**File**: `backend/src/config/buyer-column-mapping.json`

**Specific Changes**:
1. **マッピング追加**: `spreadsheetToDatabase`セクションに`viewing_date`と`viewing_time`のマッピングを追加
   - `"●内覧日(最新）": "viewing_date"`
   - `"●時間": "viewing_time"`

2. **マッピング追加**: `databaseToSpreadsheet`セクションに`viewing_date`と`viewing_time`のマッピングを追加
   - `"viewing_date": "●内覧日(最新）"`
   - `"viewing_time": "●時間"`

3. **型変換定義**: `typeConversions`セクションに`viewing_date`と`viewing_time`の型を定義
   - `"viewing_date": "date"`
   - `"viewing_time": "time"`

**File**: `backend/src/services/BuyerColumnMapper.ts`

**Specific Changes**:
1. **日付フォーマット処理**: `mapDatabaseToSpreadsheet()`メソッドで、`viewing_date`フィールドを「YYYY/MM/DD」形式に変換する処理を追加

2. **時間フォーマット処理**: `mapDatabaseToSpreadsheet()`メソッドで、`viewing_time`フィールドを「HH:MM」形式に変換する処理を追加

**File**: `backend/src/services/BuyerWriteService.ts`

**Specific Changes**:
1. **デバッグログ追加**: `updateFields()`メソッドに、`viewing_date`と`viewing_time`フィールドの同期状況を記録するデバッグログを追加（既存のログに加えて）

**File**: フロントエンド（該当ファイルを特定後に追記）

**Specific Changes**:
1. **API呼び出し確認**: 買主の内覧日・時間を保存する際に、`/api/buyers/:id`エンドポイントに`viewing_date`と`viewing_time`フィールドを含めて送信しているか確認

2. **フィールド名確認**: フロントエンドが送信するフィールド名が、バックエンドの期待する名前（`viewing_date`, `viewing_time`）と一致しているか確認

## Testing Strategy

### Validation Approach

テスト戦略は、2段階のアプローチに従います：まず、修正前のコードでバグを再現し、根本原因を確認します。次に、修正後のコードで、内覧日・時間が正しく即時同期され、GASの定期同期後も維持されることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認または反証します。反証された場合は、再度根本原因を仮説立てします。

**Test Plan**: 買主5641の内覧日・時間をブラウザUIで保存し、DBには保存されるがスプレッドシートには同期されないことを確認します。その後、GASの定期同期を手動実行し、DBの内覧日・時間がnullに戻ることを確認します。

**Test Cases**:
1. **買主5641の内覧日・時間保存テスト**: ブラウザUIで内覧日「2026/04/05」、内覧時間「14:00」を保存 → DBを確認（保存されている） → スプレッドシートを確認（空欄のまま） → GASの定期同期を手動実行 → DBを確認（nullに戻っている）（修正前のコードで失敗）
2. **他フィールド保存テスト**: ブラウザUIで買主5641の名前を「テスト太郎」に変更 → DBを確認（保存されている） → スプレッドシートを確認（即座に同期されている） → GASの定期同期を手動実行 → DBを確認（「テスト太郎」のまま維持）（修正前のコードで成功）
3. **マッピング確認テスト**: `buyer-column-mapping.json`を確認 → `viewing_date`と`viewing_time`のマッピングが存在するか確認（修正前のコードで失敗の可能性）
4. **フロントエンドAPI呼び出し確認テスト**: ブラウザのDevToolsでネットワークタブを確認 → `/api/buyers/:id`エンドポイントへのリクエストボディに`viewing_date`と`viewing_time`が含まれているか確認（修正前のコードで失敗の可能性）

**Expected Counterexamples**:
- 内覧日・時間がスプレッドシートに同期されない
- 可能性のある原因: マッピング不足、フォーマット変換不足、フロントエンドからのフィールド送信不足

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して、期待される動作（内覧日・時間が即時同期され、GASの定期同期後も維持される）を検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateWithSync_fixed(input.buyerNumber, { viewing_date: input.viewingDate, viewing_time: input.viewingTime })
  ASSERT result.syncResult.success = true
  ASSERT spreadsheetValue(input.buyerNumber, 'viewing_date') = input.viewingDate
  ASSERT spreadsheetValue(input.buyerNumber, 'viewing_time') = input.viewingTime
  
  // GASの定期同期を実行
  executeGasPeriodicSync()
  
  ASSERT databaseValue(input.buyerNumber, 'viewing_date') = input.viewingDate
  ASSERT databaseValue(input.buyerNumber, 'viewing_time') = input.viewingTime
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力（内覧日・時間以外のフィールドの更新）に対して、既存の動作が維持されることを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateWithSync_original(input) = updateWithSync_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体にわたって多くのテストケースを自動生成する
- 手動のユニットテストでは見逃す可能性のあるエッジケースを検出する
- 内覧日・時間以外のフィールドの動作が変更されていないことを強力に保証する

**Test Plan**: 修正前のコードで、他フィールド（名前、電話番号など）の保存・同期動作を観察し、その動作を捕捉するproperty-based testを作成します。

**Test Cases**:
1. **名前フィールド保存テスト**: 修正前のコードで、買主の名前を変更し、DBとスプレッドシートの両方に即座に同期されることを確認 → 修正後のコードで同じテストを実行し、同じ動作を確認
2. **電話番号フィールド保存テスト**: 修正前のコードで、買主の電話番号を変更し、DBとスプレッドシートの両方に即座に同期されることを確認 → 修正後のコードで同じテストを実行し、同じ動作を確認
3. **複数フィールド同時保存テスト**: 修正前のコードで、買主の名前と電話番号を同時に変更し、DBとスプレッドシートの両方に即座に同期されることを確認 → 修正後のコードで同じテストを実行し、同じ動作を確認

### Unit Tests

- 買主5641の内覧日・時間をブラウザUIで保存し、DBとスプレッドシートの両方に即座に同期されることをテスト
- 内覧日のみを設定（内覧時間は空欄）した場合、DBとスプレッドシートの両方に即座に同期されることをテスト
- 内覧時間のみを設定（内覧日は空欄）した場合、DBとスプレッドシートの両方に即座に同期されることをテスト
- GASの定期同期を手動実行し、内覧日・時間が維持されることをテスト

### Property-Based Tests

- ランダムな買主データ（内覧日・時間を含む）を生成し、保存・同期が正しく動作することを検証
- ランダムな買主データ（内覧日・時間を含まない）を生成し、既存の保存・同期動作が維持されることを検証
- 多くのシナリオで、GASの定期同期後も内覧日・時間が維持されることをテスト

### Integration Tests

- ブラウザUIで買主の内覧日・時間を保存 → DBとスプレッドシートの両方に即座に同期 → GASの定期同期を実行 → 内覧日・時間が維持される、という全体フローをテスト
- 複数の買主の内覧日・時間を連続して保存し、全て正しく同期されることをテスト
- スプレッドシートで直接内覧日・時間を編集 → GASの定期同期でDBに反映される、という既存動作が維持されることをテスト
