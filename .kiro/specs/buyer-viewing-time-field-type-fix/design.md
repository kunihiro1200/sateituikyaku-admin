# 買主新規登録画面 内覧時間フィールド型修正 Bugfix Design

## Overview

買主新規登録画面（`NewBuyerPage.tsx`）の「内覧時間」フィールドが `type="text"` のテキスト入力として実装されており、ブラウザ標準の時間ピッカーUIが表示されない。

修正方針は最小限の変更で対応する：対象の `TextField` に `type="time"` と `InputLabelProps={{ shrink: true }}` を追加するのみ。隣接する「内覧日」フィールドが `type="date"` + `InputLabelProps={{ shrink: true }}` で正しく実装されており、同じパターンを適用する。

## Glossary

- **Bug_Condition (C)**: 「内覧時間」フィールドが `type="time"` を持たない状態でレンダリングされる条件
- **Property (P)**: 「内覧時間」フィールドが `type="time"` として動作し、ブラウザ標準の時間ピッカーUIを提供すること
- **Preservation**: 「内覧日」フィールドの動作、フォーム送信時の `viewing_time` 値の送信、空値時の `null` 送信など、既存の動作が変わらないこと
- **viewingTime**: `NewBuyerPage.tsx` の state 変数。「内覧時間」フィールドの値を保持する
- **TextField**: MUI（Material-UI）のテキスト入力コンポーネント。`type` プロパティで入力種別を指定できる

## Bug Details

### Bug Condition

「内覧時間」フィールドは `type` プロパティが指定されていないため、デフォルトの `type="text"` として動作する。これにより、ブラウザが時間入力として認識せず、時間ピッカーUIが表示されない。

**Formal Specification:**
```
FUNCTION isBugCondition(field)
  INPUT: field は NewBuyerPage の「内覧時間」TextField コンポーネント
  OUTPUT: boolean

  RETURN field.props に "type" が存在しない
         OR field.props.type != "time"
END FUNCTION
```

### Examples

- 「内覧時間」フィールドをクリックしても時間ピッカーが表示されない（期待: 時間ピッカーが表示される）
- フィールドに "14:00" と手動入力できるが、HH:MM形式のバリデーションが機能しない（期待: ブラウザが時間形式を検証する）
- ラベル「内覧時間」がフィールド内に重なって表示される可能性がある（期待: `shrink: true` によりラベルが上部に固定される）
- 隣の「内覧日」フィールドは `type="date"` で正しく動作している（参照実装）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「内覧日」フィールド（`type="date"`）は修正後も変わらず正常に動作する
- 「内覧時間」フィールドに有効な時間（例: "14:00"）を入力して登録した場合、`viewing_time` フィールドとしてAPIに送信される動作は変わらない
- 「内覧時間」フィールドを空のまま登録した場合、`viewing_time: null` としてAPIに送信される動作は変わらない
- `viewingTime` state の更新ロジック（`onChange` ハンドラ）は変わらない

**Scope:**
「内覧時間」フィールドの `type` と `InputLabelProps` 以外のプロパティ（`fullWidth`、`label`、`value`、`onChange`）はすべて変更しない。

## Hypothesized Root Cause

1. **`type` プロパティの未指定**: 「内覧日」フィールドには `type="date"` が指定されているが、「内覧時間」フィールドには `type` プロパティが指定されていない。MUI の `TextField` はデフォルトで `type="text"` として動作するため、時間ピッカーが表示されない。

2. **`InputLabelProps` の未指定**: `type="time"` を指定した場合、初期値が空のときにラベルとプレースホルダーが重なる表示崩れが発生する。`InputLabelProps={{ shrink: true }}` を追加することで、ラベルを常に上部に固定する必要がある。

## Correctness Properties

Property 1: Bug Condition - 内覧時間フィールドが時間入力として動作する

_For any_ レンダリングされた「内覧時間」フィールドにおいて、バグ条件が成立する（`type="time"` が指定されていない）場合、修正後の `TextField` は SHALL `type="time"` プロパティを持ち、ブラウザ標準の時間ピッカーUIを提供する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存のフォーム動作が維持される

