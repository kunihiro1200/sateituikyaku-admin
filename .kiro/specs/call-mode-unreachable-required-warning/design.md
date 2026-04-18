# call-mode-unreachable-required-warning バグ修正デザイン

## Overview

通話モードページ（CallModePage）において、`navigateWithWarningCheck` 関数にて「不通」フィールドの未入力チェックが欠落しているバグを修正する。

現在、保存ボタン（`handleSaveAndExit`）には反響日が2026年1月1日以降の場合に不通フィールドの未入力をブロックするバリデーションが存在する。しかし、ナビゲーションバー・戻るボタン・売主間遷移など全ページ遷移経路を担う `navigateWithWarningCheck` 関数にはこのチェックが含まれていないため、保存ボタンを押さずにページを離れると警告なしに遷移できてしまう。

修正方針は、`navigateWithWarningCheck` 関数の既存チェック群の適切な位置に「不通未入力警告」を追加し、未入力の場合は既存の `NavigationWarningDialog` を `warningType: 'unreachable'` で表示することである。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — 反響日が2026年1月1日以降 かつ 不通フィールドが未入力（`unreachableStatus === null`）の状態でページ遷移を試みること
- **Property (P)**: 期待される正しい動作 — 「不通が未入力です。このまま移動しますか？」という警告ポップアップが表示され、ユーザーが選択できること
- **Preservation**: 修正によって変更してはならない既存の動作 — 不通入力済み時の遷移・反響日2026年以前の遷移・既存の保存ボタンバリデーション・他の警告ダイアログ（次電日ブロック・確度警告・1番電話警告）
- **navigateWithWarningCheck**: `frontend/frontend/src/pages/CallModePage.tsx` 内の関数（Line 2041付近）。全ページ遷移経路（ナビゲーションバー・戻るボタン・売主間遷移）から呼び出され、遷移前の各種チェックを順次実行する
- **unreachableStatus**: 不通フィールドの状態値。`null`（未入力）・`'不通'`・`'通電OK'` の3値を取る
- **NavigationWarningDialog**: 遷移警告ダイアログ。`warningType` で表示内容を切り替える既存コンポーネント（現在 `'confidence'` と `'firstCall'` をサポート）

## Bug Details

### Bug Condition

バグは、反響日が2026年1月1日以降の売主の通話モードページで「不通」フィールドが未入力（`unreachableStatus === null`）の状態で、`navigateWithWarningCheck` を経由したページ遷移（ナビゲーションバー・戻るボタン・売主間遷移）を試みたときに発動する。

`navigateWithWarningCheck` 関数は次電日ブロック・確度警告・1番電話警告の3チェックを持つが、不通未入力チェックが存在しないため、条件を満たしていても `onConfirm()` が直接呼ばれて遷移してしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input = { seller, unreachableStatus, navigationAction }
  OUTPUT: boolean

  isAfterJan2026 := seller.inquiryDate >= '2026-01-01'
  isUnreachableEmpty := unreachableStatus === null
  isNavigationAction := navigationAction IN ['navbar', 'backButton', 'sellerSwitch']

  RETURN isAfterJan2026
         AND isUnreachableEmpty
         AND isNavigationAction
