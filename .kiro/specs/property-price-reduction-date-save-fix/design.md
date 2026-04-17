# Property Price Reduction Date Save Fix - Bugfix Design

## Overview

物件リスト詳細画面の価格情報セクションで、値下げ予約日（`price_reduction_scheduled_date`）や値下げ履歴（`price_reduction_history`）のみを変更して保存ボタンを押しても保存されないバグを修正する。

**バグの原因**: `handleSavePrice` 関数内の `!('price' in editedData)` という条件チェックが、売買価格（`price`）フィールドが変更されていない場合に `no_changes` エラーをスローして保存処理を中断する。

**修正方針**: `!('price' in editedData)` という誤った条件を削除し、`editedData` が空の場合のみ `no_changes` エラーをスローするよう修正する（他の `handleSave*` 関数と同様の動作に統一する）。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — `editedData` に `price` キーが含まれない状態で保存ボタンが押される
- **Property (P)**: 期待される正しい動作 — `editedData` が空でなければ変更内容をDBに保存し、スナックバーを表示する
- **Preservation**: 修正によって変えてはいけない既存の動作 — 売買価格変更時の保存・値下げ履歴自動追記・変更なし時の保存スキップ
- **handleSavePrice**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` 内の価格情報セクション保存ハンドラー関数
- **editedData**: 編集中のフィールド変更を保持するステート。変更されたフィールドのみキーとして含まれる
- **price_reduction_scheduled_date**: 値下げ予約日フィールド
- **price_reduction_history**: 値下げ履歴フィールド

## Bug Details

### Bug Condition

売買価格（`price`）を変更せずに、値下げ予約日または値下げ履歴のみを変更して保存ボタンを押した場合にバグが発動する。`handleSavePrice` 関数が `!('price' in editedData)` チェックにより `no_changes` エラーをスローし、保存処理を中断する。

**Formal Specification:**
```
FUNCTION isBugCondition(editedData)
  INPUT: editedData of type Record<string, unknown>
  OUTPUT: boolean

  RETURN Object.keys(editedData).length > 0
         AND NOT ('price' in editedData)
         AND (
           'price_reduction_scheduled_date' in editedData
           OR 'price_reduction_history' in editedData
           OR その他の価格関連フィールドが含まれる
         )
