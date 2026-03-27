# call-mode-comment-quick-button-fix Bugfix Design

## Overview

通話モードページ（CallModePage）のコメント欄（RichTextCommentEditor）において、クイックボタンで太字テキストを挿入する際に2つのバグが存在する。

**バグ1**: `insertAtCursor` 実行後にエディタへのフォーカスが戻らないため、`isFocusedRef.current` が `false` のままになり、`selectionchange` イベントによるカーソル位置の追跡が停止する。その結果、2度目以降のクイックボタン押下時に `cursorOffsetRef` が古い値のままとなり、意図しない位置（末尾など）に挿入される。

**バグ2**: `range.insertNode(fragment)` でDOMに太字テキストを挿入した後、カーソルが太字ノードの内側に残る。そのため、続けてキーボードで文字を入力すると太字コンテキストが継続し、入力文字が太字になってしまう。

修正方針は最小限の変更で両バグを解消することとし、既存の太字ボタン・赤字ボタン・通常入力などの動作は一切変更しない。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — クイックボタンによる `insertAtCursor` 呼び出し
- **Property (P)**: 期待される正しい動作 — 保存されたカーソル位置への挿入、かつ挿入後の入力が非太字
- **Preservation**: 修正によって変更してはならない既存動作（太字ボタン、赤字ボタン、通常キーボード入力、onChangeコールバック）
- **insertAtCursor**: `RichTextCommentEditorHandle` が公開するメソッド。外部（クイックボタン）から呼び出され、指定HTMLをカーソル位置に挿入する
- **cursorOffsetRef**: テキストオフセットでカーソル位置を保持する `useRef`。`selectionchange` イベントで更新される
- **isFocusedRef**: エディタがフォーカス中かどうかを示す `useRef`。`false` の場合、`selectionchange` ハンドラはカーソル位置を更新しない

## Bug Details

### Bug Condition

**バグ1（カーソル位置追跡の停止）**: クイックボタンを押すと `insertAtCursor` が呼ばれる。このメソッドはエディタのDOMを直接操作するが、`editor.focus()` を呼ばないため `isFocusedRef.current` が `false` のままになる。`selectionchange` ハンドラは `isFocusedRef.current === false` の場合に `saveCursorOffset()` をスキップするため、挿入後のカーソル位置が `cursorOffsetRef` に保存されない。次回 `insertAtCursor` が呼ばれた時、`savedOffset` は挿入前の古い値（または -1）のままとなり、意図しない位置に挿入される。

**バグ2（太字コンテキストの継続）**: `range.insertNode(fragment)` でDOMに太字テキストを挿入した後、`range.collapse(false)` でカーソルを挿入後に移動するが、このカーソル位置は太字ノードの直後（まだ太字コンテキスト内）に留まる場合がある。`document.queryCommandState('bold')` が `true` の状態でキーボード入力すると、入力文字が太字になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { type: 'quickButton' | 'keyboard' | 'toolbarButton', html?: string }
  OUTPUT: boolean

  RETURN input.type === 'quickButton'
         AND insertAtCursor(input.html) が呼ばれた
