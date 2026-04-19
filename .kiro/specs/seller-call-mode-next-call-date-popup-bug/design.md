# 売主通話モード 次電日変更後ポップアップ誤表示 バグ修正デザイン

## Overview

売主リストの通話モードページ（`CallModePage`）において、次電日を変更した後にバックグラウンドポーリングが走ると、`editedNextCallDate` が古い値に上書きされる。その結果、`editedNextCallDate === savedNextCallDate` が誤って `true` になり、「次電日を変更しなくてよいか？」確認ダイアログ（`NextCallDateReminderDialog`）が不正に表示される。

修正方針は最小限の変更に留める。ポーリング処理（`freshData` 更新ブロック）で `setEditedNextCallDate` を呼ぶ際に、`setSavedNextCallDate` も同時に呼ぶことで、両値を常に同期させる。ただし、ユーザーが次電日を編集中（`statusChangedRef.current === true`）の場合はどちらも上書きしない。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — ユーザーが次電日を変更した後、バックグラウンドポーリングが `editedNextCallDate` を古い値に上書きし、かつ `savedNextCallDate` が更新されないため `editedNextCallDate === savedNextCallDate` が誤って `true` になる状態
- **Property (P)**: 次電日が変更済みの場合、`shouldShowReminderDialog` は `false` を返すべきという期待動作
- **Preservation**: 次電日が変更されていない場合のダイアログ表示ロジック、マウス操作・その他フィールド編集など既存の全動作が変更後も同一であること
- **`editedNextCallDate`**: 画面上で現在表示・編集中の次電日の値（`useState`）
- **`savedNextCallDate`**: 最後に保存された次電日の値（変更検知の基準値、`useState`）
- **`statusChangedRef`**: ユーザーが何らかの編集を行ったかを追跡する `useRef`（`true` の間はポーリングによる上書きを防ぐ）
- **`freshData`**: バックグラウンドポーリングで取得した最新のサーバーデータ
- **`shouldShowReminderDialog`**: 4条件（経過日数・追客中・pageEdited・次電日未変更）がすべて `true` の場合のみ `true` を返す純粋関数

## Bug Details

### Bug Condition

バグは以下の手順で発現する。

1. ユーザーが次電日を変更する（`setEditedNextCallDate` が新しい値に更新される）
2. バックグラウンドポーリングが走り、`freshData` を取得する
3. `statusChangedRef.current === true` のため `setEditedNextCallDate(freshData.nextCallDate)` は **呼ばれない**（ポーリングによる上書き防止が機能している）
4. しかし `setSavedNextCallDate` はポーリング処理内で **一切呼ばれていない**
5. 結果として `savedNextCallDate` は初期ロード時の古い値のまま残る
6. ユーザーが次電日を変更した新しい値が `editedNextCallDate` に入っているが、`savedNextCallDate` も同じ古い値のまま → `editedNextCallDate === savedNextCallDate` が `true` になる
7. ページ遷移時に `shouldShowReminderDialog` が `true` を返し、ダイアログが誤表示される

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type {
    editedNextCallDate: string,       // ユーザーが変更した新しい次電日
    savedNextCallDate: string,        // 初期ロード時の古い次電日（未更新）
    pollingHasOccurred: boolean,      // ポーリングが1回以上走ったか
    statusChangedRef: boolean         // ユーザーが編集操作を行ったか
  }
  OUTPUT: boolean

  // ユーザーが次電日を変更したにもかかわらず、
  // ポーリング後も savedNextCallDate が更新されず
  // 誤って「未変更」と判定される状態
  RETURN X.editedNextCallDate !== X.savedNextCallDate_actual  // 実際には変更されている
         AND X.editedNextCallDate === X.savedNextCallDate     // しかし比較上は同値になっている
         AND X.pollingHasOccurred                            // ポーリングが走った
         AND X.statusChangedRef                              // ユーザーが編集した
