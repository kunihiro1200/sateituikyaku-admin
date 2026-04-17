# Buyer Gmail Button Grayout Fix - バグ修正設計

## Overview

買主詳細画面のGmail送信ボタンが、メールアドレスが存在するにもかかわらずグレーアウトされるバグの修正設計。

**バグの概要**: `BuyerGmailSendButton` の `isDisabled` 条件が `selectedCount === 0 || loading` となっており、
`selectedPropertyIds` が空（`status === 'current'` の物件が0件）の場合にボタンが無効化される。

**修正方針**: `isDisabled` の条件から `selectedCount === 0` を除外し、`loading` のみにする。
物件未選択のままクリックした場合は既存の「物件を選択してください」エラーメッセージで対応する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — メールアドレスが存在し、かつ `status === 'current'` の物件が0件のため `selectedPropertyIds` が空になる状態
- **Property (P)**: 期待される正しい動作 — メールアドレスが存在する限りGmail送信ボタンは有効化（クリック可能）であること
- **Preservation**: 修正によって変更してはならない既存の動作
- **BuyerGmailSendButton**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx` のコンポーネント。Gmail送信フローを担当する
- **isDisabled**: ボタンの無効化フラグ。現在は `selectedCount === 0 || loading` で計算されている
- **selectedPropertyIds**: `BuyerDetailPage` で管理される `Set<string>`。`fetchInquiryHistoryTable` が `status === 'current'` の物件IDを自動選択する
- **fetchInquiryHistoryTable**: `BuyerDetailPage` の関数。問い合わせ履歴を取得し、`status === 'current'` の物件を自動選択する

## Bug Details

### Bug Condition

`fetchInquiryHistoryTable` は問い合わせ履歴取得後に `status === 'current'` の物件IDを自動選択するが、
該当物件が0件の場合 `selectedPropertyIds` は空の `Set` のままとなる。
その結果、`isDisabled = selectedCount === 0 || loading` が `true` になり、
メールアドレスが存在していてもボタンがグレーアウトされる。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer, inquiryHistory)
  INPUT: buyer（買主データ）, inquiryHistory（問い合わせ履歴配列）
  OUTPUT: boolean

  hasEmail        ← buyer.email != null AND buyer.email.trim() != ''
  hasHistory      ← inquiryHistory.length > 0
  hasCurrentItems ← inquiryHistory.filter(item => item.status === 'current').length > 0

  RETURN hasEmail AND hasHistory AND NOT hasCurrentItems
END FUNCTION
```

### Examples

- **買主7359（バグ再現ケース）**: メールアドレスあり、問い合わせ履歴あり、`status === 'current'` の物件0件
  → `selectedPropertyIds` が空 → ボタンがグレーアウト（期待: クリック可能）
- **通常ケース**: メールアドレスあり、`status === 'current'` の物件1件以上
  → `selectedPropertyIds` に物件IDが入る → ボタンが有効（バグなし）
- **メールアドレスなし**: `BuyerGmailSendButton` は `buyerEmail` が空でも表示されるが、送信時にエラーになる（修正対象外）
- **問い合わせ履歴0件**: コンポーネントが `null` を返す（修正対象外）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 物件が1件も選択されていない状態でGmail送信ボタンをクリックした場合、「物件を選択してください」のエラーメッセージを表示する（`handleClick` 内の既存ロジック）
- 問い合わせ履歴が0件の場合、`BuyerGmailSendButton` は `null`（非表示）を返す
- `status === 'current'` の物件が1件以上存在する場合、ボタンは引き続き有効化された状態で表示される
- マウスクリックによるボタン操作は引き続き正常に動作する
- テンプレート選択モーダル、メール作成モーダルの動作は変更しない
- `loading` 中はボタンが無効化される動作は維持する

**スコープ:**
`isDisabled` の計算式のみを変更する。`handleClick` 内の物件未選択チェックロジックは変更しない。

## Hypothesized Root Cause

根本原因は既に特定済み:

1. **isDisabled 条件の過剰制約**: `isDisabled = selectedCount === 0 || loading` において、
   `selectedCount === 0` はボタンの有効/無効を制御するには不適切な条件。
   ボタンの有効化はメールアドレスの存在に依存すべきであり、物件選択状態に依存すべきではない。

2. **自動選択ロジックの前提**: `fetchInquiryHistoryTable` が `status === 'current'` の物件を自動選択する設計は、
   「物件が紐づいていれば自動選択される」という前提に基づいている。
   しかし買主7359のように紐づく物件が0件の場合、この前提が崩れる。

3. **UX設計の不整合**: 物件未選択時のエラーハンドリングは `handleClick` 内に既に実装されているにもかかわらず、
   `isDisabled` でも同じ条件をチェックしているため、ユーザーがエラーメッセージを見る機会すら与えられない。

## Correctness Properties

Property 1: Bug Condition - メールアドレスがあればGmail送信ボタンは有効化される

_For any_ 買主データとその問い合わせ履歴において、バグ条件が成立する（`isBugCondition` が `true` を返す）場合、
修正後の `BuyerGmailSendButton` は `disabled={false}` の状態でレンダリングされ、クリック可能であるべきである。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 物件未選択時のエラーメッセージ動作は変わらない