END FUNCTION
```

### Examples

- **バグ1の例**: エディタに「テスト」と入力してカーソルを「テ」の後に置く → クイックボタンを押す（「テ[挿入]スト」になる）→ カーソルを「ス」の後に移動 → 再度クイックボタンを押す → 期待: 「テ[挿入]ス[挿入]ト」、実際: 「テ[挿入]スト[挿入]」（末尾に挿入される）
- **バグ2の例**: エディタが空の状態でクイックボタンを押す（太字テキストが挿入される）→ キーボードで「abc」と入力 → 期待: 「[太字テキスト]abc」（abcは通常）、実際: 「[太字テキスト]**abc**」（abcも太字）
- **バグ1+2の複合例**: 2度目のクイックボタン押下後に入力すると、末尾に太字で入力される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- ツールバーの太字ボタン（FormatBold）を押した場合の選択テキスト太字切り替えは変更しない
- ツールバーの赤字ボタン（FormatColorText）を押した場合の選択テキスト赤字切り替えは変更しない
- エディタへの通常キーボード入力（文字表示と `onChange` 呼び出し）は変更しない
- エディタの内容変更時の `onChange` コールバック通知は変更しない
- `handleBlur` でのカーソル位置保存動作は変更しない

**Scope:**
`insertAtCursor` メソッド内の処理のみを修正する。クイックボタン以外の操作（マウスクリック、ツールバーボタン、キーボード入力）は完全に影響を受けない。

## Hypothesized Root Cause

### バグ1の根本原因

**フォーカス状態の不整合**: `insertAtCursor` はDOMを直接操作してテキストを挿入するが、`editor.focus()` を呼ばない。クイックボタンをクリックするとエディタからフォーカスが外れ、`handleBlur` が呼ばれて `isFocusedRef.current = false` になる。その後 `insertAtCursor` が実行されても `isFocusedRef.current` は `false` のままなので、`selectionchange` イベントが発火しても `saveCursorOffset()` がスキップされる。

**修正箇所**: `insertAtCursor` の末尾（`return` の前と、フォールバックパスの末尾）で `editor.focus()` → `isFocusedRef.current = true` → `saveCursorOffset()` を呼ぶ。

### バグ2の根本原因

**太字コンテキストの残存**: `range.insertNode(fragment)` で太字テキストを挿入した後、`range.collapse(false)` でカーソルを挿入後に移動するが、ブラウザの実装によってはカーソルが太字ノードの内側または直後の太字コンテキスト内に留まる。`document.queryCommandState('bold')` が `true` の状態では、次のキーボード入力が太字になる。

**修正箇所**: `range.collapse(false)` の後、`document.queryCommandState('bold')` が `true` であれば `document.execCommand('bold', false)` を実行して太字状態を解除する。

## Correctness Properties

Property 1: Bug Condition - クイックボタン挿入後のカーソル位置追跡

_For any_ `insertAtCursor(html)` 呼び出しにおいて（isBugCondition returns true）、修正後の `insertAtCursor` は挿入完了後にエディタにフォーカスを戻し、`isFocusedRef.current = true` にした上で `saveCursorOffset()` を呼ぶことで、次回の `insertAtCursor` 呼び出し時に正しいカーソル位置（挿入後の位置）を使用 SHALL する。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - 挿入後の太字コンテキスト解除

_For any_ `insertAtCursor(html)` 呼び出しにおいて（isBugCondition returns true）、修正後の `insertAtCursor` は挿入後に `document.queryCommandState('bold')` が `true` であれば `document.execCommand('bold', false)` を実行し、次のキーボード入力が非太字になる状態を保証 SHALL する。

**Validates: Requirements 2.3**

Property 3: Preservation - クイックボタン以外の操作の保持

_For any_ 操作において isBugCondition が false（クイックボタン以外の操作）の場合、修正後のコードは元のコードと同一の動作を SHALL 保持する。具体的には、太字ボタン・赤字ボタン・通常キーボード入力・onChangeコールバックの動作が変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/RichTextCommentEditor.tsx`

**Function**: `insertAtCursor`（`useImperativeHandle` 内）

### 変更1: 挿入後のフォーカス復帰とカーソル位置保存（バグ1修正）

`savedOffset >= 0` のパス（DOMを直接操作するパス）の `return` 直前に追加：

```typescript
// 挿入後にフォーカスを戻してカーソル位置を更新
editor.focus();
isFocusedRef.current = true;
saveCursorOffset();
return;
```

### 変更2: 挿入後の太字コンテキスト解除（バグ2修正）

`range.collapse(false)` の後、`sel.addRange(range)` の後に追加：

```typescript
// 太字コンテキストが残っている場合は解除
if (document.queryCommandState('bold')) {
  document.execCommand('bold', false);
}
```

