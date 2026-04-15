# 売主通話モード ステータスクリック遅延バグ修正 デザインドキュメント

## Overview

売主リストの通話モードページ（`CallModePage`）のステータスセクションにある「次電日」フィールド（`type="date"` の MUI TextField）において、カレンダーから日付を選択しても `statusChanged` フラグが `true` にならず、「ステータスを更新」ボタンが有効化されないバグを修正する。

根本原因は `onClick` ハンドラが `showPicker()` のみを呼び出し、`setStatusChanged(true)` を呼ばないこと。また、`type="date"` の MUI TextField では `onChange` がブラウザ差異や MUI の内部挙動により発火しないケースがある。

修正方針は **`onClick` ハンドラに `setStatusChanged(true)` の呼び出しを追加する**こと。これにより、ユーザーがカレンダーを開いた時点で `statusChanged` が `true` になり、日付選択後に保存ボタンが即座に有効化される。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 次電日フィールドをクリックしてカレンダーから日付を選択した際に `onChange` が発火せず、`statusChanged` が `true` にならないこと
- **Property (P)**: 期待される動作 — 次電日フィールドをクリックした時点で `statusChanged` が `true` になり、「ステータスを更新」ボタンが有効化されること
- **Preservation**: 修正によって変更してはいけない既存動作 — 他フィールドの変更検知、保存成功後のリセット、バリデーション処理、遷移ブロック機能
- **statusChanged**: ステータスセクションのいずれかのフィールドが変更されたことを示すフラグ。`true` の場合に「ステータスを更新」ボタンが有効化される
- **statusChangedRef**: バックグラウンド更新のクロージャ内で `statusChanged` の最新値を参照するための `useRef`
- **nextCallDateRef**: 次電日フィールドの DOM 要素への参照。`showPicker()` の呼び出しに使用される
- **showPicker()**: ブラウザネイティブのカレンダー UI を表示するメソッド
- **handleUpdateStatus**: 「ステータスを更新」ボタンのクリックハンドラ。`statusChanged` が `true` の場合のみ API を呼び出す

## Bug Details

### Bug Condition

バグは次電日フィールドをクリックしてカレンダーから日付を選択した際に発生する。`onClick` ハンドラは `showPicker()` のみを呼び出し、`setStatusChanged(true)` を呼ばない。また、`type="date"` の MUI TextField では `onChange` がブラウザ差異（特に Chrome の日付ピッカー）や MUI の内部挙動により発火しないケースがある。このため、`statusChanged` が `true` にならず「ステータスを更新」ボタンが有効化されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, action: 'click' | 'change' }
  OUTPUT: boolean

  RETURN input.fieldName = 'nextCallDate'
         AND input.action = 'click'
         AND onChangeDidNotFire(input)
         AND statusChanged IS false
