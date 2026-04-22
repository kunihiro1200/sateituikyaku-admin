# property-list-memo-save-bug Bugfix Design

## Overview

物件詳細ページ（`PropertyListingDetailPage`）の備忘録（memo）保存機能に2つのバグが存在する。

**バグ1（画面が白くなる）**: `handleSaveNotes` が `fetchPropertyData()` を `silent` 引数なし（デフォルト `false`）で呼び出しているため、保存後に `setLoading(true)` が実行されて画面全体がローディングスピナーに置き換わり、一瞬画面が白くなる。

**バグ2（複数回押さないと保存されない）**: `handleSaveNotes` に `saving` フラグが存在しないため、保存処理中もボタンが有効なままとなり、ユーザーが複数回クリックすると保存APIリクエストが重複して送信される。競合状態（race condition）が発生し、最初のクリックで保存が完了しているにもかかわらず、ユーザーには保存されていないように見える場合がある。

**修正方針**:
1. `fetchPropertyData()` の呼び出しを `fetchPropertyData(true)` に変更（`silent=true`）
2. `notesSaving` 状態を追加し、保存中はボタンを無効化する

**対象ファイル**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**制約**: 締切日（deadline）フィールドおよびモーダル（`PropertyListingDetailModal`）は変更しない。備忘録以外のセクションの保存ハンドラーは変更しない。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — 物件詳細ページの備忘録保存ボタンが押されたとき
- **Property (P)**: 期待される正しい動作 — 画面全体のローディングなしで保存が完了し、保存中は重複クリックが防止される
- **Preservation**: 修正によって変更してはならない既存の動作 — 備忘録以外のセクションの保存ハンドラー、モーダルの保存処理、締切日フィールドの表示
- **handleSaveNotes**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` 内の備忘録（`memo`）および特記事項（`special_notes`）を保存する関数
- **fetchPropertyData(silent)**: 物件データを再取得する関数。`silent=false`（デフォルト）の場合は `setLoading(true)` を呼び出して画面全体をローディング状態にする。`silent=true` の場合はローディング状態を発生させない
- **notesSaving**: 備忘録保存処理中であることを示す新規追加の状態フラグ

## Bug Details

### Bug Condition

バグは、ユーザーが物件詳細ページの備忘録フィールドに入力して保存ボタンを押したときに発動する。`handleSaveNotes` が `fetchPropertyData()` を `silent=false` で呼び出すため画面が白くなり、また `saving` フラグがないため重複クリックが可能になっている。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, clickCount: number }
  OUTPUT: boolean

  RETURN input.action = 'saveNotes'
         AND (
           (input.clickCount = 1 AND fetchPropertyData が silent=false で呼ばれる)
           OR
           (input.clickCount > 1 AND saving フラグが存在しない)
         )
END FUNCTION
```

### Examples

- **バグ1の例**: ユーザーが備忘録に「要確認」と入力して保存ボタンを1回押す → 保存API呼び出し成功後、`fetchPropertyData()` が `silent=false` で呼ばれ、`setLoading(true)` が実行されて画面全体が一瞬白くなる（期待: 画面は白くならない）
- **バグ2の例**: ユーザーが保存ボタンを素早く2回押す → 1回目のAPI呼び出し中に2回目のAPI呼び出しが送信され、race conditionが発生する（期待: 2回目のクリックは無効化される）
- **バグ2の例（ユーザー体験）**: 1回目のクリックで保存が完了しているが、2回目のリクエストが後から完了して古いデータで上書きされる可能性がある → ユーザーには「保存されていない」ように見える
- **正常ケース（バグなし）**: `special_notes` も `memo` も変更されていない場合 → 早期リターンで保存処理は実行されない（この動作は変更しない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 締切日（`deadline`）フィールドの表示は一切変更しない
- モーダル（`PropertyListingDetailModal`）の `handleSave` 処理は変更しない（既に `saving` フラグと `fetchData()` を正しく実装済み）
- `handleSaveHeader`、`handleSaveBasicInfo`、`handleSavePropertyDetails`、`handleSaveFrequentlyAsked`、`handleSaveViewingInfo`、`handleSaveSellerBuyer`、`handleSaveOffer` など備忘録以外のセクションの保存ハンドラーは変更しない
- `special_notes` または `memo` に変更がない場合の早期リターン動作は維持する
- 保存成功時のスナックバー表示（「特記・備忘録を保存しました」）は維持する
- 保存失敗時のスナックバー表示（「保存に失敗しました」）は維持する
- 保存成功後の `setEditedData({})` によるeditedDataクリアは維持する