_For any_ 「内覧時間」フィールドへの入力操作において、バグ条件が成立しない（`type="time"` が正しく指定されている）場合、修正後のコードは SHALL 元のコードと同じ `viewing_time` 値をAPIに送信し、既存のフォーム送信動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/NewBuyerPage.tsx`

**Location**: 約1102行目の「内覧時間」TextField

**Specific Changes**:

1. **`type="time"` を追加**: ブラウザ標準の時間入力UIを有効化する
2. **`InputLabelProps={{ shrink: true }}` を追加**: ラベルを常に上部に固定し、表示崩れを防ぐ
3. **`placeholder` プロパティを削除**: `type="time"` ではブラウザが独自のプレースホルダー（`--:--`）を表示するため不要

**Before:**
```tsx
<TextField
  fullWidth
  label="内覧時間"
  value={viewingTime}
  onChange={(e) => setViewingTime(e.target.value)}
  placeholder="例: 14:00"
/>
```

**After:**
```tsx
<TextField
  fullWidth
  label="内覧時間"
  type="time"
  value={viewingTime}
  onChange={(e) => setViewingTime(e.target.value)}
  InputLabelProps={{ shrink: true }}
/>
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチで検証する：まず未修正コードでバグを確認し、次に修正後のコードで正しい動作と既存動作の保持を確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを確認し、根本原因分析を検証する。

**Test Plan**: 未修正の `NewBuyerPage.tsx` をレンダリングし、「内覧時間」フィールドの `type` 属性を確認する。

**Test Cases**:
1. **type属性確認テスト**: 「内覧時間」フィールドの `input` 要素の `type` 属性が `"text"` であることを確認（未修正コードで失敗するはず）
2. **InputLabelProps確認テスト**: `InputLabelProps` が指定されていないことを確認（未修正コードで確認）
3. **隣接フィールド比較テスト**: 「内覧日」フィールドが `type="date"` を持つことを確認（参照実装として）

**Expected Counterexamples**:
- 「内覧時間」フィールドの `input` 要素の `type` が `"text"` になっている
- `InputLabelProps` が未指定のため、ラベルが `shrink` しない

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを確認する。

**Pseudocode:**
```
FOR ALL field WHERE isBugCondition(field) DO
  result := render(fixedTextField)
  ASSERT result.input.type == "time"
  ASSERT result.InputLabelProps.shrink == true
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後のコードが元のコードと同じ結果を生成することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(field) DO
  ASSERT original_onChange(input) == fixed_onChange(input)
  ASSERT original_apiPayload(input) == fixed_apiPayload(input)
END FOR
```

**Testing Approach**: フォーム送信時の `viewing_time` 値の送信動作は変更しないため、`onChange` ハンドラと state 更新ロジックが同一であることを確認する。

**Test Cases**:
1. **値の送信保持テスト**: "14:00" を入力して登録した場合、`viewing_time: "14:00"` がAPIに送信されることを確認
2. **空値の送信保持テスト**: フィールドを空のまま登録した場合、`viewing_time: null` がAPIに送信されることを確認
3. **内覧日フィールド保持テスト**: 「内覧日」フィールドの動作が修正後も変わらないことを確認

### Unit Tests

- 「内覧時間」フィールドの `input` 要素が `type="time"` を持つことを確認
- `InputLabelProps={{ shrink: true }}` が適用されていることを確認
- `onChange` ハンドラが `viewingTime` state を正しく更新することを確認

### Property-Based Tests

- ランダムな時間文字列（"00:00"〜"23:59"）を入力した場合、`viewingTime` state が正しく更新されることを確認
- 空文字列を入力した場合、`viewingTime` state が空文字列になることを確認

### Integration Tests

- フォーム全体をレンダリングし、「内覧時間」フィールドに時間を入力して登録ボタンを押した場合、APIに正しい `viewing_time` 値が送信されることを確認
- 「内覧日」と「内覧時間」の両フィールドを入力して登録した場合、両方の値がAPIに送信されることを確認
