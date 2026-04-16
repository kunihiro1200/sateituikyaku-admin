# 買主物件番号スプレッドシート同期バグ Bugfix Design

## Overview

買主詳細画面で物件番号を手動入力して保存する際、スプレッドシートへの即時同期が行われないバグ。
その後GASの同期が実行されると、スプレッドシート側の物件番号フィールドが空欄で上書きされてしまう。

**根本原因は2箇所に存在する：**

1. **フロントエンド側**: `handleSavePropertyNumber` が `sync=false` パラメータ付きでAPIを呼び出しているため、スプレッドシートへの即時同期が意図的にスキップされている
2. **バックエンド設定側**: `buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `property_number` のマッピングが欠落しているため、GAS同期時にスプレッドシートの物件番号フィールドが空欄で上書きされる

## Glossary

- **Bug_Condition (C)**: 買主詳細画面で物件番号を入力して保存した際に、スプレッドシートへの即時同期が行われない状態
- **Property (P)**: 物件番号保存時にスプレッドシートへ即時同期され、かつGAS同期後も物件番号が保持される正しい動作
- **Preservation**: 物件番号以外のフィールド更新時の即時保存処理、および物件番号が未入力の買主に対するGAS同期処理が変更されないこと
- **handleSavePropertyNumber**: `frontend/frontend/src/pages/BuyerDetailPage.tsx` 内の物件番号保存ハンドラー関数
- **sync=false**: `PUT /api/buyers/:id` エンドポイントのクエリパラメータ。明示的に指定された場合のみスプレッドシート同期をスキップする
- **databaseToSpreadsheet**: `backend/src/config/buyer-column-mapping.json` 内のDBカラム名→スプレッドシートカラム名のマッピング定義
- **BuyerColumnMapper**: DBレコードをスプレッドシート形式に変換するサービス（`backend/src/services/BuyerColumnMapper.ts`）
- **updateWithSync**: `BuyerService` のメソッド。DB更新とスプレッドシート同期を順番に実行する
- **BuyerSyncService**: GASからトリガーされるスプレッドシート→DB同期サービス（`backend/src/services/BuyerSyncService.ts`）

## Bug Details

### Bug Condition

バグは2段階で発生する：

**第1段階**: 買主詳細画面で物件番号を入力して「保存」ボタンを押した際、`handleSavePropertyNumber` が `sync=false` パラメータ付きでAPIを呼び出す。バックエンドの `PUT /api/buyers/:id` ルートは `sync=false` が明示的に指定された場合のみ同期をスキップするため、スプレッドシートへの即時保存が行われない。

**第2段階**: その後GASの同期が実行されると、`BuyerSyncService.processBatch` がスプレッドシートの全行を読み込み `mapSpreadsheetToDatabase` でDBに上書きする。スプレッドシートの物件番号列（`物件番号`）は空欄のままなので、DBの `property_number` が `null` で上書きされる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, buyerNumber: string, propertyNumber: string }
  OUTPUT: boolean

  RETURN input.action = "savePropertyNumber"
         AND input.propertyNumber IS NOT NULL AND input.propertyNumber != ""
         AND apiCallUsesSync_false(input)
         AND databaseToSpreadsheetMapping.property_number IS MISSING
END FUNCTION
```

### Examples

- **例1（第1段階バグ）**: 買主番号7360の詳細画面で物件番号「AA1234」を入力して保存 → DBには保存されるが、スプレッドシートの物件番号列は空欄のまま
- **例2（第2段階バグ）**: 上記の状態でGAS同期が実行される → スプレッドシートの空欄の物件番号でDBが上書きされ、DBの `property_number` が `null` になる
- **例3（正常ケース）**: 氏名や電話番号を更新した場合 → `sync=false` なしでAPIが呼ばれるため、スプレッドシートへの即時同期が正常に行われる
- **エッジケース**: `databaseToSpreadsheet` に `property_number` が追加されても、フロントエンドが `sync=false` を使い続ける限り第1段階のバグは残る

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 物件番号以外のフィールド（氏名、電話番号、次電日など）を更新した際のスプレッドシートへの即時保存処理は引き続き正常に動作しなければならない
- 物件番号が入力されていない買主に対してGAS同期が実行された際、他のフィールドの同期は引き続き正常に動作しなければならない
- 物件番号が正しく保存済みの買主に対してGAS同期が実行された際、物件番号は引き続き保持されなければならない

