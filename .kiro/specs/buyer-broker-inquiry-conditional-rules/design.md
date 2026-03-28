# buyer-broker-inquiry-conditional-rules バグ修正デザイン

## Overview

買主詳細画面（`BuyerDetailPage.tsx`）と買主ステータス計算（`BuyerStatusCalculator.ts`）において、`broker_inquiry = '業者問合せ'` の場合に適用されるべき2つの条件分岐が正しく機能していないバグを修正する。

**バグ1**: `inquiry_source`（問合せ元）の必須チェックが `broker_inquiry = '業者問合せ'` の場合でも実行されてしまっている。

**バグ2**: `BuyerStatusCalculator.ts` の「内覧日前日」ステータス（Priority 3）の判定条件に `broker_inquiry = '業者問合せ'` の除外条件がなく、業者問合せの買主がサイドバーの「内覧日前日」カテゴリーに表示されてしまっている。

**コード調査の結果**: 実際のコードを確認したところ、両方の除外条件がすでにコード上に実装されている。しかし、バグが報告されていることから、実装に不備がある可能性（条件の抜け漏れ、初期化タイミングの問題など）が考えられる。本デザインでは、コードの実装を精査し、確実に動作するよう修正する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `broker_inquiry = '業者問合せ'` であるにもかかわらず、`inquiry_source` が必須チェックされる、または「内覧日前日」ステータスに分類される
- **Property (P)**: 期待される正しい動作 — `broker_inquiry = '業者問合せ'` の場合、`inquiry_source` は必須チェックされず、「内覧日前日」ステータスにも分類されない
- **Preservation**: 修正によって変更してはいけない既存の動作 — `broker_inquiry` が「業者問合せ」以外の場合の必須チェックおよびステータス計算
- **broker_inquiry**: 買主の業者問合せ区分フィールド。値は「業者問合せ」「業者（両手）」または空欄など
- **inquiry_source**: 問合せ元フィールド。`broker_inquiry` が「業者問合せ」以外の場合は必須
- **latest_viewing_date**: 最新内覧日フィールド。「内覧日前日」ステータス判定に使用
- **calculateBuyerStatus**: `backend/src/services/BuyerStatusCalculator.ts` の関数。買主のステータスを計算する
- **checkMissingFields**: `BuyerDetailPage.tsx` 内の関数。必須フィールドの未入力チェックを行う

## Bug Details

### Bug Condition

バグは `broker_inquiry = '業者問合せ'` の買主に対して2つの誤った動作として現れる。

**バグ1**: `checkMissingFields` 関数（および `fetchBuyer` の初期化処理）において、`broker_inquiry` の値に関わらず `inquiry_source` が必須チェックされる。

**バグ2**: `calculateBuyerStatus` 関数の Priority 3 判定において、`broker_inquiry = '業者問合せ'` の買主が「内覧日前日」ステータスに分類される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerData
  OUTPUT: boolean

  // バグ1の条件
  BUG1 = (input.broker_inquiry = '業者問合せ')
         AND (input.inquiry_source IS NULL OR EMPTY)
         AND (システムが inquiry_source を必須エラーとして表示する)

  // バグ2の条件
  BUG2 = (input.broker_inquiry = '業者問合せ')
         AND (input.latest_viewing_date IS NOT NULL)
         AND (
           (isTomorrow(input.latest_viewing_date) AND getDayOfWeek(input.latest_viewing_date) != '木曜日')
           OR
           (isDaysFromToday(input.latest_viewing_date, 2) AND getDayOfWeek(input.latest_viewing_date) = '木曜日')
         )
         AND (calculateBuyerStatus(input).status = '内覧日前日')

  RETURN BUG1 OR BUG2
