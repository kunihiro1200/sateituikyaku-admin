# 物件リストATBB非公開保存バリデーションポップアップ Bugfix Design

## Overview

物件リスト（業務リスト）詳細画面において、ATBB状況を「非公開」に変更して保存ボタンを押した際、「買付（offer_status）」フィールドが未入力の場合に保存が中断されるが、その理由をユーザーに伝えるポップアップやエラーメッセージが一切表示されないバグを修正する。

現在の実装では `handleSaveHeader` 内でバリデーション失敗時に `setOfferErrors` と `setIsOfferEditMode(true)` を呼び出して処理を中断するだけで、ユーザーへの視覚的フィードバック（警告ダイアログ）が欠如している。

修正方針：バリデーション失敗時に `setSnackbar` または警告ダイアログを表示し、ユーザーが「買付フィールドへの入力が必要」であることを明確に把握できるようにする。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — ATBB状況が「非公開」に変更された状態で保存ボタンが押され、かつ `offer_status` が未入力の場合
- **Property (P)**: 期待される正しい動作 — バリデーション失敗時に警告ダイアログ（ポップアップ）が表示され、ユーザーが何を入力すべきかを把握できること
- **Preservation**: 修正によって変更してはならない既存の動作 — ATBB状況が「非公開」以外の場合の保存処理、「買付」フィールドが正しく入力されている場合の保存処理、他フィールドのバリデーション動作
- **handleSaveHeader**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` 内のサマリー情報保存ハンドラー。ATBB状況変更時のバリデーションを含む
- **isPreToPublicTransition**: 「公開前→公開中」への遷移かどうかを判定する関数。この遷移の場合はバリデーションをスキップする
- **offer_status**: 「買付」フィールドの値。ATBB状況が「非公開」の場合に必須となる
- **setSnackbar**: スナックバー（通知）を表示するステート更新関数
- **offerErrors**: 買付情報セクションのバリデーションエラー状態
- **isOfferEditMode**: 買付情報セクションの編集モード状態

## Bug Details

### Bug Condition

バグは、ユーザーがATBB状況を「非公開」に変更して保存ボタンを押した際、`offer_status` が未入力の場合に発生する。`handleSaveHeader` 内のバリデーションロジックは `setOfferErrors` と `setIsOfferEditMode(true)` を呼び出して処理を中断するが、ユーザーへの視覚的フィードバック（警告ダイアログ・スナックバー）を一切表示しない。その結果、ユーザーは保存が失敗した理由を把握できず、何を入力すれば保存できるのかが全くわからない状態になる。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListSaveInput
  OUTPUT: boolean

  nextAtbbStatus := X.editedData.atbb_status
  currentOfferStatus := X.editedData.offer_status ?? X.data.offer_status ?? ''

  RETURN nextAtbbStatus IS NOT undefined
         AND NOT isPreToPublicTransition(X.data.atbb_status, nextAtbbStatus)
         AND (currentOfferStatus = null OR currentOfferStatus.trim() = '')
END FUNCTION
```

### Examples

- **例1（バグあり）**: ATBB状況を「専任・公開中」→「非公開」に変更し、offer_status が未入力の状態で保存ボタンを押す → 保存が中断されるが何も表示されない（期待: 「買付フィールドが必須です」などの警告ダイアログが表示される）
- **例2（バグあり）**: ATBB状況を「一般・公開中」→「非公開」に変更し、offer_status が未入力の状態で保存ボタンを押す → 保存が中断されるが何も表示されない（期待: 警告ダイアログが表示される）
- **例3（正常）**: ATBB状況を「専任・公開前」→「専任・公開中」に変更して保存ボタンを押す → isPreToPublicTransition が true を返すためバリデーションをスキップし、正常に保存される
- **例4（正常）**: ATBB状況を「非公開」に変更し、offer_status が入力済みの状態で保存ボタンを押す → バリデーション通過し、正常に保存される

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- ATBB状況が「非公開」以外（例：「公開中」「公開前」）の状態で保存ボタンが押された場合、引き続き通常通り保存処理を実行すること
- ATBB状況が「非公開」かつ `offer_status` が正しく入力された状態で保存ボタンが押された場合、引き続き正常に保存処理を実行すること
- 「公開前→公開中」への遷移（`isPreToPublicTransition` が true を返す場合）はバリデーションをスキップする動作を維持すること
- 他フィールドのバリデーションエラー（`validateOfferFields` など）の動作は変更しないこと
- `setOfferErrors` と `setIsOfferEditMode(true)` による買付情報セクションのエラー表示・編集モード切り替えは維持すること

**スコープ:**
`handleSaveHeader` 内のバリデーション失敗時の処理にのみ変更を加える。具体的には、バリデーション失敗時に `setSnackbar` を呼び出して警告メッセージを表示する処理を追加する。それ以外のロジック（バリデーション判定、エラー状態管理、保存処理）は一切変更しない。

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **警告フィードバックの欠如**: `handleSaveHeader` のバリデーション失敗時の処理が `setOfferErrors` と `setIsOfferEditMode(true)` の呼び出しと `return` のみで構成されており、`setSnackbar` による視覚的フィードバックが含まれていない

2. **他の保存ハンドラーとの非対称性**: `handleSaveOffer` など他の保存ハンドラーはバリデーション失敗時にエラー状態をセットするだけで処理を中断するが、`handleSaveHeader` も同様のパターンを踏襲しており、ユーザーへの通知が抜け落ちている

3. **暗黙的な失敗**: バリデーション失敗時に `return` するだけで、ユーザーには保存ボタンを押したにもかかわらず何も起きないように見える（サイレントフェイル）

4. **買付情報セクションのスクロール不足**: `setIsOfferEditMode(true)` で買付情報セクションが編集モードになっても、ページ下部にある買付情報セクションへのスクロールが行われないため、ユーザーはエラーの発生場所に気づきにくい