END FUNCTION
```

### Examples

- 反響日2026年3月1日の売主で不通未入力 → ナビゲーションバーから別ページへ遷移 → **警告なしに遷移（バグ）**
- 反響日2026年1月1日の売主で不通未入力 → 「一覧に戻る」ボタンを押す → **警告なしに遷移（バグ）**
- 反響日2026年2月1日の売主で不通未入力 → 別の売主の通話モードへ遷移 → **警告なしに遷移（バグ）**
- 反響日2025年12月31日の売主で不通未入力 → ナビゲーションバーから遷移 → 警告なしに遷移（正常：対象外）

## Expected Behavior

### Preservation Requirements

**変更してはならない既存の動作:**
- 不通フィールドに値が入力済み（`'不通'` または `'通電OK'`）の場合、不通に関する警告は表示しない
- 反響日が2026年1月1日より前の売主では、不通未入力でも警告を表示しない
- 「不通・1番電話を保存」ボタン（`handleSaveAndExit`）の既存バリデーション（`'不通ステータスを選択してください'` エラー表示）は変更しない
- 次電日未入力ブロック（`NavigationBlockDialog`）は引き続き最優先で動作する
- 次電日変更確認ダイアログ（`NextCallDateReminderDialog`）は引き続き動作する
- 確度未入力警告（`warningType: 'confidence'`）は引き続き動作する
- 1番電話未入力警告（`warningType: 'firstCall'`）は引き続き動作する
- 警告ポップアップで「このまま遷移する」を選択した場合、遷移を実行する
- 警告ポップアップで「戻って入力する」を選択した場合、ポップアップを閉じてページに留まる

**スコープ:**
不通フィールドに関係しない全ての入力（マウスクリック・他のキーボード操作・不通入力済みの遷移・2026年以前の反響日の遷移）は、この修正によって一切影響を受けない。

## Hypothesized Root Cause

バグの根本原因は以下の通りと推定される：

1. **チェック追加漏れ**: `navigateWithWarningCheck` 関数に不通未入力チェックが実装されていない。`handleSaveAndExit` には2026年1月1日以降の不通バリデーションが存在するが、同等のチェックが `navigateWithWarningCheck` に追加されなかった

2. **段階的な機能追加による不整合**: 不通フィールドは後から必須化されたと推測される。保存ボタンのバリデーションは追加されたが、遷移チェック関数への追加が漏れた

3. **warningType の拡張不足**: `NavigationWarningDialog` の `warningType` は `'confidence' | 'firstCall'` のみ定義されており、`'unreachable'` が追加されていない。ダイアログのUI側にも対応するメッセージが存在しない

## Correctness Properties

Property 1: Bug Condition - 不通未入力時の遷移警告表示

_For any_ ページ遷移操作において、バグ条件（反響日が2026年1月1日以降 かつ 不通フィールドが未入力）が成立する場合、修正後の `navigateWithWarningCheck` 関数は「不通が未入力です。このまま移動しますか？」という警告ポップアップを表示し、ユーザーが「このまま遷移する」または「戻って入力する」を選択できるようにしなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 非バグ条件入力の動作保持

_For any_ ページ遷移操作において、バグ条件が成立しない場合（不通入力済み・反響日2026年以前・その他の遷移操作）、修正後の `navigateWithWarningCheck` 関数は修正前と全く同じ動作をしなければならない。既存の次電日ブロック・確度警告・1番電話警告・保存ボタンバリデーションは変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因の分析が正しいと仮定した場合の修正内容：

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

**変更1: `warningType` の型定義を拡張**

```typescript
// 変更前（Line 921付近）
warningType?: 'firstCall' | 'confidence';

// 変更後
warningType?: 'firstCall' | 'confidence' | 'unreachable';
```

**変更2: `navigateWithWarningCheck` 関数に不通未入力チェックを追加**

既存チェックの優先順位を維持しつつ、確度チェック（`isAfterJan2026`）の直前に追加する。

```typescript
const navigateWithWarningCheck = (onConfirm: () => void) => {
  // 1. 次電日未入力ブロック（最優先・変更なし）
  if (editedStatus?.includes('追客中') && !editedNextCallDate) {
    setNavigationBlockDialog({ open: true });
    return;
  }

  // 2. 次電日変更確認ダイアログ（変更なし）
  if (shouldShowReminderDialog(...)) {
    setNextCallDateReminderDialog({ open: true, onProceed: onConfirm });
    return;
  }

  // 3. 【新規追加】不通未入力警告（2026年1月1日以降）
  const isAfterJan2026 = seller?.inquiryDate && new Date(seller.inquiryDate) >= new Date('2026-01-01');
  if (isAfterJan2026 && !unreachableStatus) {
    setNavigationWarningDialog({ open: true, warningType: 'unreachable', onConfirm });
    return;
  }

  // 4. 確度未入力警告（変更なし）
  // 5. 1番電話未入力警告（変更なし）
  // 6. onConfirm()
};
```

**変更3: `NavigationWarningDialog` のUI表示に `'unreachable'` ケースを追加**

```tsx
// DialogTitle（Line 8176付近）
{navigationWarningDialog.warningType === 'confidence'
  ? '⚠️ 確度が未入力です'
  : navigationWarningDialog.warningType === 'unreachable'
    ? '⚠️ 不通が未入力です'
    : '⚠️ 1番電話が未入力です'}

