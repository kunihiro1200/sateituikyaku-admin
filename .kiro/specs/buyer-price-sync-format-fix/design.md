# buyer-price-sync-format-fix バグ修正設計

## Overview

買主リストにおいて、DB→スプレッドシートへの即時同期時に価格フォーマットが壊れるバグを修正する。

**バグの概要**: DBの `buyers.price` カラムには `23800000`（円単位の数値）が保存されているが、DB→スプシ即時同期を実行すると `2380万円` という文字列がスプシのBR列「価格」に書き込まれてしまう。スプシには `23800000`（数値）で書き込まれるべきである。

**修正戦略**:
1. `backend/src/config/buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `"price": "価格"` のマッピングを追加する
2. `BuyerColumnMapper.formatValueForSpreadsheet` で `price` フィールドを `number` 型として正しく処理する（`typeConversions` に `"price": "number"` が既に定義されているため、フォーマット処理を追加する）

---

## Glossary

- **Bug_Condition (C)**: `price` フィールドが更新対象に含まれており、かつ `databaseToSpreadsheet` マッピングに `price` → `価格` のエントリが存在しないため、スプシへの書き込みがスキップされる（または万円文字列が書き込まれる）条件
- **Property (P)**: 価格フィールドをスプシに同期する際、円単位の数値（例: `23800000`）がそのまま数値として書き込まれるべき動作
- **Preservation**: 価格フィールド以外のフィールドの同期動作、およびフロントエンドの価格表示ロジックは変更しない
- **BuyerColumnMapper**: `backend/src/services/BuyerColumnMapper.ts` に定義されたクラス。`buyer-column-mapping.json` を読み込み、DBカラム名とスプシカラム名の相互変換を行う
- **databaseToSpreadsheet**: `buyer-column-mapping.json` 内のセクション。DBカラム名 → スプシカラム名のマッピングを定義する
- **mapDatabaseToSpreadsheet**: `BuyerColumnMapper` のメソッド。DBレコードをスプシ書き込み用の形式に変換する
- **updateWithSync**: `BuyerService` のメソッド。DB更新後に `BuyerWriteService.updateFields` を呼び出してスプシに同期する
- **formatValueForSpreadsheet**: `BuyerColumnMapper` のプライベートメソッド。スプシ出力用に値をフォーマットする

---

## Bug Details

### Bug Condition

バグは `price` フィールドを含む買主レコードをDB→スプシ即時同期する際に発生する。`BuyerColumnMapper.mapDatabaseToSpreadsheet` が `price` フィールドを処理する際、`databaseToSpreadsheet` マッピングに `"price": "価格"` のエントリが存在しないため、`price` フィールドがスプシカラム名に変換できず、書き込みがスキップされる。

また、フロントエンドで価格フィールドを編集・保存する際に、`2380万円` という万円表示の文字列をそのままAPIに送信している可能性がある（`BuyerDetailPage.tsx` の `type === 'price'` の表示変換ロジックが保存時にも適用される場合）。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerSyncRequest
  OUTPUT: boolean

  // priceフィールドが更新対象に含まれており、
  // かつdatabaseToSpreadsheetマッピングにpriceエントリが存在しない場合にtrueを返す
  RETURN "price" IN X.updatedFields
         AND "price" NOT IN databaseToSpreadsheetMapping.keys()
END FUNCTION
```

### Examples

- **例1（バグあり）**: 買主番号7363の `price` を `23800000` に更新してDB→スプシ同期 → スプシのBR列「価格」に何も書き込まれない（マッピング欠落のため）
- **例2（バグあり）**: フロントエンドで `2380万円` と表示されている価格フィールドを編集して保存 → `2380万円` という文字列がAPIに送信され、スプシに文字列として書き込まれる
- **例3（期待動作）**: 修正後、`price = 23800000` でDB→スプシ同期 → スプシのBR列「価格」に `23800000`（数値）が書き込まれる
- **エッジケース**: `price = null` または `price = 0` の場合 → スプシに空またはゼロが書き込まれる（正常動作を維持）

---

## Expected Behavior

### Preservation Requirements

