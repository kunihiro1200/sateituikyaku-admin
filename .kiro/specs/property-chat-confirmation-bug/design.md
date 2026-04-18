# property-chat-confirmation-bug バグ修正設計

## Overview

物件リスト詳細画面の「価格情報セクション」には2種類のCHAT送信ボタンが存在する。

- **青いバー「CHAT送信」**: 売買価格変更時に表示。送信成功後に確認ステータスを「未」にリセットする（正しい動作）
- **オレンジのバー「物件担当へCHAT送信（画像添付可能）」**: 値下げ予約日クリア時に表示。送信成功後に確認ステータスを変更しないのが正しい動作

現在、`PriceSection.tsx` の `handleSendPriceReductionChat`（オレンジバー）が送信成功時に `onChatSendSuccess` コールバックを呼び出しており、`PropertyListingDetailPage.tsx` 側では `onChatSendSuccess={handlePriceChatSendSuccess}` として両ボタン共通のコールバックが渡されている。`handlePriceChatSendSuccess` は無条件に確認ステータスを「未」に更新するため、オレンジバー送信時にも誤って確認ステータスが変更されてしまう。

修正方針は、`PropertyListingDetailPage.tsx` にオレンジバー専用のコールバック `handlePriceReductionChatSendSuccess` を追加し、確認ステータスの更新処理を含めない形で `PriceSection` に渡す。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — オレンジのバー「物件担当へCHAT送信（画像添付可能）」からのCHAT送信が成功したとき
- **Property (P)**: バグ条件が成立するときの期待される正しい動作 — 確認ステータスが変更されないこと
- **Preservation**: 修正によって変更してはならない既存の動作 — 青いバーからのCHAT送信成功時に確認ステータスが「未」になる動作
- **handlePriceChatSendSuccess**: `PropertyListingDetailPage.tsx` 内の関数。CHAT送信成功時に確認ステータスを「未」に更新し、APIを呼び出し、`propertyConfirmationUpdated` イベントを発火する
- **handleSendPriceReductionChat**: `PriceSection.tsx` 内の関数。オレンジバーのCHAT送信処理を担当し、成功時に `onChatSendSuccess` コールバックを呼び出す
- **onChatSendSuccess**: `PriceSection` の props。CHAT送信成功時に呼ばれるコールバック。現在は両ボタン共通で `handlePriceChatSendSuccess` が渡されている（バグの原因）
- **priceSavedButNotSent**: 売買価格が保存済みだがCHATがまだ送信されていない状態を示すフラグ

## Bug Details

### Bug Condition

バグは、ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」を押してCHAT送信が成功したときに発生する。`handleSendPriceReductionChat` が `onChatSendSuccess` を呼び出し、その先で `handlePriceChatSendSuccess` が実行されることで、確認ステータスが無条件に「未」に更新される。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type ChatSendSuccessEvent
  OUTPUT: boolean

  // オレンジのバーからのCHAT送信成功イベントであるとき、バグ条件が成立する
  RETURN X.source = 'orange_bar'
         AND X.sendResult = 'success'
