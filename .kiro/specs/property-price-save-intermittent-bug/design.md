# 物件価格保存間欠的失敗バグ修正 デザイン

## Overview

物件リスト詳細画面（`PropertyListingDetailPage`）の「価格情報」セクションにおいて、売買価格を変更して保存ボタンを押しても間欠的に保存が行われないバグを修正する。

根本原因は、全セクションが共有する `editedData` state と `handleSavePrice` の早期リターン設計の組み合わせにある。`handleSavePrice` が `Object.keys(editedData).length === 0` の場合に例外なしで早期リターンするため、`EditableSection` コンポーネントはこれを「保存成功」と判断して編集モードを終了させる。

修正方針は、`handleSavePrice` が保存をスキップする場合に例外をスローして `EditableSection` に失敗を伝えるか、または価格セクション専用の state を使用して他セクションの `editedData` 汚染を防ぐことである。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 保存ボタン押下時に `editedData` が空、または `editedData` に `price` キーが含まれていない状態
- **Property (P)**: 期待される正しい動作 — 価格フィールドが `editedData` に含まれる場合のみ API を呼び出し、含まれない場合は編集モードを維持するか適切なフィードバックを表示する
- **Preservation**: 修正によって変更してはならない既存の動作 — 正常な価格保存フロー、値下げ履歴自動追記、キャンセル処理、他セクションの保存処理
- **handleSavePrice**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` 内の価格情報セクションの保存ハンドラー関数
- **editedData**: `PropertyListingDetailPage` 全セクションで共有される編集中データの state（`Record<string, any>`）
- **EditableSection**: `frontend/frontend/src/components/EditableSection.tsx` — 編集モードの切り替えと保存・キャンセルボタンを提供するコンポーネント。`onSave` が例外をスローした場合のみ編集モードを維持する

## Bug Details

### Bug Condition

バグは、価格情報セクションの保存ボタン押下時に `editedData` が空または `price` キーを含まない状態で発生する。`handleSavePrice` は早期リターン（例外なし）するが、`EditableSection.handleSave` はこれを成功とみなして `onEditToggle()` を呼び出し、編集モードを終了させる。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SavePriceAction
    X.editedData: Record<string, any>  // 保存ボタン押下時の editedData の状態
    X.priceFieldPresent: boolean       // editedData に 'price' キーが含まれるか
  OUTPUT: boolean

  RETURN Object.keys(X.editedData).length === 0
         OR NOT X.priceFieldPresent
END FUNCTION
```

### Examples

- **例1（editedData が空）**: 価格情報セクションを編集モードにして何も変更せずに保存ボタンを押す → `editedData` が空のため早期リターン → 編集モードが閉じられるが何も保存されない
- **例2（price キーなし）**: 他のセクション（ヘッダー情報など）を先に編集して `editedData` に他フィールドが入っている状態で、価格を変更せずに保存ボタンを押す → `editedData` が空でないため API を呼び出すが、価格フィールドを含まないデータを送信する
- **例3（editedData リセット後）**: 価格を変更した後、保存前に他セクションのキャンセルで `editedData` がリセットされた場合 → 価格変更が失われたまま保存ボタンを押すと早期リターンして編集モードが閉じられる
- **エッジケース**: `editedData` に `price_reduction_scheduled_date` のみが含まれ `price` が含まれない場合 → API は呼ばれるが価格は保存されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 価格情報セクションで売買価格を変更して保存ボタンを押した場合（正常ケース）、値下げ履歴を自動追記し、API に保存し、成功メッセージを表示する動作は変わらない
- 価格情報セクションでキャンセルボタンを押した場合、`editedData` をリセットして編集モードを終了する動作は変わらない
- 価格情報セクションで値下げ予約日を変更して保存した場合、`propertyPriceReductionUpdated` イベントを発火してサイドバーを更新する動作は変わらない
- 他のセクション（基本情報、物件詳細など）の保存処理は正常に動作し続ける
- Chat 送信ボタンの動作は変わらない

**Scope:**
`isBugCondition` が false となる入力（`editedData` に `price` キーが含まれる正常ケース）は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通りである：

1. **早期リターンが例外をスローしない**: `handleSavePrice` の `if (!propertyNumber || Object.keys(editedData).length === 0) return;` は例外なしで早期リターンする。`EditableSection.handleSave` は `try/catch` で `onSave()` を呼び出し、例外がスローされない場合は `onEditToggle()` を呼び出して編集モードを終了させる。

2. **editedData の共有による汚染**: 全セクションが同一の `editedData` state を共有しているため、他セクションの編集状態が価格セクションの保存判定に影響する。

3. **price キーの存在チェックがない**: `handleSavePrice` は `editedData` が空かどうかのみチェックし、`price` キーが含まれているかどうかをチェックしていない。`editedData` に他フィールドのみが含まれる場合、価格なしで API が呼ばれる。

4. **EditableSection の hasChanges 判定も共有 editedData に依存**: `hasChanges={Object.keys(editedData).length > 0}` も共有 `editedData` を参照しているため、他セクションの変更が価格セクションの保存ボタンを光らせる誤動作を引き起こす可能性がある。

## Correctness Properties

Property 1: Bug Condition - 価格保存スキップ時の編集モード維持

_For any_ 保存ボタン押下アクション X において `isBugCondition(X)` が true（`editedData` が空または `price` キーを含まない）の場合、修正後の `handleSavePrice` は例外をスローするか適切なフィードバックを表示し、`EditableSection` は編集モードを維持する（`onEditToggle()` を呼び出さない）。

**Validates: Requirements 2.2, 2.4**