END FUNCTION
```

### Examples

- **バグ1の例**: `broker_inquiry = '業者問合せ'`、`inquiry_source = null` → 必須エラーが表示される（期待: エラーなし）
- **バグ2の例**: `broker_inquiry = '業者問合せ'`、`latest_viewing_date = 明日` → ステータスが「内覧日前日」になる（期待: 「内覧日前日」にならない）
- **バグ2の例（木曜）**: `broker_inquiry = '業者問合せ'`、`latest_viewing_date = 木曜日（2日後）` → ステータスが「内覧日前日」になる（期待: 「内覧日前日」にならない）
- **正常ケース**: `broker_inquiry = '業者（両手）'`、`inquiry_source = null` → 必須エラーが表示される（期待通り）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `broker_inquiry` が「業者問合せ」以外（空欄・「業者（両手）」など）の場合、`inquiry_source` は引き続き必須フィールドとして扱われる
- `broker_inquiry` が「業者問合せ」以外の場合、`latest_viewing_date` が明日（または木曜日の場合は2日後）であれば「内覧日前日」ステータスに分類される
- `broker_inquiry` が「業者問合せ」であっても、`inquiry_source` に値が入力されている場合はその値を保持し、保存・表示を正常に行う
- Priority 1〜2、Priority 4以降のステータス計算ロジックは変更しない

**Scope:**
`broker_inquiry` が「業者問合せ」以外の全ての入力は、この修正によって完全に影響を受けない。これには以下が含まれる:
- `broker_inquiry` が空欄の買主
- `broker_inquiry` が「業者（両手）」の買主
- `broker_inquiry` が「業者問合せ」以外の任意の値の買主

## Hypothesized Root Cause

コード調査の結果、`BuyerDetailPage.tsx` と `BuyerStatusCalculator.ts` の両方に除外条件がすでに実装されていることが確認された。しかし、バグが報告されていることから、以下の原因が考えられる。

1. **実装の抜け漏れ**: `checkMissingFields` 関数には除外条件があるが、`fetchBuyer` の初期化処理（`initialMissing` の構築部分）にも同じ条件が必要であり、片方だけ修正されている可能性がある
   - `checkMissingFields` 内: `buyer.broker_inquiry !== '業者問合せ'` の条件あり（確認済み）
   - `fetchBuyer` 内の初期化: 同様の条件あり（確認済み）

2. **BuyerStatusCalculator の条件実装**: Priority 3 に `not(equals(buyer.broker_inquiry, '業者問合せ'))` の条件あり（確認済み）

3. **コードとデプロイの乖離**: コードには修正が入っているが、デプロイされていない可能性

4. **BuyerData インターフェースの型定義不備**: `broker_inquiry` フィールドが `BuyerData` インターフェースに定義されていない場合、条件が常に `false` になる可能性

5. **サイドバーコンポーネントの独立した実装**: サイドバーが `BuyerStatusCalculator.ts` を使わず独自のフィルタリングロジックを持っている可能性

## Correctness Properties

Property 1: Bug Condition - broker_inquiry = '業者問合せ' の場合の inquiry_source 必須チェック除外

_For any_ 買主データ where `broker_inquiry = '業者問合せ'` かつ `inquiry_source` が空欄（isBugCondition のバグ1が true）の場合、修正後の `checkMissingFields` 関数は `inquiry_source` を必須エラーとして返さず、`missingRequiredFields` に `inquiry_source` を含めないものとする。

**Validates: Requirements 2.1**

Property 2: Bug Condition - broker_inquiry = '業者問合せ' の場合の内覧日前日ステータス除外

_For any_ 買主データ where `broker_inquiry = '業者問合せ'` かつ `latest_viewing_date` が明日（または木曜日の場合は2日後）（isBugCondition のバグ2が true）の場合、修正後の `calculateBuyerStatus` 関数は `status = '内覧日前日'` を返さないものとする。

**Validates: Requirements 2.2**

Property 3: Preservation - broker_inquiry が '業者問合せ' 以外の場合の inquiry_source 必須チェック保持

_For any_ 買主データ where `broker_inquiry` が「業者問合せ」以外（isBugCondition のバグ1が false）の場合、修正後の `checkMissingFields` 関数は修正前と同じ結果を返し、`inquiry_source` が空欄であれば必須エラーとして扱い続けるものとする。

**Validates: Requirements 3.1**

Property 4: Preservation - broker_inquiry が '業者問合せ' 以外の場合の内覧日前日ステータス保持

_For any_ 買主データ where `broker_inquiry` が「業者問合せ」以外かつ `latest_viewing_date` が明日（または木曜日の場合は2日後）（isBugCondition のバグ2が false）の場合、修正後の `calculateBuyerStatus` 関数は `status = '内覧日前日'` を返し続けるものとする。

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

コード調査の結果、除外条件はすでに実装されているが、以下の点を精査・確認して修正する。

**File 1**: `backend/src/services/BuyerStatusCalculator.ts`

**確認・修正箇所**:
1. **BuyerData インターフェースの `broker_inquiry` フィールド定義確認**: `broker_inquiry` が `BuyerData` インターフェースに定義されているか確認する。未定義の場合は追加する
2. **Priority 3 の除外条件確認**: `not(equals(buyer.broker_inquiry, '業者問合せ'))` が正しく動作しているか確認する

**File 2**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**確認・修正箇所**:
1. **`checkMissingFields` 関数の除外条件確認**: `buyer.broker_inquiry !== '業者問合せ'` の条件が正しく機能しているか確認する
2. **`fetchBuyer` の初期化処理の除外条件確認**: `res.data.broker_inquiry !== '業者問合せ'` の条件が `initialMissing` の構築時に適用されているか確認する
3. **`InlineEditableField` の `validation` プロパティ確認**: `inquiry_source` フィールドの `validation` 関数内でも `broker_inquiry` チェックが行われているか確認する

**File 3**: 買主用サイドバーコンポーネント（要調査）

**確認・修正箇所**:
1. **サイドバーのフィルタリングロジック確認**: サイドバーが `BuyerStatusCalculator.ts` の結果を使用しているか、または独自のフィルタリングロジックを持っているかを確認する
2. **独自ロジックがある場合**: `broker_inquiry = '業者問合せ'` の除外条件を追加する

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず未修正コードでバグを再現するテストを実行し、根本原因を確認する。次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。根本原因が仮説と異なる場合は再仮説を立てる。

**Test Plan**: `broker_inquiry = '業者問合せ'` の買主データを使用して、`calculateBuyerStatus` と `checkMissingFields` の動作を確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **バグ2探索テスト**: `broker_inquiry = '業者問合せ'`、`latest_viewing_date = 明日` → `calculateBuyerStatus` が「内覧日前日」を返さないことを確認（未修正コードでは FAIL する可能性）
2. **バグ2探索テスト（木曜）**: `broker_inquiry = '業者問合せ'`、`latest_viewing_date = 木曜日（2日後）` → 「内覧日前日」を返さないことを確認
3. **BuyerData 型確認テスト**: `broker_inquiry` フィールドが `BuyerData` インターフェースに存在するか確認
4. **バグ1探索テスト**: `broker_inquiry = '業者問合せ'`、`inquiry_source = null` → `checkMissingFields` が `inquiry_source` を返さないことを確認

**Expected Counterexamples**:
- `calculateBuyerStatus` が `broker_inquiry = '業者問合せ'` の場合でも「内覧日前日」を返す
- 原因候補: `BuyerData` インターフェースに `broker_inquiry` が未定義、または `equals` 関数の比較が失敗している

### Fix Checking

**Goal**: バグ条件が true の全入力に対して、修正後の関数が期待される動作を返すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // バグ1の確認
  IF input.broker_inquiry = '業者問合せ' AND input.inquiry_source IS EMPTY THEN
    ASSERT 'inquiry_source' NOT IN checkMissingFields(input)

  // バグ2の確認
  IF input.broker_inquiry = '業者問合せ' AND isViewingDayBefore(input.latest_viewing_date) THEN
    result := calculateBuyerStatus(input)
    ASSERT result.status != '内覧日前日'
END FOR
```