**Scope:**
物件番号の保存処理（`handleSavePropertyNumber`）以外の全ての更新処理は、このバグ修正によって影響を受けてはならない。具体的には：
- 他のフィールドのAPI呼び出し（`sync=false` なし）
- GAS同期処理の全体的な動作
- 物件番号バリデーション処理（`/api/buyers/validate-property-number`）

## Hypothesized Root Cause

コード調査により、根本原因は以下の2箇所に確定している：

1. **フロントエンドの `sync=false` 指定（主因）**:
   `frontend/frontend/src/pages/BuyerDetailPage.tsx` の `handleSavePropertyNumber` 関数が以下のようにAPIを呼び出している：
   ```typescript
   await api.put(`/api/buyers/${buyer_number}?sync=false`, {
     property_number: manualPropertyNumber.trim(),
   });
   ```
   バックエンドの `PUT /api/buyers/:id` ルートは `sync === 'false'` の場合に `buyerService.update()` を呼び出し、スプレッドシート同期を完全にスキップする。他のフィールド更新では `sync=false` を使用していないため、物件番号だけが同期されない。

2. **`databaseToSpreadsheet` マッピングの欠落（副因）**:
   `backend/src/config/buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `property_number` のエントリが存在しない：
   ```json
   // spreadsheetToDatabase には存在する
   "物件番号": "property_number"
   
   // databaseToSpreadsheet には存在しない（← バグ）
   // "property_number": "物件番号" が欠落
   ```
   これにより、仮にフロントエンドが `sync=false` なしでAPIを呼び出しても、`BuyerColumnMapper.mapDatabaseToSpreadsheet` が `property_number` を変換できず、スプレッドシートへの書き込みが行われない。
   
   さらに、GAS同期（`BuyerSyncService.processBatch`）はスプレッドシートの全フィールドをDBに上書きするため、スプレッドシートの物件番号列が空欄の場合、DBの `property_number` が `null` で上書きされる。

3. **`other_company_property_info` も同様の問題**:
   同じコミットで追加された `handleSaveOtherCompanyPropertyInfo` も `sync=false` を使用しているが、こちらは `databaseToSpreadsheet` に `other_company_property_info` のマッピングが存在するかどうかも確認が必要。

## Correctness Properties

Property 1: Bug Condition - 物件番号保存時のスプレッドシート即時同期

_For any_ 買主詳細画面での物件番号入力保存操作（`handleSavePropertyNumber` が呼ばれる入力）において、バグ条件が成立する（`sync=false` が指定されている、かつ `databaseToSpreadsheet` に `property_number` が欠落している）場合、修正後の処理は物件番号をスプレッドシートに即時保存しなければならない（SHALL）。

**Validates: Requirements 2.1**

Property 2: Preservation - GAS同期後の物件番号保持

_For any_ GAS同期実行時において、DBに `property_number` が保存済みの買主に対して、修正後のシステムはスプレッドシートの物件番号フィールドを空欄で上書きしてはならず、DBの値を保持しなければならない（SHALL）。

**Validates: Requirements 2.2**

Property 3: Preservation - 他フィールドの即時保存継続

_For any_ 物件番号以外のフィールド更新操作において、バグ条件が成立しない（`isBugCondition` が false を返す）場合、修正後の処理は元の処理と同一の結果を生成し、スプレッドシートへの即時保存が引き続き正常に動作しなければならない（SHALL CONTINUE TO）。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の2ファイルを修正する：

**修正1: フロントエンド**

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Function**: `handleSavePropertyNumber`

**Specific Changes**:
1. **`sync=false` パラメータを削除**: `api.put` の呼び出しから `?sync=false` を除去し、スプレッドシートへの即時同期を有効にする
   ```typescript
   // 修正前
   await api.put(`/api/buyers/${buyer_number}?sync=false`, {
     property_number: manualPropertyNumber.trim(),
   });
   
   // 修正後
   await api.put(`/api/buyers/${buyer_number}`, {
     property_number: manualPropertyNumber.trim(),
   });
   ```

---

**修正2: バックエンド設定**

**File**: `backend/src/config/buyer-column-mapping.json`

**Section**: `databaseToSpreadsheet`

**Specific Changes**:
1. **`property_number` マッピングを追加**: `databaseToSpreadsheet` セクションに `property_number → 物件番号` のエントリを追加する
   ```json
   "databaseToSpreadsheet": {
     "buyer_number": "買主番号",
     "property_number": "物件番号",  // ← 追加
     ...
   }
   ```

---

**注意事項**:
- `handleSaveOtherCompanyPropertyInfo` も `sync=false` を使用しているが、こちらは別途確認が必要（本バグの対象外）
- `databaseToSpreadsheet` への追加により、`updateWithSync` 経由の更新時に `BuyerColumnMapper.mapDatabaseToSpreadsheet` が `property_number` を正しくスプレッドシートカラム名に変換できるようになる

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: 
- フロントエンドの `handleSavePropertyNumber` が `sync=false` でAPIを呼び出していることをコードレビューで確認
- `buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `property_number` が欠落していることを確認
- 買主番号7360で実際にバグが発生することを確認