## Correctness Properties

Property 1: Bug Condition - ATBB非公開時の保存バリデーション警告表示

_For any_ 保存入力において、ATBB状況が「非公開」系の値に変更され（isPreToPublicTransition が false）、かつ `offer_status` が未入力の場合（isBugCondition が true を返す場合）、修正後の `handleSaveHeader` は SHALL 警告ダイアログ（スナックバー）を表示し、ユーザーが「買付フィールドへの入力が必要」であることを明確に把握できるようにする。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - バグ条件非成立時の動作保持

_For any_ 保存入力において、バグ条件が成立しない場合（isBugCondition が false を返す場合）、修正後の `handleSaveHeader` は SHALL 修正前と同一の動作（正常保存またはバリデーション通過）を維持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Function**: `handleSaveHeader`

**Specific Changes**:

1. **警告スナックバーの追加**: バリデーション失敗時（`offer_status` が未入力）に `setSnackbar` を呼び出して警告メッセージを表示する

**変更前:**
```typescript
if (!currentOfferStatus || currentOfferStatus.trim() === '') {
  // エラーをセットして買付情報セクションを編集モードに切り替え
  setOfferErrors(prev => ({ ...prev, offer_status: '必須項目です' }));
  setIsOfferEditMode(true);
  return; // 保存処理を中断
}
```

**変更後:**
```typescript
if (!currentOfferStatus || currentOfferStatus.trim() === '') {
  // エラーをセットして買付情報セクションを編集モードに切り替え
  setOfferErrors(prev => ({ ...prev, offer_status: '必須項目です' }));
  setIsOfferEditMode(true);
  // 警告ダイアログを表示してユーザーに理由を伝える
  setSnackbar({
    open: true,
    message: 'ATBB状況を非公開にする場合、買付フィールドの入力が必要です',
    severity: 'warning',
  });
  return; // 保存処理を中断
}
```

変更箇所は `setSnackbar` 呼び出しの追加のみで、他のロジックへの影響はない。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず未修正コードでバグを再現するテストを実行し、根本原因を確認する。次に修正後のコードでバグが解消され、既存動作が保持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、`handleSaveHeader` がバリデーション失敗時に警告を表示しないことを確認する。

**Test Plan**: `handleSaveHeader` の実装を静的解析し、バリデーション失敗パスに `setSnackbar` 呼び出しが存在しないことを確認する。

**Test Cases**:
1. **静的解析テスト**: `PropertyListingDetailPage.tsx` のバリデーション失敗パスに `setSnackbar` 呼び出しが存在しないことを確認（未修正コードで PASS、修正後は FAIL）
2. **バリデーション失敗テスト**: ATBB状況を「非公開」に変更し、offer_status が未入力の状態で `handleSaveHeader` を呼び出した際に `setSnackbar` が呼ばれないことを確認（未修正コードで PASS）
3. **サイレントフェイルテスト**: バリデーション失敗時に `setOfferErrors` と `setIsOfferEditMode` のみが呼ばれ、`setSnackbar` が呼ばれないことを確認

**Expected Counterexamples**:
- `handleSaveHeader` のバリデーション失敗パスに `setSnackbar` 呼び出しが存在しない
- 原因: バリデーション失敗時の処理に警告フィードバックが含まれていない

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の `handleSaveHeader` が警告スナックバーを表示することを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := handleSaveHeader_fixed(X)
  ASSERT setSnackbar was called with severity = 'warning'
  ASSERT snackbar message CONTAINS '買付' OR '必須'
  ASSERT setOfferErrors was called with offer_status error
  ASSERT setIsOfferEditMode was called with true
  ASSERT API PUT was NOT called
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正前後で動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleSaveHeader_original(X) = handleSaveHeader_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される。理由：
- 多様な ATBB 状況値と offer_status の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを網羅できる
- 修正が既存動作を壊していないことを強く保証できる

**Test Cases**:
1. **ATBB非公開・offer_status入力済み保持テスト**: ATBB状況が「非公開」かつ offer_status が入力済みの場合、正常に保存処理が実行されること（修正前後で同じ）
2. **ATBB公開中保持テスト**: ATBB状況が「公開中」の場合、バリデーションをスキップして正常に保存処理が実行されること（修正前後で同じ）
3. **公開前→公開中遷移保持テスト**: `isPreToPublicTransition` が true を返す場合、バリデーションをスキップして正常に保存処理が実行されること（修正前後で同じ）

### Unit Tests

- ATBB状況が「非公開」かつ offer_status が未入力の場合に `setSnackbar` が `severity: 'warning'` で呼ばれることをテスト
- バリデーション失敗時に API PUT が呼ばれないことをテスト
- バリデーション失敗時に `setOfferErrors` と `setIsOfferEditMode(true)` が呼ばれることをテスト（既存動作の維持確認）
- ATBB状況が「非公開」かつ offer_status が入力済みの場合に正常に保存処理が実行されることをテスト

### Property-Based Tests

- ランダムな ATBB 状況値（「非公開」を含む）と offer_status の組み合わせを生成し、バグ条件成立時は常に `setSnackbar` が呼ばれることを検証（Property 1）
- ランダムな非バグ条件入力（offer_status が入力済み、または ATBB 状況が「非公開」以外）を生成し、修正前後で同一の動作を維持することを検証（Property 2）

### Integration Tests

- `PropertyListingDetailPage` を実際にレンダリングし、ATBB状況を「非公開」に変更して保存ボタンをクリックした際にスナックバーが表示されることを確認
- スナックバー表示後、買付情報セクションが編集モードになっていることを確認
- 買付フィールドに値を入力してから再度保存ボタンをクリックした際に正常に保存されることを確認
