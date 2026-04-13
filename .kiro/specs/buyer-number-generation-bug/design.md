# 買主番号採番バグ 修正設計ドキュメント

## Overview

買主リストで新規買主を登録する際、採番スプレッドシートから取得した現在の最大番号（例: 7358）に +1 を加算すべきところ、文字列連結により桁が増えた番号（73581）が登録されてしまうバグ。

`BuyerNumberSpreadsheetClient.getNextBuyerNumber()` は `parseInt` を使って数値変換しているが、`writeRawCell` が `valueInputOption: 'RAW'` で文字列として書き込むため、次回読み取り時にスプレッドシートが文字列型の値を返す可能性がある。また、`getNextBuyerNumber()` の戻り値は `String(n + 1)` で正しく文字列化されているが、呼び出し元の `BuyerService.create()` や上位層で文字列連結が発生している可能性もある。

修正方針は、採番パイプライン全体を通じて数値型の整合性を保証することで、文字列連結が発生しないようにする。

## Glossary

- **Bug_Condition (C)**: 採番処理において文字列連結が発生し、誤った買主番号が生成される条件
- **Property (P)**: 正しい採番動作 — 現在の最大番号を数値として +1 加算した結果が返される
- **Preservation**: 既存の正常動作（エラーハンドリング、スプレッドシート更新、DB保存）が変わらないこと
- **getNextBuyerNumber**: `BuyerNumberSpreadsheetClient` のメソッド。採番スプレッドシートのセルから現在の最大番号を読み取り、+1 した値を文字列で返す
- **writeRawCell**: `GoogleSheetsClient` のメソッド。`valueInputOption: 'RAW'` でセルに値を書き込む（文字列として保存される）
- **readRawRange**: `GoogleSheetsClient` のメソッド。セルの値を `string[][]` として読み取る
- **rawValue**: スプレッドシートから読み取った生の値。型は `string | null | undefined`

## Bug Details

### Bug Condition

採番スプレッドシートのセルに現在の最大買主番号が格納されている状態で `getNextBuyerNumber()` を呼び出したとき、数値加算ではなく文字列連結により誤った番号が生成される。

`BuyerNumberSpreadsheetClient.getNextBuyerNumber()` 内では `parseInt(String(rawValue), 10)` で正しく数値変換しているが、`writeRawCell` が `valueInputOption: 'RAW'` で書き込むため、スプレッドシートはセルの値を文字列型として保存する。次回読み取り時に `readRawRange` が文字列 `"7359"` を返すため、`parseInt` は正しく動作するはずだが、何らかの経路で文字列連結が発生している。

根本原因の候補として、`getNextBuyerNumber()` の戻り値 `String(n + 1)` が正しく `"7359"` を返しているにもかかわらず、呼び出し元の `BuyerService.create()` または `generateBuyerNumber()` の戻り値を受け取る箇所で型の混乱が生じている可能性がある。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { rawCellValue: string | number | null | undefined }
  OUTPUT: boolean

  // スプレッドシートのセルに有効な数値が格納されている
  IF input.rawCellValue IS null OR input.rawCellValue IS undefined OR input.rawCellValue === ''
    RETURN false  // エラーケース（別途エラーをスロー）
  END IF

  n = parseInt(String(input.rawCellValue), 10)
  IF isNaN(n)
    RETURN false  // エラーケース（別途エラーをスロー）
  END IF

  // バグ条件: 採番結果が数値加算ではなく文字列連結になっている
  result = getNextBuyerNumber(input.rawCellValue)
  RETURN result !== String(n + 1)