**Scope:**
備忘録（`memo`）および特記事項（`special_notes`）の保存処理（`handleSaveNotes`）のみを修正する。他のセクションの保存ハンドラーおよびUIコンポーネントは一切変更しない。

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **`fetchPropertyData()` の `silent` 引数未使用（バグ1の原因）**: `handleSaveNotes` が `fetchPropertyData()` を引数なしで呼び出しているため、デフォルト値 `silent=false` が適用される。その結果、`setLoading(true)` が実行されて画面全体がローディングスピナーに置き換わる。`handleSavePrice` では既に `fetchPropertyData(true)` として修正済みであるが、`handleSaveNotes` には同様の修正が適用されていない。

2. **`saving` 状態の欠如（バグ2の原因）**: `handleSaveNotes` には保存処理中であることを示すフラグが存在しない。他のセクション（例: `PropertyListingDetailModal` の `handleSave`）では `saving` 状態を使用してボタンを無効化しているが、`handleSaveNotes` にはその実装がない。

3. **実装の不整合**: `handleSavePrice` には `silent=true` が適用済みだが、`handleSaveNotes` には適用されていない。コミット `c2b04a56` で `handleSavePrice` の修正が行われた際に、`handleSaveNotes` への同様の修正が漏れた可能性がある。

## Correctness Properties

Property 1: Bug Condition - 備忘録保存時に画面が白くならず重複リクエストが防止される

_For any_ 入力において備忘録保存ボタンが押されたとき（isBugCondition が true を返す場合）、修正後の `handleSaveNotes` は `fetchPropertyData(true)` を呼び出して画面全体のローディング状態を発生させず、かつ `notesSaving` フラグにより保存処理中は保存ボタンを無効化して重複リクエストを防止する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 備忘録以外の動作が変更されない

_For any_ 入力において備忘録保存ボタン以外の操作（他セクションの保存、モーダルの保存、締切日フィールドの表示、変更なし時の早期リターン）が行われたとき（isBugCondition が false を返す場合）、修正後のコードは修正前のコードと同一の動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: `handleSaveNotes`（および state 定義部分）

**Specific Changes**:

1. **`notesSaving` 状態の追加**: コンポーネントの state 定義部分に `const [notesSaving, setNotesSaving] = useState(false);` を追加する。既存の `saving` 系の state（`chatSending`、`chatToOfficeSending`、`sendingEmail` など）の近くに配置する。

2. **`handleSaveNotes` の先頭に重複防止チェックを追加**: `if (notesSaving) return;` を追加して、保存中の重複クリックを防止する。

3. **`setNotesSaving(true)` の追加**: API呼び出し前に `setNotesSaving(true)` を呼び出す。

4. **`fetchPropertyData()` を `fetchPropertyData(true)` に変更**: `silent=true` を渡すことで、保存後のデータ再取得時に画面全体のローディング状態が発生しないようにする。

5. **`finally` ブロックで `setNotesSaving(false)` を呼び出す**: 成功・失敗いずれの場合も `notesSaving` を `false` に戻す。

**修正前のコード**:
```typescript
const handleSaveNotes = async () => {
  if (!propertyNumber) return;
  const notesData: Record<string, any> = {};
  if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
  if (editedData.memo !== undefined) notesData.memo = editedData.memo;
  if (Object.keys(notesData).length === 0) return;
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, notesData);
    setSnackbar({ open: true, message: '特記・備忘録を保存しました', severity: 'success' });
    await fetchPropertyData();
    setEditedData({});
  } catch (error) {
    setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
  }
};
```