**変化しない動作:**
- 価格フィールド以外のフィールド（氏名・電話番号・内覧日など）のDB→スプシ同期は引き続き正しく動作する
- 価格が未設定（null または 0）の買主レコードのDB→スプシ同期は引き続き正しく動作する
- フロントエンドの価格表示ロジック（`23800000` → `2380万円` の変換）は変更しない
- スプシ→DBへの同期（GASによる全件同期）は引き続き `23800000` という数値をDBの `price` カラムに正しく保存する

**スコープ:**
`price` フィールド以外のフィールドを含む全ての同期処理は、このバグ修正の影響を受けない。具体的には:
- 氏名・電話番号・メールアドレスなどの文字列フィールドの同期
- 内覧日・受付日などの日付フィールドの同期
- その他全ての `databaseToSpreadsheet` マッピング済みフィールドの同期

---

## Hypothesized Root Cause

調査の結果、根本原因は以下の2点であることが確認された:

1. **マッピング欠落（主要原因）**: `backend/src/config/buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `"price": "価格"` のエントリが存在しない
   - `spreadsheetToDatabaseExtended` セクションには `"価格": "price"` のマッピングが存在する（スプシ→DB方向は正常）
   - しかし `databaseToSpreadsheet` セクションには `price` キーが存在しない
   - `BuyerColumnMapper.mapDatabaseToSpreadsheet` は `databaseToSpreadsheet` セクションのみを参照するため、`price` フィールドがスキップされる

2. **フロントエンドの価格文字列送信（副次的原因）**: `BuyerDetailPage.tsx` の `formatDisplayValue` 関数（`type === 'price'` の分岐）が表示用に `2380万円` に変換するが、この変換後の文字列がAPIに送信される可能性がある
   - ただし、調査の結果 `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` には `price` フィールドの `InlineEditableField` が定義されていない
   - フロントエンドからの `price` フィールドの直接編集は現在のUIでは行われていない可能性が高い
   - 主要な修正対象はバックエンドのマッピング欠落である

3. **formatValueForSpreadsheetの数値処理**: `typeConversions` に `"price": "number"` が定義されているが、`formatValueForSpreadsheet` メソッドは `number` 型の特別処理を行っていない
   - 現状では `number` 型の値はそのまま返される（`return value`）
   - マッピングが追加されれば、DBの数値 `23800000` はそのまま数値としてスプシに書き込まれる

---

## Correctness Properties

Property 1: Bug Condition - 価格フィールドの正しい数値書き込み

_For any_ 買主レコードの更新において `price` フィールドが更新対象に含まれる場合、修正後の `mapDatabaseToSpreadsheet` 関数は `price` フィールドを `"価格"` スプシカラムにマッピングし、円単位の数値（例: `23800000`）をそのまま数値として書き込むものとする。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - 価格以外のフィールドへの影響なし

_For any_ 買主レコードの更新において `price` フィールドが更新対象に含まれない場合（または `price` フィールドが存在しない場合）、修正後の `mapDatabaseToSpreadsheet` 関数は修正前と同一の結果を返し、既存の全フィールドの同期動作を保全するものとする。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を行う:

**File 1**: `backend/src/config/buyer-column-mapping.json`

**変更内容**: `databaseToSpreadsheet` セクションに `"price": "価格"` のエントリを追加する

**具体的な変更**:
```json
// 変更前（databaseToSpreadsheetセクションの末尾付近）
"building_name_price": "建物名/価格 内覧物件は赤表示（★は他社物件）"