END FUNCTION
```

### Examples

- セルに `7358`（文字列型）が格納 → `parseInt("7358", 10) + 1 = 7359` → `String(7359) = "7359"` が期待値だが、実際は `"73581"` が返される
- セルに `7358`（数値型）が格納 → 同様に `"7359"` が期待値
- セルに `1`（文字列型）が格納 → `"2"` が期待値
- セルに `9999`（文字列型）が格納 → `"10000"` が期待値（桁上がりのエッジケース）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 採番スプレッドシートへのアクセスが失敗した場合、エラーをスローして登録を中断する
- 採番スプレッドシートのセルが空欄または数値でない値を含む場合、適切なエラーメッセージをスローする
- 新規買主登録が成功した後、採番スプレッドシートのセルを新しい買主番号で更新する
- 買主データが Supabase の `buyers` テーブルに正しく保存される
- 買主登録後に買主リストスプレッドシートへの行追加が試みられる

**スコープ:**
バグ条件（採番処理での文字列連結）に関係しない入力はすべて影響を受けない。具体的には:
- 既存買主の更新処理
- 買主の検索・取得処理
- スプレッドシートアクセスエラー時のエラーハンドリング
- 空欄・非数値セルのエラーハンドリング

## Hypothesized Root Cause

コードを調査した結果、以下の根本原因が考えられる:

1. **writeRawCell による文字列保存**: `writeRawCell` が `valueInputOption: 'RAW'` で書き込むため、スプレッドシートはセルの値を文字列型として保存する。次回 `readRawRange` で読み取ると文字列 `"7359"` が返る。`parseInt("7359", 10)` は正しく `7359` を返すため、このパスは正常に動作するはず。

2. **getNextBuyerNumber の戻り値の型**: `getNextBuyerNumber()` は `String(n + 1)` を返すため、戻り値は常に文字列型。`BuyerService.create()` では `buyer_number: buyerNumber` として Supabase に渡しており、文字列連結は発生しないはず。

3. **実際のバグ箇所（要探索テスト）**: `parseInt` の呼び出し前後で型変換が正しく行われているかを探索テストで確認する必要がある。特に `rawValue` が `number` 型で返ってくる場合（スプレッドシートが数値型として保存している場合）に `String(rawValue)` が `"7358"` を返し、`parseInt` が `7358` を返し、`7358 + 1 = 7359` となるはずだが、何らかの理由で `"7358" + 1 = "73581"` になっている可能性がある。

4. **JavaScript の型強制**: `n + 1` の計算で `n` が `number` 型であれば問題ないが、`parseInt` の結果が何らかの理由で文字列として扱われている可能性がある（TypeScript の型定義と実行時の型の乖離）。

5. **updateBuyerNumber の呼び出しタイミング**: `create()` メソッドでは `generateBuyerNumber()` で番号を取得した後、DB 保存成功後に `updateBuyerNumber(buyerNumber)` を呼ぶ。この `buyerNumber` は `getNextBuyerNumber()` の戻り値（文字列）であり、`writeRawCell` に渡される。次回読み取り時に文字列として返ってくるが、`parseInt` で正しく変換されるはず。

**最も可能性が高い原因**: 探索テストを実行して実際の `rawValue` の型と `parseInt` の動作を確認する必要がある。コードを見る限り `parseInt(String(rawValue), 10) + 1` は正しく動作するはずだが、実際には `"73581"` が生成されているため、テストで根本原因を特定する。

## Correctness Properties

Property 1: Bug Condition - 採番結果が数値加算であること

_For any_ 採番スプレッドシートのセルに有効な数値（文字列型または数値型）が格納されている入力に対して、修正後の `getNextBuyerNumber()` は現在の番号を数値として +1 加算した結果（`String(parseInt(rawValue, 10) + 1)`）を返す。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非バグ入力での動作保持

_For any_ 採番処理に関係しない入力（既存買主の更新、検索、エラーケース）に対して、修正後のコードは修正前のコードと同一の動作をする。エラーハンドリング（空欄・非数値・アクセス失敗）の動作は変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の探索テスト結果に基づいて修正箇所を確定するが、現時点での仮説に基づく修正計画は以下の通り:

**File**: `backend/src/services/BuyerNumberSpreadsheetClient.ts`

**Function**: `getNextBuyerNumber()`

**Specific Changes**:

1. **parseInt の結果の型保証**: `parseInt` の結果が確実に `number` 型であることを確認し、`+ 1` が数値加算になるよう保証する
   - `const n: number = parseInt(String(rawValue), 10);` と明示的に型注釈を付ける
   - `const next: number = n + 1;` と中間変数で型を明確にする
   - `return String(next);` で文字列に変換して返す

2. **writeRawCell の書き込み方式の検討**: `valueInputOption: 'RAW'` ではなく `'USER_ENTERED'` を使うことで、スプレッドシートが数値型として保存するよう変更する（ただし、これは根本原因ではない可能性が高い）

3. **防御的な型変換の追加**: `rawValue` の型に関わらず正しく動作するよう、`Number(rawValue)` と `parseInt` の両方を試みる防御的なコードを追加する

**File**: `backend/src/services/GoogleSheetsClient.ts`（必要に応じて）

**Function**: `writeRawCell()`

**Specific Changes**:
1. **valueInputOption の変更**: `'RAW'` から `'USER_ENTERED'` に変更することで、スプレッドシートが数値型として認識・保存するよう変更する（探索テストの結果次第）

## Testing Strategy

### Validation Approach

テスト戦略は二段階アプローチを採用する。まず修正前のコードで探索テストを実行してバグを再現・根本原因を特定し、次に修正後のコードで Fix Checking と Preservation Checking を実行する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を特定する。仮説を確認または反証する。

**Test Plan**: `BuyerNumberSpreadsheetClient.getNextBuyerNumber()` をモックした `GoogleSheetsClient` でテストし、`rawValue` が文字列型の場合と数値型の場合の両方で動作を確認する。

**Test Cases**:
1. **文字列型の数値セル**: `rawValue = "7358"` のとき `getNextBuyerNumber()` が `"7359"` を返すか確認（修正前コードで失敗するはず）
2. **数値型のセル**: `rawValue = 7358`（number型）のとき `getNextBuyerNumber()` が `"7359"` を返すか確認
3. **小さい番号**: `rawValue = "1"` のとき `"2"` を返すか確認
4. **桁上がり**: `rawValue = "9999"` のとき `"10000"` を返すか確認（文字列連結なら `"99991"` になる）

**Expected Counterexamples**:
- `getNextBuyerNumber()` が `"73581"` を返す（文字列連結の証拠）
- 可能性のある原因: `parseInt` の結果が文字列として扱われている、`rawValue` の型が予期しない型になっている

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立するすべての入力に対して正しい採番結果が返されることを確認する。

**Pseudocode:**
```
FOR ALL rawValue WHERE isBugCondition({ rawCellValue: rawValue }) DO
  result := getNextBuyerNumber_fixed(rawValue)
  ASSERT result === String(parseInt(String(rawValue), 10) + 1)
  ASSERT typeof parseInt(result, 10) === 'number'
  ASSERT isNaN(parseInt(result, 10)) === false
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない入力（エラーケース）に対して、修正後のコードが修正前と同一の動作をすることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getNextBuyerNumber_original(input) throws same error as getNextBuyerNumber_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 様々な数値範囲（1〜99999）で自動的にテストケースを生成できる
- 文字列型・数値型・混在型など多様な入力パターンを網羅できる
- エッジケース（桁上がり、最大値付近）を自動的に発見できる

