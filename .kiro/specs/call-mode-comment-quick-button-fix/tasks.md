# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - クイックボタン挿入後のカーソル位置追跡・太字コンテキスト残存
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing cases
  - Test 1 (バグ1): `insertAtCursor` を1回呼んだ後、カーソルを別の位置に移動し、2回目の `insertAtCursor` を呼ぶ → 2回目の挿入位置が正しいカーソル位置であることを確認（isBugCondition: input.type === 'quickButton' AND insertAtCursor が呼ばれた）
  - Test 2 (バグ2): `insertAtCursor` で太字テキストを挿入した後、`document.queryCommandState('bold')` が `false` であることを確認
  - Test 3: `insertAtCursor` 後に `isFocusedRef.current` が `true` であることを確認
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "2回目の insertAtCursor が末尾に挿入される", "insertAtCursor 後に bold が true のまま")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - クイックボタン以外の操作の保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (isBugCondition returns false: ツールバーボタン・キーボード入力)
  - Observe: 太字ボタンを押した場合の選択テキスト太字切り替えが正常に動作する
  - Observe: 赤字ボタンを押した場合の選択テキスト赤字切り替えが正常に動作する
  - Observe: キーボード入力時に `onChange` が正しく呼ばれる
  - Write property-based tests: for all non-quickButton operations, behavior is unchanged from Preservation Requirements in design
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for クイックボタン挿入後のカーソル位置追跡停止・太字コンテキスト残存

  - [x] 3.1 Implement the fix
    - `insertAtCursor` の `savedOffset >= 0` パス（DOMを直接操作するパス）の `return` 直前に追加: `editor.focus(); isFocusedRef.current = true; saveCursorOffset();`
    - `range.collapse(false)` と `sel.addRange(range)` の後に追加: `if (document.queryCommandState('bold')) { document.execCommand('bold', false); }`
    - フォールバックパス（`document.execCommand('insertHTML', ...)` を使うパス）の末尾にも同様の修正を適用: 太字解除 + `isFocusedRef.current = true; saveCursorOffset();`
    - 変更対象は `insertAtCursor` メソッド内のみ（`handleBold`、`handleRedText`、`handleInput`、`handleFocus`、`handleBlur` は変更しない）
    - _Bug_Condition: isBugCondition(input) where input.type === 'quickButton' AND insertAtCursor(input.html) が呼ばれた_
    - _Expected_Behavior: 挿入後にエディタにフォーカスが戻り isFocusedRef.current = true になり saveCursorOffset() が呼ばれる。かつ document.queryCommandState('bold') === false になる_
    - _Preservation: handleBold・handleRedText・handleInput・handleFocus・handleBlur は一切変更しない。insertAtCursor 以外の操作は完全に影響を受けない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - クイックボタン挿入後のカーソル位置追跡・太字コンテキスト解除
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - クイックボタン以外の操作の保持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