END FUNCTION
```

### Examples

- **例1（バグ発生）**: 値下げ予約日がクリアされた状態でオレンジバーを押してCHAT送信成功 → 確認ステータスが「済」から「未」に変わってしまう（期待: 変わらない）
- **例2（バグ発生）**: 確認ステータスが「未」の状態でオレンジバーを押してCHAT送信成功 → 確認ステータスが「未」のまま（見た目は変わらないが、APIが不要に呼ばれる）
- **例3（正常動作）**: 売買価格が変更された状態で青いバーを押してCHAT送信成功 → 確認ステータスが「未」になる（正しい動作）
- **エッジケース**: CHAT送信が失敗した場合 → 確認ステータスは変更されない（両ボタン共通で正しい動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 青いバー「CHAT送信」からの送信成功時は、確認ステータスを「未」に更新し続ける
- 青いバーからの送信成功時は、`PUT /api/property-listings/:id/confirmation` APIを呼び出し続ける
- 青いバーからの送信成功時は、`propertyConfirmationUpdated` イベントを発火し続ける
- オレンジバー・青いバーともに、送信成功時は成功スナックバーを表示し続ける
- オレンジバー・青いバーともに、送信失敗時はエラースナックバーを表示し続ける
- オレンジバーからの送信成功時は、`priceSavedButNotSent` フラグをリセットし続ける（現在の動作を維持）

**Scope:**
オレンジバーのCHAT送信成功以外のすべての操作は、この修正によって影響を受けない。具体的には：
- 青いバーからのCHAT送信（成功・失敗）
- 確認ステータスの手動更新（`handleUpdateConfirmation`）
- 売買価格の編集・保存
- 値下げ予約日の設定・クリア

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **共通コールバックの誤用**: `PriceSection` の `onChatSendSuccess` props が青いバー・オレンジバーの両方に対して同一の `handlePriceChatSendSuccess` を渡している。このコールバックは青いバー専用の処理（確認ステータスの「未」リセット）を含んでいるため、オレンジバーから呼ばれると不正な副作用が発生する。

2. **コールバック設計の不足**: `PriceSection` コンポーネントが2種類のボタンを持つにもかかわらず、送信成功コールバックが1つしか設計されていない。青いバー用とオレンジバー用で異なるコールバックを受け取る設計になっていない。

3. **責務の混在**: `handlePriceChatSendSuccess` が「スナックバー表示」「フラグリセット」「確認ステータス更新」「API呼び出し」「イベント発火」を一括で行っており、オレンジバーに必要な処理（スナックバー・フラグリセット）と不要な処理（確認ステータス更新・API・イベント）が分離されていない。

## Correctness Properties

Property 1: Bug Condition - オレンジバーCHAT送信時の確認ステータス不変

_For any_ CHAT送信成功イベント X においてバグ条件が成立する（isBugCondition(X) = true）とき、修正後の処理は確認ステータスを変更せず、`PUT /api/property-listings/:id/confirmation` APIを呼び出さず、`propertyConfirmationUpdated` イベントを発火しない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 青いバーCHAT送信時の確認ステータス更新

_For any_ CHAT送信成功イベント X においてバグ条件が成立しない（isBugCondition(X) = false）とき、修正後の処理は修正前と同一の結果を生成し、確認ステータスを「未」に更新し、APIを呼び出し、`propertyConfirmationUpdated` イベントを発火する動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の変更を行う：

**File**: `frontend/frontend/src/components/PriceSection.tsx`

**変更内容**:
1. **新しい props の追加**: `onPriceReductionChatSendSuccess?: (message: string) => void` を `PriceSectionProps` インターフェースに追加する
2. **オレンジバー用コールバックの切り替え**: `handleSendPriceReductionChat` 内の `onChatSendSuccess(...)` 呼び出しを `(onPriceReductionChatSendSuccess ?? onChatSendSuccess)(...)` に変更する（後方互換性を保ちつつ、専用コールバックが渡された場合はそちらを優先する）

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**変更内容**:
1. **新しいコールバック関数の追加**: `handlePriceReductionChatSendSuccess` 関数を追加する。この関数はスナックバー表示と `priceSavedButNotSent` フラグのリセットのみを行い、確認ステータスの更新処理を含めない
2. **PriceSection への props 追加**: `<PriceSection>` に `onPriceReductionChatSendSuccess={handlePriceReductionChatSendSuccess}` を渡す

**新しいコールバック関数の実装イメージ:**
```typescript
// オレンジバー専用: 確認ステータスを変更しない
const handlePriceReductionChatSendSuccess = (message: string) => {
  setSnackbar({ open: true, message, severity: 'success' });
  setPriceSavedButNotSent(false);
  // 確認ステータスの更新・API呼び出し・イベント発火は行わない
};
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず修正前のコードでバグを再現するテストを実行し（探索的バグ条件チェック）、次に修正後のコードで正しい動作と既存動作の保全を検証する（Fix Checking・Preservation Checking）。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `PriceSection` コンポーネントをレンダリングし、オレンジバーのCHAT送信成功時に `onChatSendSuccess` が呼ばれることを確認する。`onChatSendSuccess` が呼ばれた場合、`handlePriceChatSendSuccess` が実行されて確認ステータスが変更されることを示す。