### Preservation Checking

**Goal**: バグ条件が false の全入力に対して、修正後の関数が修正前と同じ結果を返すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // バグ1の保持確認
  IF input.broker_inquiry != '業者問合せ' AND input.inquiry_source IS EMPTY THEN
    ASSERT 'inquiry_source' IN checkMissingFields(input)

  // バグ2の保持確認
  IF input.broker_inquiry != '業者問合せ' AND isViewingDayBefore(input.latest_viewing_date) THEN
    result := calculateBuyerStatus(input)
    ASSERT result.status = '内覧日前日'
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由:
- `broker_inquiry` の多様な値（空欄、「業者（両手）」、その他）に対して自動的にテストケースを生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正後の動作が全ての非バグ入力に対して保持されることを強く保証できる

**Test Cases**:
1. **inquiry_source 必須チェック保持**: `broker_inquiry = null`（空欄）かつ `inquiry_source = null` → 必須エラーが発生することを確認
2. **内覧日前日ステータス保持**: `broker_inquiry = null`（空欄）かつ `latest_viewing_date = 明日` → 「内覧日前日」ステータスになることを確認
3. **inquiry_source 値保持**: `broker_inquiry = '業者問合せ'` かつ `inquiry_source = 'SUUMO'` → 値が保持されることを確認
4. **Priority 1〜2 保持**: `broker_inquiry = '業者問合せ'` かつ Priority 1 または 2 の条件を満たす → 対応するステータスが返ることを確認

### Unit Tests

- `calculateBuyerStatus` に `broker_inquiry = '業者問合せ'` かつ `latest_viewing_date = 明日` を渡した場合、「内覧日前日」以外のステータスが返ることを確認
- `calculateBuyerStatus` に `broker_inquiry = '業者問合せ'` かつ `latest_viewing_date = 木曜日（2日後）` を渡した場合、「内覧日前日」以外のステータスが返ることを確認
- `calculateBuyerStatus` に `broker_inquiry = null` かつ `latest_viewing_date = 明日` を渡した場合、「内覧日前日」が返ることを確認（保持確認）
- `BuyerData` インターフェースに `broker_inquiry` フィールドが定義されていることを確認

### Property-Based Tests

- ランダムな `broker_inquiry` 値（「業者問合せ」以外）と `latest_viewing_date = 明日` の組み合わせで、「内覧日前日」ステータスが返ることを確認
- ランダムな `broker_inquiry` 値（「業者問合せ」以外）と `inquiry_source = null` の組み合わせで、必須エラーが発生することを確認
- `broker_inquiry = '業者問合せ'` と様々な `latest_viewing_date` の組み合わせで、「内覧日前日」ステータスが返らないことを確認

### Integration Tests

- 買主詳細画面で `broker_inquiry = '業者問合せ'` の買主を表示した場合、`inquiry_source` の必須エラーハイライトが表示されないことを確認
- サイドバーで `broker_inquiry = '業者問合せ'` かつ `latest_viewing_date = 明日` の買主が「内覧日前日」カテゴリーに表示されないことを確認
- `broker_inquiry = '業者問合せ'` かつ `inquiry_source = 'SUUMO'` の買主を保存した場合、値が正常に保持されることを確認
