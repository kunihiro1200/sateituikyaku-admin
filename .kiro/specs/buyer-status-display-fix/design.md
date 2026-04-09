# 買主候補リスト表示の不具合修正 Design

## Overview

買主候補リストページの「最新状況」カラムで、本来「B」と表示されるべきところが「BNG」と表示される不具合を修正します。現在の`extractStatusAlpha`関数は全てのアルファベット部分を抽出して連結するため、「B:内覧した物件はNGだが...」というテキストから「B」と「NG」を抽出して「BNG」と表示しています。本修正では、最初の1文字のみを表示するように変更します。

## Glossary

- **Bug_Condition (C)**: 最新状況フィールドに複数のアルファベット文字列が含まれている場合に、全てのアルファベット部分が連結されて表示される条件
- **Property (P)**: 最新状況フィールドの最初の1文字のみが表示される
- **Preservation**: 最新状況の色分け表示（A=緑、B=黄色）、空の場合の「-」表示、他のカラムの表示が変更されない
- **extractStatusAlpha**: `BuyerCandidateListPage.tsx`の関数（272-276行目）- 最新状況フィールドからアルファベット部分を抽出する
- **latest_status**: 買主テーブルの「最新状況」フィールド（`buyers.latest_status`）

## Bug Details

### Bug Condition

不具合は、最新状況フィールドに複数のアルファベット文字列が含まれている場合に発生します。`extractStatusAlpha`関数が正規表現`/[A-Za-z]+/g`で全てのアルファベット部分を抽出し、`join('')`で連結しているため、意図しない文字列が表示されます。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { latest_status: string | null }
  OUTPUT: boolean
  
  RETURN input.latest_status != null
         AND input.latest_status.match(/[A-Za-z]+/g) != null
         AND input.latest_status.match(/[A-Za-z]+/g).length > 1
         AND displayedStatus != input.latest_status.charAt(0)