END FUNCTION
```

### Examples

- 次電日フィールドをクリックしてカレンダーから「2025/08/01」を選択 → `onChange` が発火しない場合、`statusChanged` が `false` のまま「ステータスを更新」ボタンが無効のまま（期待: ボタンが有効化される）
- 次電日フィールドをクリックしてカレンダーから日付を選択後、「ステータスを更新」ボタンを1回押す → ボタンが無効状態のため押下を受け付けない（期待: 1回の押下で保存が実行される）
- 次電日フィールドを複数回クリックまたは操作する → ある操作のタイミングで `onChange` が発火し、ようやく `statusChanged` が `true` になる（期待: 最初のクリックで `statusChanged` が `true` になる）
- 状況（当社）フィールドを変更する → `onChange` が正常に発火し `statusChanged` が `true` になる（これは正常動作、修正対象外）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 状況（当社）・確度・Pinrichステータスなど他フィールドの `onChange` による `statusChanged` の `true` 設定は引き続き動作する
- 保存成功後に `statusChanged` が `false` にリセットされる動作は維持される
- 売主データ読み込み時に `statusChanged` が `false` に初期化される動作は維持される
- バリデーションエラー時（確度未入力、専任他決の必須フィールド未入力等）に API が呼ばれない動作は維持される
- 追客中かつ次電日が未入力の状態でページを離れようとした際の遷移ブロックダイアログは維持される
- 保存処理中（`savingStatus=true`）のボタン無効化は維持される

**Scope:**
次電日フィールドの `onClick` ハンドラへの `setStatusChanged(true)` 追加のみが変更対象。他のフィールドや処理フローは一切変更しない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通り：

1. **onClick ハンドラの不完全な実装**: 現在の `onClick` ハンドラは `showPicker()` のみを呼び出している。`showPicker()` はカレンダー UI を表示するだけで、`statusChanged` フラグを更新しない
   ```tsx
   // 現在の実装（バグあり）
   onClick={() => nextCallDateRef.current?.showPicker?.()}
   ```

2. **type="date" の onChange 未発火問題**: MUI TextField の `type="date"` では、ブラウザのネイティブカレンダー UI から日付を選択した際に `onChange` が発火しないケースがある。特に Chrome では、カレンダーを開いて同じ日付を選択した場合や、特定の操作順序で `onChange` が発火しないことがある

3. **設計上の問題**: `statusChanged` の更新が `onChange` イベントのみに依存しており、`onClick` でカレンダーを開いた時点では更新されない。ユーザーの意図（フィールドを操作した）を `onClick` の時点でキャプチャすべきだった

## Correctness Properties

Property 1: Bug Condition - 次電日フィールドクリック時の即時 statusChanged 更新

_For any_ 次電日フィールドへのクリック操作（isBugCondition が true を返す場合）において、修正後の `onClick` ハンドラは `setStatusChanged(true)` と `statusChangedRef.current = true` を呼び出し、「ステータスを更新」ボタンを即座に有効化する SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他フィールドの変更検知動作の維持

_For any_ 次電日フィールド以外のフィールド変更（isBugCondition が false を返す場合）において、修正後のコードは修正前と同一の動作を維持する SHALL。状況（当社）・確度・Pinrichステータスなど全ての他フィールドの `onChange` による `statusChanged` 更新が引き続き正常に動作する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**対象箇所**: 次電日フィールドの `onClick` ハンドラ（行 7045 付近）

**Specific Changes**:

1. **onClick ハンドラに setStatusChanged(true) を追加**: `showPicker()` の呼び出しに加えて、`setStatusChanged(true)` と `statusChangedRef.current = true` を呼び出す

   ```tsx
   // 修正前
   onClick={() => nextCallDateRef.current?.showPicker?.()}

   // 修正後
   onClick={() => {
     nextCallDateRef.current?.showPicker?.();
     setStatusChanged(true);
     statusChangedRef.current = true;
   }}
   ```

**変更の最小性**: この修正は1箇所のみの変更で、他のコードへの影響は一切ない。`onChange` ハンドラは既に `setStatusChanged(true)` を呼び出しているため、`onClick` と `onChange` の両方で呼ばれても問題ない（冪等な操作）。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず修正前のコードでバグを再現するテストを書いてカウンターエグザンプルを確認し、次に修正後のコードでバグが解消され既存動作が保たれることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は根本原因を再仮説する。

**Test Plan**: 次電日フィールドの `onClick` イベントをシミュレートし、`statusChanged` が `true` にならないことを確認するテストを書く。修正前のコードで実行して失敗（`statusChanged` が `false` のまま）を観察する。

**Test Cases**:
1. **onClick 後の statusChanged テスト**: 次電日フィールドの `onClick` をシミュレートし、`statusChanged` が `true` にならないことを確認（修正前コードで失敗することを期待）
2. **onChange 未発火シミュレーション**: `onChange` を発火させずに `onClick` のみをシミュレートし、保存ボタンが無効のままであることを確認
3. **複数回クリックテスト**: 複数回 `onClick` をシミュレートし、`onChange` が発火するまで `statusChanged` が `false` のままであることを確認

**Expected Counterexamples**:
- `onClick` 後に `statusChanged` が `false` のまま
- 保存ボタンが `disabled` のまま（`statusChanged=false` のため）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して期待される動作（`onClick` 後に `statusChanged=true`）が得られることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleNextCallDateClick_fixed(input)
  ASSERT statusChanged IS true
  ASSERT statusChangedRef.current IS true
  ASSERT saveButton.disabled IS false
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正前後で同一の動作が維持されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleFieldChange_original(input) = handleFieldChange_fixed(input)
  // statusChanged の更新、保存処理、バリデーション、リセット動作が同一
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様なフィールド名・値の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 「修正前後で同一動作」という保存性を強く保証できる

**Test Plan**: 修正前のコードで他フィールド（状況・確度・Pinrichステータス等）の変更動作を観察し、修正後も同一動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **他フィールド変更検知テスト**: 状況（当社）・確度・Pinrichステータスの `onChange` が引き続き `statusChanged` を `true` にすることを確認
2. **保存成功後リセットテスト**: 保存成功後に `statusChanged` が `false` にリセットされることを確認
3. **初回ロード時初期化テスト**: 売主データ読み込み時に `statusChanged` が `false` に初期化されることを確認
4. **バリデーションエラーテスト**: 確度未入力時に API が呼ばれないことを確認

### Unit Tests

- `onClick` ハンドラが `setStatusChanged(true)` を呼び出すことをテスト
- `onClick` ハンドラが `showPicker()` を引き続き呼び出すことをテスト
- `onChange` ハンドラが `editedNextCallDate` と `statusChanged` を正しく更新することをテスト
- 保存成功後に `statusChanged` が `false` にリセットされることをテスト

### Property-Based Tests

- ランダムな日付値で `onClick` をシミュレートし、`statusChanged` が常に `true` になることを検証
- `isBugCondition` が false の全フィールドに対して、修正前後で `statusChanged` の更新動作が同一であることを検証
- 多様な操作順序（click → change、click のみ、change のみ）で `statusChanged` の最終状態が正しいことを検証

### Integration Tests

- 次電日フィールドをクリックして日付を選択し、1回の「ステータスを更新」ボタン押下で保存が完了することを確認
- 修正後も他フィールドの変更が正常に保存されることを確認
- 追客中かつ次電日未入力の状態でページを離れようとした際に遷移ブロックダイアログが表示されることを確認