END FUNCTION
```

### Examples

- **例1（バグ発現）**: 次電日を `2025-07-01` → `2025-07-15` に変更 → ポーリング発生 → `savedNextCallDate` は `2025-07-01` のまま → `editedNextCallDate('2025-07-15') === savedNextCallDate('2025-07-01')` は `false` のはずが、ポーリングで `editedNextCallDate` が `2025-07-01` に戻された場合は `true` になりダイアログ表示
- **例2（バグ発現・別パターン）**: 次電日を変更 → 保存せずにポーリング発生 → `editedNextCallDate` が古い値に戻る → `savedNextCallDate` も古い値のまま → 両者が一致してダイアログ表示
- **例3（正常動作）**: 次電日を変更せずに他フィールドを編集 → ポーリング発生 → `editedNextCallDate === savedNextCallDate` は `true`（正しい） → ダイアログ表示（正しい）
- **例4（エッジケース）**: 次電日を変更 → 保存 → ポーリング発生 → 保存時に `setSavedNextCallDate(editedNextCallDate)` が呼ばれているため正常動作

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 次電日を変更せずにページ遷移した場合のダイアログ表示ロジック（要件 3.4）
- マウスクリックによるボタン操作・フィールド編集の動作
- 反響日付が3日未満の場合はダイアログを表示しない動作（要件 3.1）
- 状況（当社）が「追客中」を含まない場合はダイアログを表示しない動作（要件 3.2）
- `pageEdited` が `false` の場合はダイアログを表示しない動作（要件 3.3）
- 保存処理（`handleSave`）後の `savedNextCallDate` 更新ロジック
- `statusChangedRef` による既存のポーリング上書き防止ロジック

**スコープ:**
バグ条件（`isBugCondition`）が成立しない全ての入力は、修正後も修正前と完全に同一の動作をすること。

## Hypothesized Root Cause

調査済みの根本原因に基づく分析:

1. **`setSavedNextCallDate` の呼び出し漏れ**: ポーリング処理（`freshData` 更新ブロック、行 1599〜）では `setEditedNextCallDate` は `statusChangedRef.current === false` の場合のみ呼ばれるが、`setSavedNextCallDate` はどのケースでも呼ばれていない。`savedNextCallDate` は初期ロード時（行 1683）と保存成功時（行 2412, 3879）にのみ更新される。

2. **ポーリング上書き防止ロジックの副作用**: `statusChangedRef.current === true` の場合、`setEditedNextCallDate` の呼び出しをスキップすることでユーザーの編集を保護しているが、`savedNextCallDate` の同期も行われないため、基準値が古いままになる。

3. **状態の非対称性**: `editedNextCallDate` と `savedNextCallDate` は「ユーザーが変更した値」と「最後に保存した値」を表すべきだが、ポーリング後は `savedNextCallDate` が「サーバーの最新値」を反映しなくなる。

## Correctness Properties

Property 1: Bug Condition - 次電日変更時はダイアログを表示しない

_For any_ 入力において、ユーザーが次電日を変更した後にバックグラウンドポーリングが発生した場合、修正後の `shouldShowReminderDialog` に渡される `nextCallDateUnchanged` は `false` となり、ダイアログは表示されない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 次電日未変更時の動作は変わらない

_For any_ 入力において、バグ条件が成立しない場合（次電日を変更していない、またはポーリングが発生していない）、修正後のコードは修正前のコードと完全に同一の動作をし、既存のダイアログ表示ロジックを保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

**関数/処理ブロック**: バックグラウンドポーリング処理（`freshData` 更新ブロック、行 1599〜1620 付近）

**具体的な変更:**

1. **`setSavedNextCallDate` の追加**: `statusChangedRef.current === false` の場合に `setEditedNextCallDate` を呼ぶブロック内で、`setSavedNextCallDate(freshData.nextCallDate || '')` を追加する。

   **変更前（概略）:**
   ```typescript
   if (!statusChangedRef.current) {
     setEditedStatus(freshData.status);
     setEditedConfidence(freshData.confidence || '');
     setEditedNextCallDate(freshData.nextCallDate || '');  // editedのみ更新
     setEditedPinrichStatus(freshData.pinrichStatus || '');
     // ...
   }
   ```

   **変更後（概略）:**
   ```typescript
   if (!statusChangedRef.current) {
     setEditedStatus(freshData.status);
     setEditedConfidence(freshData.confidence || '');
     setEditedNextCallDate(freshData.nextCallDate || '');
     setSavedNextCallDate(freshData.nextCallDate || '');  // savedも同時に更新
     setEditedPinrichStatus(freshData.pinrichStatus || '');
     // ...
   }
   ```

2. **変更の意図**: `statusChangedRef.current === false`（ユーザーが編集していない）の場合、サーバーの最新値で `editedNextCallDate` と `savedNextCallDate` の両方を同期する。これにより、ポーリング後も「変更前の基準値」が正しく保たれる。

3. **`statusChangedRef.current === true` の場合は変更不要**: ユーザーが編集中の場合、`editedNextCallDate` はユーザーの入力値を保持し、`savedNextCallDate` は最後に保存した値を保持する。この状態は正しいため変更しない。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現し根本原因を確認、次に修正後のコードで Fix Checking と Preservation Checking を実施する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `CallModePage` の `freshData` 更新ブロックをモックし、次電日変更後にポーリングが走った場合の `editedNextCallDate` と `savedNextCallDate` の値を検証する。未修正コードでテストを実行し、失敗を観察する。

**Test Cases**:
1. **次電日変更後ポーリング発生テスト**: 次電日を変更 → `statusChangedRef.current = true` の状態でポーリング → `editedNextCallDate` と `savedNextCallDate` の値を確認（未修正コードでは `savedNextCallDate` が古い値のまま）
2. **ダイアログ誤表示テスト**: 上記状態でページ遷移を試みる → `shouldShowReminderDialog` が `true` を返すことを確認（未修正コードでは誤って `true`）
3. **`shouldShowReminderDialog` 単体テスト**: `nextCallDateUnchanged = true` を渡した場合に `true` を返すことを確認（関数自体は正しい）

**Expected Counterexamples**:
- 未修正コードでは、次電日変更後にポーリングが走ると `savedNextCallDate` が更新されず、`editedNextCallDate === savedNextCallDate` が誤って `true` になる
- 結果として `shouldShowReminderDialog` が `true` を返し、ダイアログが誤表示される

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後のコードが期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  // 次電日変更後にポーリングが走った状態をシミュレート
  result := shouldShowReminderDialog_fixed(
    isElapsed,
    isFollowingUp,
    pageEdited,
    editedNextCallDate_fixed === savedNextCallDate_fixed  // 修正後は false になるはず
  )
  ASSERT result = false
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後のコードが修正前と同一の動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT shouldShowReminderDialog_original(X) = shouldShowReminderDialog_fixed(X)
END FOR
```