END FUNCTION
```

### Examples

- **例1**: 最新状況が「B:内覧した物件はNGだが（内覧後の場合）、購入期限が決まっている方（賃貸の更新や進学転勸等で1年以内になど）」の場合
  - **現在の表示**: 「BNG」（間違い）
  - **期待される表示**: 「B」（正しい）

- **例2**: 最新状況が「A:積極的に探している方」の場合
  - **現在の表示**: 「A」（正しい - 1つのアルファベット部分のみ）
  - **期待される表示**: 「A」（正しい）

- **例3**: 最新状況が「C:NGだが連絡は取れる」の場合
  - **現在の表示**: 「CNG」（間違い）
  - **期待される表示**: 「C」（正しい）

- **Edge case**: 最新状況が空（null）の場合
  - **現在の表示**: 「-」（正しい）
  - **期待される表示**: 「-」（正しい）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 最新状況が「A」の場合、緑色のチップで表示される
- 最新状況が「B」の場合、黄色のチップで表示される
- 最新状況が空（null）の場合、「-」と表示される
- 買主候補リストの他のカラム（氏名、希望エリア、受付日など）の表示は変更されない
- メール・SMS送信機能は影響を受けない

**Scope:**
最新状況フィールドに単一のアルファベット文字列のみが含まれている入力（「A」「B」「C」「D」など）は完全に影響を受けません。この修正は、複数のアルファベット文字列が含まれている場合の表示ロジックのみを変更します。

## Hypothesized Root Cause

バグの根本原因は以下の通りです：

1. **正規表現のgフラグ**: `/[A-Za-z]+/g`のgフラグにより、全てのアルファベット部分が抽出される
   - 「B:内覧した物件はNGだが...」→ `["B", "NG"]`

2. **配列の連結**: `match.join('')`により、抽出された全てのアルファベット部分が連結される
   - `["B", "NG"]` → `"BNG"`

3. **仕様の誤解**: 最新状況フィールドには「A」「B」「C」「D」などの1文字のみが格納されていると想定していたが、実際には「B:内覧した物件はNGだが...」のような説明文が格納されている

4. **データの不整合**: スプレッドシートの「★最新状況」カラムには説明文が含まれており、それがそのままデータベースに同期されている

## Correctness Properties

Property 1: Bug Condition - 最新状況の最初の1文字のみを表示

_For any_ 最新状況フィールドで複数のアルファベット文字列が含まれている場合（isBugCondition returns true）、修正後の`extractStatusAlpha`関数は最初の1文字のみを返し、買主候補リストの「最新状況」カラムに正しく表示される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 単一アルファベット文字列の表示

_For any_ 最新状況フィールドで単一のアルファベット文字列のみが含まれている場合（isBugCondition returns false）、修正後の`extractStatusAlpha`関数は元の関数と同じ結果を返し、既存の表示動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `frontend/frontend/src/pages/BuyerCandidateListPage.tsx`

**Function**: `extractStatusAlpha`（272-276行目）

**Specific Changes**:
1. **正規表現の修正**: gフラグを削除して最初のアルファベット1文字のみを抽出
   - 修正前: `/[A-Za-z]+/g`
   - 修正後: `/[A-Za-z]/`（gフラグなし）

2. **配列の連結を削除**: `match[0]`で最初の要素のみを返す
   - 修正前: `match.join('')`
   - 修正後: `match[0]`

3. **シンプルな実装**: 最初の1文字を直接取得
   - `status.charAt(0)`を使用

4. **フォールバック処理**: アルファベットが見つからない場合は最初の1文字を返す
   - `match ? match[0] : status.charAt(0)`

5. **null チェック**: 既存のnullチェックを保持
   - `if (!status) return '-';`

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードで不具合を実証する反例を表面化させ、次に修正が正しく動作し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで不具合を実証する反例を表面化させる。根本原因分析を確認または反証する。反証した場合は、再度仮説を立てる必要があります。

**Test Plan**: 複数のアルファベット文字列が含まれている最新状況フィールドをシミュレートし、表示される文字列が「BNG」のように連結されることを確認します。修正前のコードでこれらのテストを実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **買主番号6836のテスト**: 最新状況が「B:内覧した物件はNGだが...」の場合、「BNG」と表示される（修正前のコードで失敗）
2. **複数アルファベットテスト**: 最新状況が「C:NGだが連絡は取れる」の場合、「CNG」と表示される（修正前のコードで失敗）
3. **単一アルファベットテスト**: 最新状況が「A」の場合、「A」と表示される（修正前のコードで成功）
4. **空文字列テスト**: 最新状況がnullの場合、「-」と表示される（修正前のコードで成功）

**Expected Counterexamples**:
- 複数のアルファベット文字列が含まれている場合、全てのアルファベット部分が連結されて表示される
- 可能な原因: 正規表現のgフラグ、配列の連結処理、仕様の誤解

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := extractStatusAlpha_fixed(input.latest_status)
  ASSERT result == input.latest_status.charAt(0)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT extractStatusAlpha_original(input.latest_status) = extractStatusAlpha_fixed(input.latest_status)
END FOR
```

**Testing Approach**: Property-based testingは保存チェックに推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動のユニットテストでは見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 修正前のコードで単一アルファベット文字列（「A」「B」「C」など）と空文字列の動作を観察し、その動作をキャプチャするProperty-based testを作成します。

**Test Cases**:
1. **単一アルファベット保存**: 最新状況が「A」の場合、引き続き「A」と表示されることを確認
2. **空文字列保存**: 最新状況がnullの場合、引き続き「-」と表示されることを確認
3. **色分け保存**: 最新状況が「A」の場合は緑色、「B」の場合は黄色のチップで表示されることを確認

### Unit Tests

- 複数のアルファベット文字列が含まれている最新状況フィールドのテスト
- 単一のアルファベット文字列のみが含まれている最新状況フィールドのテスト
- 空（null）の最新状況フィールドのテスト
- エッジケース（数字のみ、記号のみ）のテスト

### Property-Based Tests

- ランダムな最新状況文字列を生成し、最初の1文字のみが表示されることを確認
- ランダムな単一アルファベット文字列を生成し、既存の動作が保持されることを確認
- 多数のシナリオで色分け表示が正しいことを確認

### Integration Tests

- 買主候補リストページ全体のフローをテスト（物件番号を指定して買主候補を表示）
- 複数の買主の最新状況が正しく表示されることを確認
- メール・SMS送信機能が引き続き正常に動作することを確認