**Test Cases**:
1. **空欄セルのエラー保持**: `rawValue = ""` のとき `"Buyer number cell B2 is empty"` エラーをスローすることを確認
2. **非数値セルのエラー保持**: `rawValue = "abc"` のとき `"Buyer number cell value is not a valid number"` エラーをスローすることを確認
3. **スプレッドシートアクセス失敗のエラー保持**: `readRawRange` が例外をスローするとき `"Failed to access buyer number spreadsheet"` エラーをスローすることを確認

### Unit Tests

- `getNextBuyerNumber()` に文字列型の数値を渡したとき正しく +1 した文字列を返すことを確認
- `getNextBuyerNumber()` に数値型の数値を渡したとき正しく +1 した文字列を返すことを確認
- 空欄・非数値・null・undefined のエラーハンドリングが正しく動作することを確認
- `updateBuyerNumber()` が正しいセルに正しい値を書き込むことを確認

### Property-Based Tests

- ランダムな正の整数（1〜99999）を `rawValue` として渡したとき、結果が `String(rawValue + 1)` と一致することを確認
- 文字列型と数値型の両方で同一の結果が返されることを確認
- 結果が常に数値文字列（`/^\d+$/`）であることを確認

### Integration Tests

- `BuyerService.create()` を呼び出したとき、採番スプレッドシートから正しい番号が取得され、DB に保存されることを確認
- 連続して2回 `create()` を呼び出したとき、2番目の買主番号が1番目より +1 されていることを確認
- 採番スプレッドシートのセルが修正後の番号で更新されていることを確認