// 変更後
"building_name_price": "建物名/価格 内覧物件は赤表示（★は他社物件）",
"price": "価格"
```

**File 2**: `backend/src/services/BuyerColumnMapper.ts`（必要に応じて）

**変更内容**: `formatValueForSpreadsheet` メソッドで `number` 型の値を明示的に数値として返す処理を追加する（現状でも数値はそのまま返されるが、明示的に処理することで意図を明確にする）

**具体的な変更**:
```typescript
// number型: 数値をそのまま返す（文字列変換しない）
if (type === 'number' && value !== null && value !== undefined) {
  const num = Number(value);
  return isNaN(num) ? value : num;
}
```

**変更の優先順位**:
1. **必須**: `buyer-column-mapping.json` への `"price": "価格"` 追加
2. **推奨**: `formatValueForSpreadsheet` への `number` 型処理追加（堅牢性向上のため）

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される:
1. **探索フェーズ**: 未修正コードでバグを再現し、根本原因を確認する
2. **検証フェーズ**: 修正後のコードでバグが解消され、既存動作が保全されることを確認する

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `BuyerColumnMapper.mapDatabaseToSpreadsheet` に `{ price: 23800000 }` を渡し、結果に `"価格"` キーが存在しないことを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **マッピング欠落テスト**: `mapDatabaseToSpreadsheet({ price: 23800000 })` を呼び出し、結果に `"価格"` キーが存在しないことを確認（未修正コードで失敗）
2. **文字列書き込みテスト**: `mapDatabaseToSpreadsheet({ price: '2380万円' })` を呼び出し、結果に `"価格": '2380万円'` が含まれることを確認（未修正コードで失敗）
3. **数値書き込みテスト**: `mapDatabaseToSpreadsheet({ price: 23800000 })` を呼び出し、結果に `"価格": 23800000` が含まれることを確認（未修正コードで失敗）
4. **null価格テスト**: `mapDatabaseToSpreadsheet({ price: null })` を呼び出し、結果に `"価格": ''` が含まれることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `mapDatabaseToSpreadsheet({ price: 23800000 })` の結果に `"価格"` キーが存在しない
- 原因: `databaseToSpreadsheet` セクションに `"price"` エントリが存在しない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待動作が実現されることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := mapDatabaseToSpreadsheet_fixed({ price: X.price })
  ASSERT "価格" IN result.keys()
  ASSERT typeof(result["価格"]) = "number"
  ASSERT result["価格"] = X.price  // 円単位の数値がそのまま書き込まれる
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、`price` フィールドを含まない全ての入力に対して修正前と同一の結果が返されることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT mapDatabaseToSpreadsheet_original(X) = mapDatabaseToSpreadsheet_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由:
- `databaseToSpreadsheet` マッピングに含まれる全フィールド（40以上）に対して自動的にテストケースを生成できる
- `price` 以外のフィールドへの影響がないことを網羅的に確認できる
- エッジケース（null値、空文字列、特殊文字など）を自動的にカバーできる

**Test Cases**:
1. **既存フィールド保全テスト**: `name`, `phone_number`, `viewing_date` など既存マッピング済みフィールドの変換結果が修正前後で同一であることを確認
2. **null値保全テスト**: 各フィールドに `null` を渡した場合の変換結果が修正前後で同一であることを確認
3. **日付フィールド保全テスト**: `viewing_date`, `reception_date` などの日付フィールドの変換結果が修正前後で同一であることを確認

### Unit Tests

- `mapDatabaseToSpreadsheet({ price: 23800000 })` が `{ "価格": 23800000 }` を返すことを確認
- `mapDatabaseToSpreadsheet({ price: null })` が `{ "価格": '' }` を返すことを確認
- `mapDatabaseToSpreadsheet({ price: 0 })` が `{ "価格": 0 }` を返すことを確認
- `mapDatabaseToSpreadsheet({ name: '田中太郎', price: 23800000 })` が `{ "●氏名・会社名": '田中太郎', "価格": 23800000 }` を返すことを確認

### Property-Based Tests

- ランダムな正の整数を `price` として渡した場合、結果の `"価格"` が同じ数値であることを確認
- `price` 以外の全マッピング済みフィールドに対して、修正前後で変換結果が同一であることを確認
- `price` フィールドを含まないランダムなレコードに対して、修正前後で変換結果が同一であることを確認

### Integration Tests

- `BuyerService.updateWithSync` で `price` フィールドを更新した場合、スプシのBR列「価格」に円単位の数値が書き込まれることを確認
- `price` フィールドと他のフィールドを同時に更新した場合、全フィールドが正しくスプシに書き込まれることを確認
- `price = null` の買主レコードを同期した場合、スプシのBR列「価格」が空になることを確認