// DialogContent（Line 8182付近）
{navigationWarningDialog.warningType === 'confidence'
  ? <>確度が未入力です。<br />このまま移動しますか？</>
  : navigationWarningDialog.warningType === 'unreachable'
    ? <>不通が未入力です。<br />このまま移動しますか？</>
    : <>不通が入力されていますが、1番電話が未入力です。<br />このまま移動しますか？</>}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず修正前のコードでバグを再現するテストを書いてカウンターエグザンプルを確認し、次に修正後のコードでバグが解消されかつ既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグが再現することを確認し、根本原因分析を検証する。

**Test Plan**: 反響日2026年1月1日以降・不通未入力の状態で `navigateWithWarningCheck` を呼び出し、`setNavigationWarningDialog` が `warningType: 'unreachable'` で呼ばれないことを確認する（修正前は `onConfirm` が直接呼ばれる）。

**Test Cases**:
1. **ナビゲーションバー遷移テスト**: 反響日2026年3月1日・不通未入力で `navigateWithWarningCheck(() => navigate('/'))` を呼び出す（修正前は警告なしに遷移する）
2. **戻るボタンテスト**: 反響日2026年1月1日・不通未入力で「一覧に戻る」ボタンの処理を呼び出す（修正前は警告なしに遷移する）
3. **売主間遷移テスト**: 反響日2026年2月1日・不通未入力で別売主への遷移を試みる（修正前は警告なしに遷移する）
4. **境界値テスト**: 反響日2025年12月31日・不通未入力で遷移を試みる（修正前後ともに警告なし・正常動作）

**Expected Counterexamples**:
- 修正前: `setNavigationWarningDialog` が呼ばれず、`onConfirm` が直接実行される
- 根本原因: `navigateWithWarningCheck` に不通未入力チェックが存在しない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待通りの警告を表示することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := navigateWithWarningCheck_fixed(input)
  ASSERT setNavigationWarningDialog called WITH warningType = 'unreachable'
  ASSERT onConfirm NOT called directly
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT navigateWithWarningCheck_original(input) = navigateWithWarningCheck_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 入力ドメイン（反響日・不通状態・ステータス・次電日の組み合わせ）が広く、手動テストでは網羅困難
- 境界値（2026年1月1日前後）や状態の組み合わせを自動生成できる
- 既存の警告ダイアログ（次電日ブロック・確度警告・1番電話警告）との優先順位が保持されることを多数のケースで検証できる

**Test Cases**:
1. **不通入力済み保持テスト**: `unreachableStatus = '不通'` または `'通電OK'` の場合、不通警告が表示されないことを確認
2. **反響日2026年以前保持テスト**: `inquiryDate < '2026-01-01'` の場合、不通警告が表示されないことを確認
3. **次電日ブロック優先テスト**: 次電日未入力かつ不通未入力の場合、次電日ブロックが優先されることを確認
4. **確度警告優先テスト**: 不通入力済み・確度未入力の場合、確度警告が表示されることを確認（不通警告は表示されない）

### Unit Tests

- 反響日2026年1月1日以降・不通未入力で `navigateWithWarningCheck` を呼び出すと `warningType: 'unreachable'` のダイアログが表示されること
- 反響日2025年12月31日・不通未入力では不通警告が表示されないこと
- 不通入力済み（`'不通'` / `'通電OK'`）では不通警告が表示されないこと
- 「このまま遷移する」選択時に `onConfirm` が実行されること
- 「戻って入力する」選択時にダイアログが閉じてページに留まること

### Property-Based Tests

- ランダムな反響日（2025年〜2027年）と不通状態の組み合わせを生成し、バグ条件の判定が正しいことを検証
- 不通入力済みの全ての遷移シナリオで、既存の警告ダイアログ動作が変わらないことを検証
- 次電日ブロック・確度警告・1番電話警告との優先順位が多数のシナリオで保持されることを検証

### Integration Tests

- 反響日2026年以降の売主でナビゲーションバーから遷移 → 不通警告ポップアップが表示されること
- 警告ポップアップで「このまま遷移する」→ 遷移が実行されること
- 警告ポップアップで「戻って入力する」→ ページに留まること
- 不通を入力してから遷移 → 警告なしに遷移できること
- 反響日2025年以前の売主で不通未入力のまま遷移 → 警告なしに遷移できること