### 変更3: フォールバックパスにも同様の修正を適用

`document.execCommand('insertHTML', ...)` を使うフォールバックパスの末尾にも、フォーカス復帰と太字解除を追加：

```typescript
document.execCommand('insertHTML', false, html);
// 太字コンテキストが残っている場合は解除
if (document.queryCommandState('bold')) {
  document.execCommand('bold', false);
}
handleInput();
// フォーカスを戻してカーソル位置を更新
isFocusedRef.current = true;
saveCursorOffset();
```

### 変更の最小性

- 変更対象は `insertAtCursor` メソッド内のみ
- `handleBold`、`handleRedText`、`handleInput`、`handleFocus`、`handleBlur` は一切変更しない
- 追加するコードは合計6行以下

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず未修正コードでバグを再現するテストを書いてバグの根本原因を確認し、次に修正後のコードでバグが解消され既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `RichTextCommentEditor` をレンダリングし、`insertAtCursor` を複数回呼び出して挿入位置とカーソル状態を検証する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **バグ1再現テスト**: エディタに文字を入力してカーソルを中間に置く → `insertAtCursor` を1回呼ぶ → カーソルを別の位置に移動 → `insertAtCursor` を2回目に呼ぶ → 2回目の挿入位置が正しいカーソル位置であることを確認（未修正コードでは失敗する）
2. **バグ2再現テスト**: `insertAtCursor` で太字テキストを挿入 → `document.queryCommandState('bold')` が `false` であることを確認（未修正コードでは `true` になる）
3. **isFocusedRef追跡テスト**: `insertAtCursor` 後に `isFocusedRef.current` が `true` であることを確認（未修正コードでは `false` のまま）

**Expected Counterexamples**:
- 2回目の `insertAtCursor` が末尾に挿入される（バグ1）
- `insertAtCursor` 後に `document.queryCommandState('bold')` が `true` のまま（バグ2）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := insertAtCursor_fixed(input.html)
  ASSERT editor.isFocused === true
  ASSERT cursorOffsetRef.current === (挿入後の正しいオフセット)
  ASSERT document.queryCommandState('bold') === false
END FOR
```

### Preservation Checking

**Goal**: クイックボタン以外の操作（バグ条件が成立しない入力）で、修正前後の動作が同一であることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) === fixedBehavior(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な入力パターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存動作が保持されることを強く保証できる

**Test Cases**:
1. **太字ボタン保持テスト**: テキストを選択して太字ボタンを押した場合の動作が変わらないことを確認
2. **赤字ボタン保持テスト**: テキストを選択して赤字ボタンを押した場合の動作が変わらないことを確認
3. **通常入力保持テスト**: キーボードで文字を入力した場合に `onChange` が正しく呼ばれることを確認
4. **onChangeコールバック保持テスト**: エディタ内容変更時に最新HTMLが通知されることを確認

### Unit Tests

- `insertAtCursor` を1回呼んだ後の挿入位置が正しいことを確認
- `insertAtCursor` を2回呼んだ後の2回目の挿入位置が正しいことを確認
- `insertAtCursor` 後に `document.queryCommandState('bold')` が `false` であることを確認
- `savedOffset < 0`（カーソル未保存）の場合に先頭挿入されることを確認
- `insertAtCursor` 後に `isFocusedRef.current` が `true` であることを確認

### Property-Based Tests

- ランダムなカーソル位置でのクイックボタン挿入が常に正しい位置に挿入されることを検証
- 複数回の `insertAtCursor` 呼び出しで挿入位置が累積的に正しく追跡されることを検証
- 任意のHTML文字列を挿入した後に太字コンテキストが解除されることを検証

### Integration Tests

- 通話モードページでクイックボタンを複数回押して、全て正しい位置に挿入されることを確認
- クイックボタン挿入後にキーボードで入力して、入力文字が非太字であることを確認
- クイックボタン挿入後にツールバーの太字ボタンが正常に動作することを確認