Property 2: Preservation - 正常な価格保存フローの維持

_For any_ 保存ボタン押下アクション X において `isBugCondition(X)` が false（`editedData` に `price` キーが含まれる）の場合、修正後の `handleSavePrice` は修正前と同じ動作（値下げ履歴自動追記、API 呼び出し、成功メッセージ表示、`editedData` リセット）を行う。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、最小限の変更で修正する。

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: `handleSavePrice`

**Specific Changes**:

1. **早期リターンを例外スローに変更**: `editedData` が空の場合、または `price` キーが含まれない場合に `return` ではなく `throw new Error(...)` を使用する。これにより `EditableSection.handleSave` の `catch` ブロックが実行され、編集モードが維持される。

   ```typescript
   // 修正前
   if (!propertyNumber || Object.keys(editedData).length === 0) return;

   // 修正後（案A: 例外スロー）
   if (!propertyNumber) return;
   if (Object.keys(editedData).length === 0 || !('price' in editedData)) {
     // 何も変更されていない場合は静かに編集モードを維持
     throw new Error('no_changes');
   }
   ```

2. **EditableSection の catch ブロックで 'no_changes' エラーを無視**: または、`EditableSection` 側で特定のエラーコードを受け取った場合に編集モードを維持しつつエラーログを出力しないよう対応する。

   ```typescript
   // EditableSection.handleSave の修正案
   const handleSave = async () => {
     setIsSaving(true);
     try {
       await onSave();
       onEditToggle(); // 成功時のみ編集モードを終了
     } catch (error) {
       if (error instanceof Error && error.message === 'no_changes') {
         // 変更なし: 編集モードを維持（ログ出力なし）
       } else {
         console.error('Save failed:', error);
         // 編集モードは維持される（onEditToggle を呼ばない）
       }
     } finally {
       setIsSaving(false);
     }
   };
   ```

3. **（代替案B）価格セクション専用 state の導入**: `editedData` の共有問題を根本解決するため、価格セクション専用の `editedPriceData` state を導入する。ただし変更範囲が大きくなるため、案Aを優先する。

## Testing Strategy

### Validation Approach

テスト戦略は二段階アプローチを採用する。まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `handleSavePrice` の動作をシミュレートする関数を作成し、`editedData` が空または `price` キーを含まない場合に例外がスローされないことを確認する。未修正コードで実行してバグを証明する。

**Test Cases**:
1. **editedData 空テスト**: `editedData = {}` の状態で `handleSavePrice` を呼び出す → 例外がスローされないことを確認（未修正コードで PASS、バグの証明）
2. **price キーなしテスト**: `editedData = { atbb_status: '公開中' }` の状態で `handleSavePrice` を呼び出す → API が呼ばれるが `price` が含まれないことを確認
3. **EditableSection 連携テスト**: `onSave` が例外なしで早期リターンした場合に `onEditToggle` が呼ばれることを確認（未修正コードで PASS、バグの証明）
4. **正常ケーステスト**: `editedData = { price: 5000 }` の状態で `handleSavePrice` を呼び出す → API が呼ばれることを確認

**Expected Counterexamples**:
- `editedData` が空の場合、`handleSavePrice` は例外をスローせずに早期リターンする
- `EditableSection.handleSave` は例外がスローされないため `onEditToggle()` を呼び出し、編集モードが終了する

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待される動作（編集モード維持）を行うことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleSavePrice_fixed(X)
  ASSERT 例外がスローされる OR 編集モードが維持される
  AND API が呼ばれない（editedData が空の場合）
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ動作を行うことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleSavePrice_original(X) = handleSavePrice_fixed(X)
  // 値下げ履歴自動追記、API 呼び出し、成功メッセージ表示が同一
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 様々な `editedData` の組み合わせを自動生成して正常ケースを網羅できる
- 手動テストでは見落としやすいエッジケース（`price` と他フィールドの組み合わせ）を検出できる
- 修正前後の動作が同一であることを強く保証できる

**Test Cases**:
1. **正常保存の保持**: `editedData = { price: 5000 }` で API が呼ばれ成功メッセージが表示されることを確認
2. **値下げ履歴自動追記の保持**: 価格変更時に `price_reduction_history` が自動更新されることを確認
3. **キャンセル動作の保持**: キャンセルボタンで `editedData` がリセットされ編集モードが終了することを確認
4. **他セクション保存の保持**: `handleSaveHeader`、`handleSaveBasicInfo` 等が正常に動作することを確認

### Unit Tests

- `editedData` が空の場合に `handleSavePrice` が例外をスローすること（修正後）
- `editedData` に `price` キーがない場合に `handleSavePrice` が例外をスローすること（修正後）
- `editedData` に `price` キーがある場合に API が呼ばれること
- `EditableSection` が例外を受け取った場合に編集モードを維持すること

### Property-Based Tests

- ランダムな `editedData`（`price` キーなし）を生成して、修正後の `handleSavePrice` が常に例外をスローすることを検証
- ランダムな `editedData`（`price` キーあり）を生成して、修正後の `handleSavePrice` が常に API を呼び出すことを検証
- `price` キーの有無に関わらず、キャンセル動作が常に正常に機能することを検証

### Integration Tests

- 価格情報セクションを編集モードにして何も変更せずに保存ボタンを押した場合、編集モードが維持されること
- 他セクションを先に編集した後、価格情報セクションで価格を変更せずに保存ボタンを押した場合、編集モードが維持されること
- 価格情報セクションで価格を変更して保存ボタンを押した場合、正常に保存されて編集モードが終了すること
