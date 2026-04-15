# buyer-price-sort-bug Bugfix Design

## Overview

通話モードページ（`/sellers/:id/call`）の「近隣買主」セクションで、価格（`inquiry_price`）の昇順・降順ソートが数値的に正しくない順序になるバグを修正する。

バックエンドが `inquiry_price` を文字列型として返した場合、`NearbyBuyersList.tsx` の `sortedBuyers` useMemo 内のソートロジックが `typeof aValue === 'number'` チェックで `false` となり、`localeCompare` による辞書順比較にフォールバックする。辞書順では `"49800000"` < `"5800000"`（先頭文字 `"4"` < `"5"`）となるため、数値的に正しくない順序になる。

修正方針は最小限：`inquiry_price` のソート比較時に `Number()` で数値変換してから比較するよう変更する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `inquiry_price` が文字列型として返ってきた場合に、辞書順ソートが発生する
- **Property (P)**: 期待される正しい動作 — `inquiry_price` を数値として比較し、数値的に正しい昇順・降順でソートされる
- **Preservation**: 修正によって変えてはいけない既存の動作 — 価格以外のカラムのソート、null/undefined の末尾配置、メール・SMS・PDF機能
- **sortedBuyers**: `NearbyBuyersList.tsx` 内の `React.useMemo` で計算されるソート済み買主リスト
- **inquiry_price**: 買主の希望購入価格（円単位）。バックエンドから `number | null` として定義されているが、実際には文字列型で返ってくる場合がある

## Bug Details

### Bug Condition

バグは、`inquiry_price` カラムでソートを行い、かつバックエンドが `inquiry_price` を文字列型として返した場合に発生する。`sortedBuyers` useMemo 内の `typeof aValue === 'number'` チェックが `false` になり、`localeCompare` による辞書順比較にフォールバックする。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type NearbyBuyer
  OUTPUT: boolean

  RETURN typeof X.inquiry_price = 'string'
         AND X.inquiry_price IS NOT NULL
         AND sortConfig.key = 'inquiry_price'
END FUNCTION
```

### Examples

- **例1（昇順）**: `inquiry_price` が `"5800000"` と `"49800000"` の場合、辞書順では `"49800000"` < `"5800000"` となり、4980万円が580万円より前に表示される（期待: 580万円 → 4980万円）
- **例2（降順）**: 同様に降順でも `"5800000"` < `"49800000"` の逆順になり、580万円が4980万円より前に表示される（期待: 4980万円 → 580万円）
- **例3（混在）**: `inquiry_price` が数値型と文字列型の混在で返ってくる場合、一部の比較で型不一致が発生しソート結果が不安定になる
- **エッジケース**: `inquiry_price` が `null` の買主は、修正後も引き続きリストの末尾に配置される

## Expected Behavior

### Preservation Requirements

**変えてはいけない動作:**
- 価格以外のカラム（買主番号、名前、最新状況、内覧日）でのソートは既存ロジックのまま正しく動作する
- `inquiry_price` が `null` または `undefined` の買主はリストの末尾に配置される
- ソートを適用していない初期状態ではバックエンドから返ってきた順序（受付日降順・確度順）で表示される
- メール送信・SMS送信・PDF印刷機能は引き続き正常に動作する

**スコープ:**
`inquiry_price` カラムのソート比較ロジック以外は一切変更しない。影響を受けないもの:
- `viewing_date` の日付比較ロジック
- 文字列カラム（`buyer_number`, `name`, `latest_status`）の `localeCompare` ロジック
- null/undefined の末尾配置ロジック
- UI表示（`(buyer.inquiry_price / 10000).toLocaleString()万円`）

## Hypothesized Root Cause

バグの根本原因は以下の通り:

1. **型チェックの厳格性**: `typeof aValue === 'number'` は実行時の型を厳密にチェックする。バックエンドの `BuyerService.getBuyersByAreas()` が `inquiry_price` を文字列型（例: `"5800000"`）として返した場合、このチェックが `false` になる
   - TypeScript の型定義では `inquiry_price?: number | null` だが、実際のAPIレスポンスは文字列型の場合がある
   - JSONシリアライズ/デシリアライズの過程で型が変わる可能性がある

2. **localeCompare へのフォールバック**: 数値チェックが `false` の場合、`String(aValue).localeCompare(String(bValue), 'ja')` による辞書順比較が実行される。辞書順では先頭文字で比較するため `"4..."` < `"5..."` となり数値的に正しくない

3. **修正箇所**: `NearbyBuyersList.tsx` の `sortedBuyers` useMemo 内、`inquiry_price` の比較ロジック。`Number()` で数値変換してから比較することで型に依存しない数値比較が可能になる

## Correctness Properties

Property 1: Bug Condition - 価格の数値ソート

_For any_ `inquiry_price` が文字列型として返ってきた買主ペア (A, B) において、`inquiry_price` カラムで昇順ソートを適用した場合、修正後の `sortedBuyers` は `Number(A.inquiry_price) <= Number(B.inquiry_price)` の順序で A を B より前に配置する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 価格以外のソート動作の保持

_For any_ `inquiry_price` カラム以外のカラム（`buyer_number`, `name`, `latest_status`, `viewing_date`）でソートを適用した場合、修正後の `sortedBuyers` は修正前と同一の結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/NearbyBuyersList.tsx`

