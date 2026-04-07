# 希望エリアフィールド保存バグ修正 Design

## Overview

買主リストの希望条件ページ（`BuyerDesiredConditionsPage.tsx`）において、希望エリアフィールド（`desired_area`）を変更して保存ボタンを押してもDBに保存されない問題を修正します。

根本原因は、希望エリアフィールドが`onClose`イベントに依存して`pendingChanges`に変更を反映しているため、ドロップダウンを閉じずに保存ボタンを押すと変更が反映されないことです。

修正方針は、`onChange`イベントで即座に`pendingChanges`に反映するように変更し、ドロップダウンの開閉状態に関係なく保存できるようにします。

## Glossary

- **Bug_Condition (C)**: ドロップダウンを閉じずに保存ボタンを押す、またはチップ削除後に古い値が参照される条件
- **Property (P)**: `onChange`イベントで即座に`pendingChanges`に反映され、ドロップダウンの開閉状態に関係なく保存される
- **Preservation**: 他のフィールドの保存動作、配信メール「要」時の必須バリデーション、ドロップダウンを閉じた後の保存動作
- **pendingChanges**: 未保存の変更を蓄積するオブジェクト（保存ボタン押下時に一括保存される）
- **selectedAreas**: 希望エリアの選択状態を保持するローカルstate
- **selectedAreasRef**: `selectedAreas`の最新値を保持するref（クロージャー問題を回避するため）
- **onClose**: MUI Selectコンポーネントのドロップダウンが閉じられた時に発火するイベント
- **onChange**: MUI Selectコンポーネントの選択が変更された時に発火するイベント

## Bug Details

### Bug Condition

バグは、ユーザーが希望エリアフィールドのドロップダウンで選択を変更し、ドロップダウンを閉じずに保存ボタンを押した時に発生します。現在の実装では、`onClose`イベントでのみ`pendingChanges`に変更を反映しているため、ドロップダウンが開いたままの状態では変更が反映されません。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: 'select' | 'chipDelete', dropdownClosed: boolean, saveButtonPressed: boolean }
  OUTPUT: boolean
  
  RETURN (input.action === 'select' AND NOT input.dropdownClosed AND input.saveButtonPressed)
         OR (input.action === 'chipDelete' AND input.saveButtonPressed AND selectedAreasRef.current !== selectedAreas)
END FUNCTION
```

### Examples

- **例1**: ユーザーがドロップダウンを開き、「熱海市」を選択し、ドロップダウンを閉じずに保存ボタンを押す → `onClose`が発火せず、`pendingChanges`に反映されないため、DBに保存されない
- **例2**: ユーザーがチップ削除ボタンで「熱海市」を削除し、すぐに保存ボタンを押す → `pendingChanges`には反映されているが、`selectedAreasRef.current`の値が古い可能性があり、正しく保存されない場合がある
- **例3**: ユーザーがドロップダウンを開き、「熱海市」を選択し、ドロップダウンを閉じた後に保存ボタンを押す → `onClose`で`pendingChanges`に反映されるため、正常に保存される（正常動作）
- **エッジケース**: ユーザーがドロップダウンを開き、複数のエリアを選択し、ドロップダウンを閉じずに保存ボタンを押す → 全ての選択が保存されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 希望エリア以外のフィールド（希望時期、希望種別、価格帯など）の保存動作は引き続き正常に動作する
- 配信メール「要」の買主の希望エリアを空にして保存しようとした場合、必須バリデーションエラーが表示される
- 希望エリアフィールドを変更せずに保存ボタンを押した場合、`pendingChanges`が空のため保存処理を実行しない

**Scope:**
希望エリアフィールド以外の全てのフィールドは、この修正の影響を受けません。これには以下が含まれます：
- InlineEditableFieldコンポーネントを使用するフィールド（希望時期、希望種別、価格帯など）
- 配信メール「要」時の必須バリデーションロジック
- 保存ボタンの有効/無効状態の制御

## Hypothesized Root Cause

bugfix.mdとコードレビューに基づき、最も可能性の高い原因は以下の通りです：

1. **onCloseイベント依存**: 現在の実装では、`onClose`イベントでのみ`handleFieldChange('desired_area', selectedAreasRef.current.join('|'))`を呼び出しているため、ドロップダウンを閉じない限り`pendingChanges`に反映されない

2. **onChangeイベントの未使用**: `onChange`イベントでは`setSelectedAreas`と`selectedAreasRef.current`の更新のみを行い、`handleFieldChange`を呼び出していない

3. **チップ削除時のref更新タイミング**: チップ削除時に`handleFieldChange`を呼び出しているが、`selectedAreasRef.current`の更新タイミングによっては古い値が参照される可能性がある

4. **クロージャー問題**: `onClose`イベントハンドラーが`selectedAreasRef.current`を参照しているが、`onChange`で即座に`pendingChanges`に反映していないため、ドロップダウンを閉じるまで変更が保留される

## Correctness Properties

Property 1: Bug Condition - ドロップダウンを閉じずに保存

_For any_ ユーザー操作において、希望エリアフィールドのドロップダウンで選択を変更した場合、修正後のコードは`onChange`イベントで即座に`pendingChanges`に反映し、ドロップダウンを閉じなくても保存ボタン押下時にDBに保存される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他のフィールドの保存動作

_For any_ 希望エリアフィールド以外のフィールド変更において、修正後のコードは引き続き正常にDBに保存し、スプレッドシートに同期する。配信メール「要」時の必須バリデーションも引き続き動作する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx`

**Component**: `<Select>` コンポーネント（希望エリアフィールド）