**Test Cases**:
1. **物件番号保存テスト**: 買主番号7360の詳細画面で物件番号を入力して保存 → スプレッドシートの物件番号列が空欄のままであることを確認（未修正コードで失敗）
2. **GAS同期後の上書きテスト**: 上記の状態でGAS同期を実行 → DBの `property_number` が `null` になることを確認（未修正コードで失敗）
3. **マッピング欠落テスト**: `BuyerColumnMapper.mapDatabaseToSpreadsheet({ property_number: 'AA1234' })` を呼び出す → 結果が空オブジェクトになることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `handleSavePropertyNumber` が `sync=false` でAPIを呼び出しているため、スプレッドシートへの書き込みが行われない
- `databaseToSpreadsheet` に `property_number` が欠落しているため、`mapDatabaseToSpreadsheet` が `property_number` を変換できない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の処理が正しい動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSavePropertyNumber_fixed(input)
  ASSERT spreadsheetPropertyNumberField(input.buyerNumber) = input.propertyNumber
  ASSERT databasePropertyNumber(input.buyerNumber) = input.propertyNumber
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の処理が元の処理と同一の結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleUpdate_original(input) = handleUpdate_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な買主データと更新フィールドの組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 物件番号以外の全フィールドの動作が変わらないことを強く保証できる

**Test Cases**:
1. **他フィールド更新の保持**: 氏名・電話番号・次電日などの更新が引き続きスプレッドシートに即時同期されることを確認
2. **物件番号未入力買主のGAS同期保持**: 物件番号が未入力の買主に対してGAS同期を実行しても、他のフィールドが正常に同期されることを確認
3. **物件番号保存済み買主のGAS同期保持**: 物件番号が正しく保存済みの買主に対してGAS同期を実行しても、物件番号が保持されることを確認

### Unit Tests

- `BuyerColumnMapper.mapDatabaseToSpreadsheet` に `property_number` を渡した際に `物件番号` カラムにマッピングされることをテスト
- `handleSavePropertyNumber` が `sync=false` なしでAPIを呼び出すことをテスト（モック使用）
- `PUT /api/buyers/:id` が `sync=false` なしで呼ばれた際に `updateWithSync` が実行されることをテスト

### Property-Based Tests

- ランダムな買主番号と物件番号の組み合わせを生成し、保存後にスプレッドシートに正しく反映されることを検証
- ランダムな買主データを生成し、物件番号以外のフィールド更新が修正前後で同一の動作をすることを検証
- 多様なGAS同期シナリオを生成し、物件番号が保存済みの買主の物件番号が保持されることを検証

### Integration Tests

- 買主詳細画面で物件番号を入力して保存 → スプレッドシートに即時反映されることを確認
- 物件番号保存後にGAS同期を実行 → 物件番号が保持されることを確認
- 物件番号以外のフィールドを更新 → 修正前後で動作が変わらないことを確認