**Function**: `sortedBuyers` (React.useMemo, Line 107付近)

**Specific Changes**:

1. **inquiry_price の数値変換**: `typeof aValue === 'number' && typeof bValue === 'number'` の条件分岐を、`inquiry_price` キーの場合は `Number()` で変換してから比較するよう変更する

   **変更前:**
   ```typescript
   if (typeof aValue === 'number' && typeof bValue === 'number') {
     return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
   }
   ```

   **変更後:**
   ```typescript
   if (sortConfig.key === 'inquiry_price') {
     const aNum = Number(aValue);
     const bNum = Number(bValue);
     return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
   }
   if (typeof aValue === 'number' && typeof bValue === 'number') {
     return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
   }
   ```

2. **変更の最小性**: 他のソートロジック（日付比較、文字列比較、null処理）は一切変更しない

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ: まず未修正コードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `inquiry_price` が文字列型の買主データを用意し、価格ソートを適用した際に辞書順になることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **昇順ソートテスト**: `inquiry_price: "49800000"` と `inquiry_price: "5800000"` の2件を昇順ソートし、`"49800000"` が先頭に来ることを確認（未修正コードで失敗する）
2. **降順ソートテスト**: 同データを降順ソートし、`"5800000"` が先頭に来ることを確認（未修正コードで失敗する）
3. **複数件ソートテスト**: `["49800000", "5800000", "10000000", "3000000"]` を昇順ソートし、辞書順（`"10000000", "3000000", "49800000", "5800000"`）になることを確認（未修正コードで失敗する）
4. **null混在テスト**: `null` を含む場合に末尾配置されることを確認（未修正コードでも通過する可能性あり）

**Expected Counterexamples**:
- 昇順ソートで `"49800000"` が `"5800000"` より前に来る（数値的には逆）
- 原因: `typeof "49800000" === 'number'` が `false` のため `localeCompare` にフォールバック

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して正しい数値ソートが行われることを検証する。

**Pseudocode:**
```
FOR ALL pair (A, B) WHERE isBugCondition(A) OR isBugCondition(B) DO
  sortedList := sortedBuyers_fixed([A, B], 'asc')
  numericA := Number(A.inquiry_price)
  numericB := Number(B.inquiry_price)
  ASSERT sortedList[0] = (numericA <= numericB ? A : B)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全入力（価格以外のカラムのソート）に対して修正前と同一の結果が返ることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT sortedBuyers_original(input) = sortedBuyers_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な価格値（整数、大きな数、小さな数）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 価格以外のカラムのソートが変わっていないことを多数のケースで保証できる

**Test Cases**:
1. **買主番号ソート保持**: `buyer_number` でのソートが修正前後で同一結果になることを確認
2. **名前ソート保持**: `name` でのソートが修正前後で同一結果になることを確認
3. **内覧日ソート保持**: `viewing_date` でのソートが修正前後で同一結果になることを確認
4. **null末尾配置保持**: `inquiry_price: null` の買主が末尾に配置されることを確認

### Unit Tests

- 文字列型 `inquiry_price` を持つ買主リストの昇順・降順ソートが数値的に正しいことをテスト
- 数値型 `inquiry_price` を持つ買主リストのソートが引き続き正しいことをテスト
- `inquiry_price: null` の買主が末尾に配置されることをテスト
- 価格以外のカラム（`buyer_number`, `name`, `latest_status`, `viewing_date`）のソートが変わらないことをテスト

### Property-Based Tests

- ランダムな価格値（文字列型・数値型混在）を生成し、ソート後のリストが数値的に正しい順序になることを検証
- ランダムな買主データを生成し、`inquiry_price` 以外のカラムのソート結果が修正前後で一致することを検証
- null を含む価格リストを生成し、null が常に末尾に配置されることを検証

### Integration Tests

- 通話モードページ（`/sellers/:id/call`）で近隣買主リストを表示し、価格ソートボタンをクリックして数値的に正しい順序になることを確認
- 価格ソート後にメール送信・SMS送信・PDF印刷機能が正常に動作することを確認
- 価格ソートと他のカラムソートを切り替えた際に正しく動作することを確認