**Specific Changes**:
1. **onChangeイベントでpendingChangesに反映**: `onChange`イベントハンドラー内で、`setSelectedAreas`と`selectedAreasRef.current`の更新後、即座に`handleFieldChange('desired_area', selected.join('|'))`を呼び出す
   - 現在: `onChange`では`setSelectedAreas`と`selectedAreasRef.current`の更新のみ
   - 修正後: `onChange`で`handleFieldChange`も呼び出す

2. **onCloseイベントの削除または簡略化**: `onClose`イベントハンドラーは不要になるため、削除するか、または`onChange`で既に反映済みのため何もしないようにする
   - 現在: `onClose`で`handleFieldChange`を呼び出し
   - 修正後: `onClose`を削除、または空のハンドラーにする

3. **チップ削除時の即時反映**: チップ削除時の`handleFieldChange`呼び出しは既に実装されているが、`selectedAreasRef.current`ではなく、削除後の配列（`next`）を直接使用する
   - 現在: `handleFieldChange(field.key, next.join('|'))`（既に正しい）
   - 確認: `selectedAreasRef.current`の更新タイミングが正しいか確認

4. **selectedAreasRefの更新タイミング**: `onChange`と`onDelete`の両方で、`setSelectedAreas`と`selectedAreasRef.current`を同時に更新する
   - 現在: 両方で更新しているが、`onChange`で`handleFieldChange`を呼び出していない
   - 修正後: `onChange`でも`handleFieldChange`を呼び出す

5. **保存ボタンの動作確認**: `handleSaveAll`関数は`pendingChanges`を一括保存するため、修正後も引き続き動作する
   - 確認: `pendingChanges`に`desired_area`が正しく反映されているか確認

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従います：まず、未修正コードでバグを再現する探索的テストを実施し、次に修正後のコードで修正検証と保存動作の保持を確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを再現し、根本原因分析を確認または反証します。反証された場合は、再度根本原因を仮説立てします。

**Test Plan**: 希望条件ページで希望エリアフィールドのドロップダウンを開き、エリアを選択し、ドロップダウンを閉じずに保存ボタンを押すテストを実施します。未修正コードでテストを実行し、失敗を観察して根本原因を理解します。

**Test Cases**:
1. **ドロップダウンを閉じずに保存**: ドロップダウンを開き、「熱海市」を選択し、ドロップダウンを閉じずに保存ボタンを押す（未修正コードで失敗）
2. **チップ削除後すぐに保存**: チップ削除ボタンで「熱海市」を削除し、すぐに保存ボタンを押す（未修正コードで失敗する可能性）
3. **複数選択後ドロップダウンを閉じずに保存**: ドロップダウンを開き、「熱海市」「伊東市」を選択し、ドロップダウンを閉じずに保存ボタンを押す（未修正コードで失敗）
4. **ドロップダウンを閉じた後に保存**: ドロップダウンを開き、「熱海市」を選択し、ドロップダウンを閉じた後に保存ボタンを押す（未修正コードで成功）

**Expected Counterexamples**:
- `pendingChanges`に`desired_area`が反映されない
- 可能性のある原因: `onClose`イベントが発火しない、`onChange`で`handleFieldChange`を呼び出していない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力において、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleAreaChange_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Expected Behavior:**
- `onChange`イベントで即座に`pendingChanges`に反映される
- ドロップダウンを閉じなくても保存ボタン押下時にDBに保存される
- チップ削除後すぐに保存ボタンを押してもDBに保存される

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力において、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleAreaChange_original(input) = handleAreaChange_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは保存動作の保持チェックに推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを捕捉する
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: まず未修正コードで他のフィールドの保存動作を観察し、次にその動作を捕捉するプロパティベーステストを記述します。

**Test Cases**:
1. **他のフィールドの保存動作**: 希望時期、希望種別、価格帯などのフィールドを変更して保存ボタンを押し、未修正コードで正常に保存されることを確認し、修正後も引き続き動作することをテスト
2. **配信メール「要」時の必須バリデーション**: 配信メール「要」の買主の希望エリアを空にして保存しようとし、未修正コードでバリデーションエラーが表示されることを確認し、修正後も引き続き動作することをテスト
3. **ドロップダウンを閉じた後の保存動作**: ドロップダウンを開き、エリアを選択し、ドロップダウンを閉じた後に保存ボタンを押し、未修正コードで正常に保存されることを確認し、修正後も引き続き動作することをテスト
4. **変更なしで保存ボタンを押す**: 希望エリアフィールドを変更せずに保存ボタンを押し、未修正コードで保存処理が実行されないことを確認し、修正後も引き続き動作することをテスト

### Unit Tests

- ドロップダウンを閉じずに保存ボタンを押すテスト
- チップ削除後すぐに保存ボタンを押すテスト
- 複数選択後ドロップダウンを閉じずに保存ボタンを押すテスト
- ドロップダウンを閉じた後に保存ボタンを押すテスト（既存動作の保持）
- 他のフィールドの保存動作テスト（既存動作の保持）
- 配信メール「要」時の必須バリデーションテスト（既存動作の保持）

### Property-Based Tests

- ランダムなエリア選択を生成し、ドロップダウンの開閉状態に関係なく保存されることを検証
- ランダムなフィールド変更を生成し、希望エリア以外のフィールドの保存動作が保持されることを検証
- 多くのシナリオで配信メール「要」時の必須バリデーションが引き続き動作することをテスト

### Integration Tests

- 希望条件ページ全体のフローをテスト（エリア選択 → 保存 → DB確認 → スプレッドシート同期確認）
- 他のフィールドとの組み合わせテスト（エリア + 希望種別 + 価格帯を同時に変更して保存）
- 配信メール「要」の買主で希望エリアを空にして保存しようとするフローをテスト（バリデーションエラー表示確認）