END FUNCTION
```

### Examples

- **例1（バグ発動）**: 値下げ予約日のみ変更 → `editedData = { price_reduction_scheduled_date: '2026-05-01' }` → `price` キーなし → `no_changes` エラー → 保存されない
- **例2（バグ発動）**: 値下げ履歴のみ変更 → `editedData = { price_reduction_history: '4/17 5000万→4800万' }` → `price` キーなし → `no_changes` エラー → 保存されない
- **例3（バグ発動）**: 値下げ予約日と値下げ履歴の両方を変更（`price` は変更なし）→ `no_changes` エラー → 保存されない
- **例4（正常動作）**: 売買価格のみ変更 → `editedData = { price: 48000000 }` → `price` キーあり → 正常に保存される

## Expected Behavior

### Preservation Requirements

**変更してはいけない既存の動作:**
- 売買価格（`price`）を変更した場合の保存処理は引き続き正常に動作すること
- 売買価格変更時の値下げ履歴自動追記ロジックは引き続き動作すること
- 何も変更せずに保存ボタンを押した場合（`editedData` が空）は引き続き `no_changes` エラーをスローすること
- 売買価格と値下げ予約日の両方を変更した場合の保存処理は引き続き正常に動作すること

**スコープ:**
`price` フィールドの有無に関わらず、`editedData` が空でない場合はすべて保存処理が実行されるべきである。`editedData` が空の場合のみ保存をスキップする。

## Hypothesized Root Cause

コミット `defc3405`（2026/04/17 15:18）で全 `handleSave*` 関数に `!('price' in editedData)` チェックが誤って追加された。その後コミット `4f516e6c`（2026/04/17 15:47）で他のハンドラーは修正されたが、`handleSavePrice` 自体は修正されなかった。

1. **誤った変更なし検出ロジック**: `handleSavePrice` の変更なし検出条件が `Object.keys(editedData).length === 0 || !('price' in editedData)` となっており、`price` キーが存在しない場合も変更なしと誤判定する
   - 正しい条件は `Object.keys(editedData).length === 0` のみ（他の `handleSave*` 関数と同様）
   - `||` 演算子により、`price` が含まれない変更はすべてブロックされる

2. **修正漏れ**: コミット `4f516e6c` で他のハンドラーは修正されたが `handleSavePrice` が見落とされた

## Correctness Properties

Property 1: Bug Condition - 価格フィールド以外の変更も保存される

_For any_ `editedData` において、`price` キーを含まないが少なくとも1つのキーを含む場合（isBugCondition が true）、修正後の `handleSavePrice` 関数は SHALL 変更内容をDBに保存し、「価格情報を保存しました」のスナックバーを表示する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 変更なし時の保存スキップは維持される

_For any_ `editedData` において、バグ条件が成立しない場合（isBugCondition が false）、修正後の `handleSavePrice` 関数は SHALL 修正前の `handleSavePrice` 関数と同じ結果を返す。具体的には、`editedData` が空の場合は `no_changes` エラーをスローし、`price` を含む変更がある場合は正常に保存する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: `handleSavePrice`

**Specific Changes**:

1. **誤った条件チェックの削除**: 468行目の条件を修正する

   **修正前**:
   ```typescript
   if (Object.keys(editedData).length === 0 || !('price' in editedData)) {
     throw new Error('no_changes');
   }
   ```

   **修正後**:
   ```typescript
   if (Object.keys(editedData).length === 0) {
     throw new Error('no_changes');
   }
   ```

   これにより、`editedData` が空の場合のみ保存をスキップし、`price` キーの有無に関わらず変更があれば保存処理が実行される。

2. **他の変更は不要**: 値下げ履歴の自動追記ロジック（`newSalesPrice !== undefined` チェック）は `price` が変更された場合のみ動作するため、そのまま維持する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグが発動することを確認し、根本原因分析を検証する。

**Test Plan**: `handleSavePrice` 関数を直接テストし、`price` キーを含まない `editedData` で呼び出した際に `no_changes` エラーがスローされることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **値下げ予約日のみ変更テスト**: `editedData = { price_reduction_scheduled_date: '2026-05-01' }` で `handleSavePrice` を呼び出す（未修正コードでは `no_changes` エラーがスローされる）
2. **値下げ履歴のみ変更テスト**: `editedData = { price_reduction_history: '4/17 5000万→4800万' }` で `handleSavePrice` を呼び出す（未修正コードでは `no_changes` エラーがスローされる）
3. **両フィールド変更テスト（price なし）**: `editedData = { price_reduction_scheduled_date: '2026-05-01', price_reduction_history: '...' }` で呼び出す（未修正コードでは `no_changes` エラーがスローされる）
4. **空 editedData テスト**: `editedData = {}` で呼び出す（未修正・修正後ともに `no_changes` エラーがスローされるべき）

**Expected Counterexamples**:
- 値下げ予約日のみ変更した場合に `no_changes` エラーがスローされる
- 原因: `!('price' in editedData)` 条件が `true` になり、`||` 演算子で保存処理がブロックされる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待通りの動作をすることを検証する。

**Pseudocode:**
```
FOR ALL editedData WHERE isBugCondition(editedData) DO
  result := handleSavePrice_fixed(editedData)
  ASSERT api.put が呼ばれた
  ASSERT スナックバーに '価格情報を保存しました' が表示された
  ASSERT no_changes エラーがスローされなかった
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL editedData WHERE NOT isBugCondition(editedData) DO
  ASSERT handleSavePrice_original(editedData) = handleSavePrice_fixed(editedData)
END FOR
```

**Testing Approach**: プロパティベーステストが保持チェックに推奨される理由:
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストでは見落とすエッジケースを検出できる
- 非バグ入力に対して動作が変わらないことを強力に保証できる

**Test Plan**: まず未修正コードで `price` を含む変更や変更なしの動作を観察し、その動作を捉えるプロパティベーステストを作成する。

**Test Cases**:
1. **売買価格のみ変更の保持**: `editedData = { price: 48000000 }` で保存が正常に動作し、値下げ履歴が自動追記されることを確認
2. **変更なし時のスキップ保持**: `editedData = {}` で `no_changes` エラーがスローされることを確認
3. **売買価格と値下げ予約日の両方変更の保持**: `editedData = { price: 48000000, price_reduction_scheduled_date: '2026-05-01' }` で正常に保存されることを確認

### Unit Tests

- `editedData` が空の場合に `no_changes` エラーがスローされることをテスト
- `price` キーなしで変更がある場合に保存が実行されることをテスト（修正後）
- `price` キーありで変更がある場合に値下げ履歴が自動追記されることをテスト
- `price` キーなしで変更がある場合に値下げ履歴が自動追記されないことをテスト

### Property-Based Tests

- ランダムな `editedData`（`price` キーなし、少なくとも1つのキーあり）を生成し、修正後の関数が保存を実行することを検証
- ランダムな `editedData`（`price` キーあり）を生成し、修正前後で同じ動作をすることを検証
- 空の `editedData` で修正前後ともに `no_changes` エラーがスローされることを検証

### Integration Tests

- 物件リスト詳細画面で値下げ予約日のみを変更して保存ボタンを押し、DBに保存されスナックバーが表示されることを確認
- 物件リスト詳細画面で売買価格のみを変更して保存ボタンを押し、値下げ履歴が自動追記されることを確認
- 物件リスト詳細画面で何も変更せずに保存ボタンを押し、保存がスキップされることを確認
