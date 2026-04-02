# 売主リスト保存ボタン白フラッシュ修正 Design

## Overview

売主リストページ（通話モードページ）で「不通・１番電話を保存」ボタンと「ステータスを更新」ボタンを押すと、保存処理後に`loadAllData()`を呼び出すことで画面が一瞬白くなる（ページ全体が再レンダリングされる）問題を修正する。

コメント保存ボタンのように、画面を維持したまま保存作業を行うようにする。

## Glossary

- **Bug_Condition (C)**: 「不通・１番電話を保存」または「ステータスを更新」ボタンをクリックした時に、保存処理後に`loadAllData()`が呼び出される条件
- **Property (P)**: 保存処理後に画面を維持したまま、必要な状態のみを更新する（画面が白くならない）
- **Preservation**: コメント保存ボタンの既存動作（画面を維持したまま保存）を維持する
- **loadAllData()**: `frontend/frontend/src/pages/CallModePage.tsx`の関数で、売主データ・物件データ・社員データなど全てのデータを再取得してステートを更新する
- **handleSaveAndExit()**: 「不通・１番電話を保存」ボタンのイベントハンドラ
- **handleSaveStatus()**: 「ステータスを更新」ボタンのイベントハンドラ

## Bug Details

### Bug Condition

バグは、ユーザーが「不通・１番電話を保存」ボタンまたは「ステータスを更新」ボタンをクリックした時に発生する。保存処理後に`loadAllData()`が呼び出され、画面全体が再レンダリングされることで、一瞬画面が白くなる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ButtonClickEvent
  OUTPUT: boolean
  
  RETURN (input.buttonType == '不通・１番電話を保存' OR input.buttonType == 'ステータスを更新')
         AND saveSuccessful(input)
         AND loadAllDataCalled(input)