**Test Cases**:
1. **オレンジバー送信成功テスト**: 値下げ予約日クリア状態でオレンジバーを表示し、送信成功時に `onChatSendSuccess` が呼ばれることを確認（修正前は呼ばれる = バグ）
2. **確認ステータス変更テスト**: `onChatSendSuccess` が呼ばれた際に確認ステータスが「未」に変わることを確認（修正前は変わる = バグ）
3. **API呼び出しテスト**: `onChatSendSuccess` 経由で `PUT /confirmation` APIが呼ばれることを確認（修正前は呼ばれる = バグ）

**Expected Counterexamples**:
- オレンジバー送信成功時に `onChatSendSuccess` が呼ばれ、確認ステータスが変更される
- 原因: `handleSendPriceReductionChat` が `onChatSendSuccess` を直接呼び出しており、青いバー専用の処理が実行される

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  confirmationBefore ← getConfirmationStatus()
  apiCallCount ← 0
  eventFired ← false
  triggerOrangeChatSendSuccess(X)
  ASSERT getConfirmationStatus() = confirmationBefore
  ASSERT apiCallCount('PUT /confirmation') = 0
  ASSERT eventFired('propertyConfirmationUpdated') = false
  ASSERT snackbarShown = true
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同一の結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handlePriceChatSendSuccess_original(X) = handlePriceChatSendSuccess_fixed(X)
  // 青いバー送信成功時: 確認ステータスが「未」になる動作を維持
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な物件状態（確認ステータスの初期値、価格変更の有無など）に対して自動的にテストケースを生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強く保証できる

**Test Cases**:
1. **青いバー送信成功の保全**: 青いバーからの送信成功時に確認ステータスが「未」になることを確認（修正後も変わらない）
2. **API呼び出しの保全**: 青いバーからの送信成功時に `PUT /confirmation` APIが呼ばれることを確認
3. **イベント発火の保全**: 青いバーからの送信成功時に `propertyConfirmationUpdated` イベントが発火することを確認
4. **エラー時の保全**: 両ボタンの送信失敗時に確認ステータスが変更されないことを確認

### Unit Tests

- オレンジバー送信成功時に `onPriceReductionChatSendSuccess` が呼ばれ、`onChatSendSuccess` が呼ばれないことを確認
- `handlePriceReductionChatSendSuccess` がスナックバーを表示し、`priceSavedButNotSent` をリセットすることを確認
- `handlePriceReductionChatSendSuccess` が確認ステータスを変更しないことを確認
- 青いバー送信成功時に `onChatSendSuccess`（= `handlePriceChatSendSuccess`）が呼ばれることを確認

### Property-Based Tests

- ランダムな確認ステータス初期値に対して、オレンジバー送信後も値が変わらないことを検証
- ランダムな物件状態に対して、青いバー送信後に確認ステータスが「未」になることを検証
- 多様な入力パターンに対して、エラー時は確認ステータスが変更されないことを検証

### Integration Tests

- 値下げ予約日クリア → オレンジバー表示 → 送信成功 → 確認ステータス不変のフロー全体を確認
- 売買価格変更 → 青いバー表示 → 送信成功 → 確認ステータスが「未」になるフロー全体を確認
- 両ボタンが同一画面に表示されないことを確認（`showOrangeChatButton` が true のとき `showBlueChatButton` は false）