_For any_ バグ条件が成立しない入力（`isBugCondition` が `false` を返す）に対して、
修正後のコードは修正前のコードと同じ動作を保持する。
特に、`status === 'current'` の物件が1件以上存在する場合のボタン有効化、
物件未選択クリック時のエラーメッセージ表示、`loading` 中の無効化は変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx`

**Function**: コンポーネント本体（`isDisabled` の計算箇所）

**Specific Changes**:

1. **isDisabled 条件の変更**:
   ```typescript
   // 修正前
   const isDisabled = selectedCount === 0 || loading;

   // 修正後
   const isDisabled = loading;
   ```

2. **変更箇所**: 約65行目付近の `isDisabled` 定義行のみ

3. **handleClick の変更なし**: 物件未選択時のエラーメッセージ表示ロジックはそのまま維持する
   ```typescript
   // この部分は変更しない（既存の動作を維持）
   const handleClick = () => {
     if (selectedCount === 0) {
       setErrorMessage('物件を選択してください');
       return;
     }
     setTemplateModalOpen(true);
   };
   ```

**変更の最小性**: 1行の変更のみで修正が完了する。他のファイルへの変更は不要。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現し根本原因を確認、次に修正後の動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `BuyerGmailSendButton` コンポーネントをレンダリングし、
`selectedPropertyIds` が空の `Set` の場合にボタンが `disabled` になることを確認する。
未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **バグ再現テスト**: `selectedPropertyIds` が空の `Set`、`buyerEmail` が有効なメールアドレスの場合、
   ボタンが `disabled` になることを確認（未修正コードで失敗するはず）
2. **loading=false, selectedCount=0 テスト**: `loading=false`、`selectedPropertyIds` が空の場合、
   `isDisabled` が `true` になることを確認（未修正コードで失敗するはず）
3. **クリック不可テスト**: `disabled` 状態のボタンをクリックしても `handleClick` が呼ばれないことを確認

**Expected Counterexamples**:
- `selectedPropertyIds` が空の場合、ボタンが `disabled` になる（バグの直接的な証拠）
- `isDisabled = selectedCount === 0 || loading` の計算式が原因であることが確認できる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL (buyer, inquiryHistory) WHERE isBugCondition(buyer, inquiryHistory) DO
  result := render BuyerGmailSendButton_fixed(
    buyerEmail=buyer.email,
    selectedPropertyIds=new Set(),  // status==='current'の物件が0件
    loading=false
  )
  ASSERT result.button.disabled = false
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL (buyer, inquiryHistory) WHERE NOT isBugCondition(buyer, inquiryHistory) DO
  ASSERT render BuyerGmailSendButton_original(buyer, inquiryHistory)
       = render BuyerGmailSendButton_fixed(buyer, inquiryHistory)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な `selectedPropertyIds` の状態（0件、1件、複数件）を自動生成できる
- `loading` の true/false の組み合わせを網羅できる
- 手動テストでは見落としがちなエッジケースを検出できる

**Test Plan**: 未修正コードで既存の動作（`status === 'current'` の物件がある場合のボタン有効化）を観察し、
修正後も同じ動作が保持されることをテストで検証する。

**Test Cases**:
1. **status=current物件あり時の保持**: `selectedPropertyIds` に物件IDが1件以上ある場合、
   修正前後でボタンが有効化されることを確認
2. **loading=true時の保持**: `loading=true` の場合、修正前後でボタンが無効化されることを確認
3. **物件未選択クリック時のエラーメッセージ保持**: `selectedPropertyIds` が空の状態でボタンをクリックすると
   「物件を選択してください」が表示されることを確認（修正後も変わらない）
4. **問い合わせ履歴0件時の非表示保持**: `inquiryHistory` が空配列の場合、
   コンポーネントが `null` を返すことを確認

### Unit Tests

- `isDisabled` が `loading` のみに依存することを確認するテスト
- `selectedPropertyIds` が空でも `loading=false` の場合はボタンが有効化されることを確認するテスト
- `loading=true` の場合はボタンが無効化されることを確認するテスト
- `handleClick` で `selectedCount === 0` の場合に「物件を選択してください」が表示されることを確認するテスト
- `inquiryHistory` が空配列の場合に `null` が返されることを確認するテスト

### Property-Based Tests

- ランダムな `selectedPropertyIds`（空、1件、複数件）と `loading=false` の組み合わせで、
  ボタンが常に有効化されることを検証するテスト
- ランダムな `selectedPropertyIds` と `loading=true` の組み合わせで、
  ボタンが常に無効化されることを検証するテスト
- `isBugCondition` が `false` の多様な入力に対して、修正前後の動作が一致することを検証するテスト

### Integration Tests

- 買主7359相当のデータ（メールアドレスあり、`status === 'current'` の物件0件）で
  `BuyerDetailPage` を表示し、Gmail送信ボタンがクリック可能であることを確認するテスト
- ボタンクリック後に「物件を選択してください」エラーが表示されることを確認するテスト
- `status === 'current'` の物件がある通常ケースで、ボタンが引き続き有効化されることを確認するテスト