**Testing Approach**: `shouldShowReminderDialog` は純粋関数であるため、プロパティベーステストで多数の入力パターンを生成して検証できる。

**Test Cases**:
1. **次電日未変更・ポーリングなし**: `editedNextCallDate === savedNextCallDate` が `true` → ダイアログ表示（変更なし）
2. **次電日未変更・ポーリングあり**: ポーリング後も `editedNextCallDate === savedNextCallDate` が `true` → ダイアログ表示（変更なし）
3. **反響日付3日未満**: `isElapsed = false` → ダイアログ非表示（変更なし）
4. **追客中でない**: `isFollowingUp = false` → ダイアログ非表示（変更なし）
5. **`pageEdited = false`**: ダイアログ非表示（変更なし）

### Unit Tests

- `shouldShowReminderDialog` の全4条件の組み合わせテスト（16パターン）
- `isInquiryDateElapsed3Days` の境界値テスト（2日・3日・4日）
- ポーリング処理後の `savedNextCallDate` 更新確認テスト
- `statusChangedRef.current = true` の場合にポーリングが `editedNextCallDate` を上書きしないことの確認テスト

### Property-Based Tests

- ランダムな次電日の値を生成し、変更後にポーリングが走っても `editedNextCallDate !== savedNextCallDate` が保たれることを検証
- ランダムな4条件の組み合わせで `shouldShowReminderDialog` の純粋関数としての正しさを検証
- バグ条件が成立しない多数のシナリオで修正前後の動作が一致することを検証

### Integration Tests

- 次電日変更 → ポーリング発生 → ページ遷移 → ダイアログが表示されないことを確認
- 次電日未変更 → ポーリング発生 → ページ遷移 → ダイアログが表示されることを確認
- 次電日変更 → 保存 → ポーリング発生 → ページ遷移 → ダイアログが表示されないことを確認