**修正後のコード**:
```typescript
const handleSaveNotes = async () => {
  if (!propertyNumber) return;
  if (notesSaving) return;  // 重複クリック防止
  const notesData: Record<string, any> = {};
  if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
  if (editedData.memo !== undefined) notesData.memo = editedData.memo;
  if (Object.keys(notesData).length === 0) return;
  setNotesSaving(true);
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, notesData);
    setSnackbar({ open: true, message: '特記・備忘録を保存しました', severity: 'success' });
    await fetchPropertyData(true);  // silent=true: ローディング画面を表示しない
    setEditedData({});
  } catch (error) {
    setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
  } finally {
    setNotesSaving(false);
  }
};
```

**State 追加箇所**: `chatSending` や `sendingEmail` などの保存中フラグの近くに追加する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず修正前のコードでバグを再現するテストを実行してバグを確認し、次に修正後のコードでバグが解消されていること（Fix Checking）と既存動作が維持されていること（Preservation Checking）を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現するテストを実行し、根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: `handleSaveNotes` をモックAPIと共にテストし、`fetchPropertyData` が `silent=false` で呼ばれること（バグ1）と、保存中に重複クリックが可能であること（バグ2）を確認する。修正前のコードで実行して失敗を観察する。

**Test Cases**:
1. **バグ1テスト（画面白くなる）**: `handleSaveNotes` 呼び出し後、`fetchPropertyData` が `silent=false`（引数なし）で呼ばれることを確認 → 修正前のコードで失敗することを確認
2. **バグ2テスト（重複リクエスト）**: `handleSaveNotes` を素早く2回呼び出したとき、APIが2回呼ばれることを確認 → 修正前のコードで失敗することを確認
3. **早期リターンテスト**: `special_notes` も `memo` も変更されていない場合、APIが呼ばれないことを確認 → 修正前後で同じ動作であることを確認

**Expected Counterexamples**:
- `fetchPropertyData` が `silent` 引数なしで呼ばれ、`setLoading(true)` が実行される
- 保存中に2回目のクリックが可能で、APIが2回呼ばれる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSaveNotes_fixed(input)
  ASSERT fetchPropertyData が silent=true で呼ばれた
  ASSERT 保存中は notesSaving = true
  ASSERT 保存完了後は notesSaving = false
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前の関数と同一の動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSaveNotes_original(input) = handleSaveNotes_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストでは見逃しがちなエッジケースを検出できる
- 非バグ入力に対して動作が変更されていないことを強く保証できる

**Test Plan**: 修正前のコードで備忘録以外の操作（他セクションの保存、変更なし時の早期リターン）の動作を観察し、修正後も同じ動作であることを検証するプロパティベーステストを作成する。

**Test Cases**:
1. **早期リターン保持**: `special_notes` も `memo` も変更されていない場合、修正前後ともAPIが呼ばれないことを確認
2. **スナックバー保持**: 保存成功時に「特記・備忘録を保存しました」が表示されることを確認
3. **editedDataクリア保持**: 保存成功後に `editedData` が空になることを確認
4. **エラー処理保持**: API失敗時に「保存に失敗しました」スナックバーが表示されることを確認

### Unit Tests

- `handleSaveNotes` 呼び出し後、`fetchPropertyData` が `silent=true` で呼ばれることをテスト
- `notesSaving` が保存中は `true`、完了後は `false` になることをテスト
- 保存中に `handleSaveNotes` を再度呼び出してもAPIが1回しか呼ばれないことをテスト
- `special_notes` も `memo` も変更されていない場合の早期リターンをテスト
- API失敗時のエラーハンドリングをテスト

### Property-Based Tests

- ランダムな `memo` / `special_notes` の値を生成し、保存後に `fetchPropertyData(true)` が呼ばれることを検証
- ランダムな回数の重複クリックを生成し、APIが1回しか呼ばれないことを検証
- 備忘録以外のフィールド変更に対して、`handleSaveNotes` の動作が変わらないことを検証

### Integration Tests

- 物件詳細ページで備忘録を入力して保存ボタンを押したとき、画面が白くならないことを確認
- 保存ボタンを素早く2回押したとき、APIが1回しか呼ばれないことを確認
- 保存中はボタンが無効化（disabled）されていることを確認
- 保存完了後にボタンが再び有効化されることを確認
- 他セクション（価格情報、基本情報など）の保存動作が変わらないことを確認