END FUNCTION
```

### Examples

- **例1**: ユーザーが「不通・１番電話を保存」ボタンをクリック → 保存成功 → `loadAllData()`が呼び出される → 画面が一瞬白くなる
- **例2**: ユーザーが「ステータスを更新」ボタンをクリック → 保存成功 → `loadAllData()`が呼び出される → 画面が一瞬白くなる
- **例3**: ユーザーが「コメント保存」ボタンをクリック → 保存成功 → `loadAllData()`は呼び出されない → 画面は白くならない（正常動作）
- **エッジケース**: 保存処理が失敗した場合 → `loadAllData()`は呼び出されない → 画面は白くならない（期待される動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- コメント保存ボタンをクリックした時は、画面を維持したまま保存処理を行う（現在の正常な動作を維持）
- 保存処理が成功した時は、データベースに正しく保存し、スプレッドシートに同期する
- 保存処理が失敗した時は、エラーメッセージを表示し、ユーザーに通知する

**Scope:**
「不通・１番電話を保存」ボタンと「ステータスを更新」ボタン以外の全ての保存ボタンは、現在の動作を維持する。これには以下が含まれる:
- コメント保存ボタン
- 物件情報保存ボタン
- 売主情報保存ボタン
- サイト情報保存ボタン
- 手入力査定額保存ボタン

## Hypothesized Root Cause

bugfix.mdとCallModePageのコードを確認した結果、最も可能性が高い原因は以下の通り:

1. **不要な`loadAllData()`呼び出し**: `handleSaveAndExit()`と`handleSaveStatus()`が保存処理後に`loadAllData()`を呼び出している
   - `handleSaveAndExit()`（行1666）: `await loadAllData();`
   - `handleSaveStatus()`（行1838）: `await loadAllData();`
   - `loadAllData()`は全データを再取得してステートを更新するため、画面全体が再レンダリングされる

2. **コメント保存ボタンとの違い**: コメント保存ボタンは`loadAllData()`を呼び出さず、必要な状態のみを更新している
   - コメント保存後は`setSavedComments()`と`setSuccessMessage()`のみを呼び出す
   - 画面全体の再レンダリングが発生しない

3. **`setLoading(true)`の影響**: `loadAllData()`の先頭で`setLoading(true)`が呼び出され、ローディング表示が出る
   - ローディング表示が画面全体を覆うため、一瞬白くなる

4. **不要なデータ再取得**: 保存処理で更新したフィールドは既に分かっているため、全データを再取得する必要はない
   - `handleSaveAndExit()`は`unreachableStatus`、`firstCallPerson`などを更新
   - `handleSaveStatus()`は`status`、`confidence`、`nextCallDate`などを更新
   - これらのフィールドは既にローカルステートに保存されているため、再取得不要

## Correctness Properties

Property 1: Bug Condition - 保存ボタンクリック時の画面維持

_For any_ ボタンクリックイベントで「不通・１番電話を保存」または「ステータスを更新」ボタンがクリックされ、保存処理が成功した場合、修正後のコードは画面を維持したまま必要な状態のみを更新し、`loadAllData()`を呼び出さず、画面が白くならないこと。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他の保存ボタンの動作維持

_For any_ ボタンクリックイベントで「不通・１番電話を保存」または「ステータスを更新」ボタン以外の保存ボタンがクリックされた場合、修正後のコードは現在の動作を維持し、コメント保存ボタンは画面を維持したまま保存処理を行い、他の保存ボタンは必要に応じて`loadAllData()`を呼び出すこと。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Root cause分析が正しいと仮定すると、以下の変更が必要:

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `handleSaveAndExit()`（行1630-1680）

**Specific Changes**:
1. **`loadAllData()`呼び出しを削除**: 保存処理後の`await loadAllData();`（行1666）を削除
   - 代わりに、保存したフィールドのローカルステートのみを更新

2. **保存済み値の更新**: 保存成功後、`setSavedUnreachableStatus()`と`setSavedFirstCallPerson()`を呼び出す
   - これらは既に実装されている（行1662-1663）

3. **成功メッセージの表示**: `setSuccessMessage('保存しました')`を呼び出す
   - これは既に実装されている（行1659）

4. **ローディング表示の削除**: `setLoading(true)`を呼び出さない
   - `loadAllData()`を削除することで、自動的に削除される

5. **コメント保存ボタンのパターンを適用**: コメント保存ボタンと同じパターンを使用
   - 必要な状態のみを更新
   - 画面全体の再レンダリングを避ける

**Function**: `handleSaveStatus()`（行1800-1860）

**Specific Changes**:
1. **`loadAllData()`呼び出しを削除**: 保存処理後の`await loadAllData();`（行1838）を削除
   - 代わりに、保存したフィールドのローカルステートのみを更新

2. **保存済み値の更新**: 保存成功後、必要なローカルステートを更新
   - `setStatusChanged(false)`は既に実装されている（行1836）
   - 追加で、保存したフィールドの値をローカルステートに反映

3. **成功メッセージの表示**: `setSuccessMessage('ステータスを更新しました')`を呼び出す
   - これは既に実装されている（行1834）

4. **ローディング表示の削除**: `setLoading(true)`を呼び出さない
   - `loadAllData()`を削除することで、自動的に削除される

5. **コメント保存ボタンのパターンを適用**: コメント保存ボタンと同じパターンを使用
   - 必要な状態のみを更新
   - 画面全体の再レンダリングを避ける

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従う: まず、修正前のコードで白フラッシュが発生することを確認し、次に修正後のコードで白フラッシュが発生しないことを確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで白フラッシュが発生することを確認する。Root cause分析を確認または反証する。反証された場合は、再度仮説を立てる。

**Test Plan**: ブラウザで通話モードページを開き、「不通・１番電話を保存」ボタンと「ステータスを更新」ボタンをクリックして、画面が一瞬白くなることを確認する。修正前のコードで実行する。

**Test Cases**:
1. **不通・１番電話を保存テスト**: 「不通・１番電話を保存」ボタンをクリック → 画面が一瞬白くなる（修正前のコードで失敗）
2. **ステータスを更新テスト**: 「ステータスを更新」ボタンをクリック → 画面が一瞬白くなる（修正前のコードで失敗）
3. **コメント保存テスト**: 「コメント保存」ボタンをクリック → 画面は白くならない（修正前のコードで成功）
4. **保存失敗テスト**: 保存処理が失敗した場合 → 画面は白くならない（修正前のコードで成功）

**Expected Counterexamples**:
- 「不通・１番電話を保存」ボタンと「ステータスを更新」ボタンをクリックすると、画面が一瞬白くなる
- 原因: `loadAllData()`が呼び出され、`setLoading(true)`が実行される

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して、期待される動作を生成することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSaveAndExit_fixed(input) OR handleSaveStatus_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力に対して、元の関数と同じ結果を生成することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSaveAndExit_original(input) = handleSaveAndExit_fixed(input)
  ASSERT handleSaveStatus_original(input) = handleSaveStatus_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは、保存処理の動作を検証するために推奨される。理由:
- 多くのテストケースを自動的に生成する
- 手動のユニットテストでは見逃す可能性のあるエッジケースをキャッチする
- 全ての非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 修正前のコードでコメント保存ボタンと他の保存ボタンの動作を観察し、次にproperty-based testを書いてその動作をキャプチャする。

**Test Cases**:
1. **コメント保存の保存**: コメント保存ボタンをクリックして、画面を維持したまま保存処理が行われることを確認
2. **物件情報保存の保存**: 物件情報保存ボタンをクリックして、現在の動作が維持されることを確認
3. **売主情報保存の保存**: 売主情報保存ボタンをクリックして、現在の動作が維持されることを確認
4. **他の保存ボタンの保存**: 他の保存ボタンをクリックして、現在の動作が維持されることを確認

### Unit Tests

- 「不通・１番電話を保存」ボタンをクリックした時、`loadAllData()`が呼び出されないことをテスト
- 「ステータスを更新」ボタンをクリックした時、`loadAllData()`が呼び出されないことをテスト
- 保存処理が成功した時、必要な状態のみが更新されることをテスト
- 保存処理が失敗した時、エラーメッセージが表示されることをテスト

### Property-Based Tests

- ランダムな売主データを生成して、「不通・１番電話を保存」ボタンをクリックした時、画面が白くならないことを確認
- ランダムな売主データを生成して、「ステータスを更新」ボタンをクリックした時、画面が白くならないことを確認
- ランダムな売主データを生成して、コメント保存ボタンをクリックした時、現在の動作が維持されることを確認

### Integration Tests

- 通話モードページで「不通・１番電話を保存」ボタンをクリックして、画面が白くならないことを確認
- 通話モードページで「ステータスを更新」ボタンをクリックして、画面が白くならないことを確認
- 通話モードページでコメント保存ボタンをクリックして、現在の動作が維持されることを確認
