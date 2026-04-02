# 買主リスト「配信メール」ボタン注意喚起タイミング修正 設計

## Overview

買主リストの「配信メール」ボタンにおいて、注意喚起が表示されるタイミングを修正します。現在はボタンを押した時点で注意喚起が表示され、ボタンが押せない状態になっていますが、正しくはボタンを押してから別ページに遷移する際に注意喚起を表示すべきです。

この修正により、ユーザーは「配信メール」を「要」に変更した後、希望条件を入力しに行くことができるようになります。

## Glossary

- **Bug_Condition (C)**: ボタンを押した時点で注意喚起が表示され、値の変更が阻止される条件
- **Property (P)**: ボタンを押した後、別ページに遷移する際に注意喚起を表示する動作
- **Preservation**: 「配信メール」を「不要」に変更した場合や、希望条件が全て入力済みの場合の既存動作
- **distribution_type**: 「配信メール」フィールド（値: 「要」または「不要」）
- **desired_area**: 希望条件の「エリア」フィールド
- **desired_property_type**: 希望条件の「希望種別」フィールド
- **price_range_***: 希望条件の「価格帯」フィールド（戸建・マンション・土地）
- **handleNavigate**: ページ遷移前にバリデーションを実行する関数
- **checkMissingFields**: 未入力の必須項目をチェックする関数

## Bug Details

### Bug Condition

バグは、ユーザーが「配信メール」ボタンで「要」を選択し、希望条件（エリア・予算・希望種別）が未入力の場合に発生します。現在の実装では、ボタンを押した時点で即座に注意喚起が表示され、値の変更が阻止されます。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, distribution_type: string, desired_conditions: object }
  OUTPUT: boolean
  
  RETURN input.action === 'change_distribution_type'
         AND input.distribution_type === '要'
         AND (input.desired_conditions.desired_area === '' 
              OR input.desired_conditions.desired_property_type === ''
              OR input.desired_conditions.price_range === '')
         AND alert_shown_immediately === true
END FUNCTION
```

### Examples

- **例1**: ユーザーが「配信メール」を「要」に変更しようとする → 希望条件が未入力 → 即座に注意喚起が表示され、値が変更されない（バグ）
- **例2**: ユーザーが「配信メール」を「要」に変更しようとする → 希望条件が未入力 → 即座に注意喚起が表示され、ボタンが押せない（バグ）
- **例3**: ユーザーが「配信メール」を「要」に変更 → 希望条件ページに遷移しようとする → ページ遷移前に注意喚起が表示される（期待される動作）
- **エッジケース**: ユーザーが「配信メール」を「不要」に変更 → 希望条件のチェックは行われない（既存動作を維持）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「配信メール」を「不要」に変更した場合、希望条件のチェックを行わず、値を即座に変更する
- 「配信メール」を「要」に変更し、希望条件が全て入力済みの場合、注意喚起を表示せず、値を即座に変更する
- 「配信メール」以外のフィールドを編集した場合、既存の動作を維持する

**Scope:**
「配信メール」ボタンで「要」を選択し、希望条件が未入力の場合以外は、全て既存の動作を維持します。これには以下が含まれます：
- 「配信メール」を「不要」に変更する場合
- 希望条件が全て入力済みの場合
- 他のフィールドを編集する場合

## Hypothesized Root Cause

bugfix.mdの分析に基づくと、最も可能性が高い問題は以下の通りです：

1. **ボタン押下時のバリデーション**: 「配信メール」ボタンの `onChange` イベントハンドラーで、即座にバリデーションを実行している可能性
   - `handleInlineFieldSave` または `handleFieldChange` 内で希望条件をチェックしている
   - バリデーションエラーが発生すると、値の変更が阻止される

2. **InlineEditableField コンポーネントの実装**: `InlineEditableField` コンポーネントが、値の変更前にバリデーションを実行している可能性
   - `fieldType: 'buttonSelect'` の場合、特別な処理が行われている可能性

3. **checkMissingFields 関数の呼び出しタイミング**: `checkMissingFields` 関数が、フィールド変更時に即座に呼び出されている可能性
   - 現在は `handleNavigate` 関数内でのみ呼び出されるべき

4. **ValidationWarningDialog の表示タイミング**: バリデーション警告ダイアログが、フィールド変更時に即座に表示されている可能性

## Correctness Properties

Property 1: Bug Condition - 配信メール変更時の即時バリデーション除外

_For any_ ユーザー操作で「配信メール」ボタンを「要」に変更する場合、修正後のシステムは希望条件の入力状態に関係なく、ボタンを押せるようにし、値を「要」に変更する。

**Validates: Requirements 2.1**

Property 2: Preservation - ページ遷移時のバリデーション

_For any_ ユーザー操作で「配信メール」を「要」に変更した後、別ページに遷移しようとする場合、修正後のシステムは希望条件が未入力であれば、ページ遷移前に注意喚起を表示し、ページ遷移を阻止する。

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - 配信メール「不要」時の動作

_For any_ ユーザー操作で「配信メール」を「不要」に変更する場合、修正後のシステムは希望条件のチェックを行わず、値を即座に変更する（既存動作を維持）。

**Validates: Requirements 3.1**

Property 4: Preservation - 希望条件入力済み時の動作

_For any_ ユーザー操作で「配信メール」を「要」に変更し、希望条件が全て入力済みの場合、修正後のシステムは注意喚起を表示せず、値を即座に変更する（既存動作を維持）。

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正内容：

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Function**: `handleInlineFieldSave`, `handleFieldChange`, `checkMissingFields`

**Specific Changes**:
1. **ボタン押下時のバリデーション除外**: 「配信メール」フィールドの変更時に、即座にバリデーションを実行しないようにする
   - `handleInlineFieldSave` 関数で、`distribution_type` フィールドの場合はバリデーションをスキップ
   - 値の変更を許可し、DBに保存する

2. **ページ遷移時のバリデーション追加**: `handleNavigate` 関数で、「配信メール」が「要」かつ希望条件が未入力の場合にバリデーションを実行
   - 既存の `checkMissingFields` 関数を活用
   - バリデーションエラーがある場合は `ValidationWarningDialog` を表示

3. **希望条件ページへの遷移は除外**: 希望条件ページへの遷移時は、バリデーションをスキップする
   - ユーザーが希望条件を入力しに行く正しい遷移のため

4. **InlineEditableField コンポーネントの確認**: `InlineEditableField` コンポーネントで、`fieldType: 'buttonSelect'` の場合に特別な処理が行われていないか確認
   - 必要に応じて、バリデーションロジックを削除

5. **checkMissingFields 関数の呼び出しタイミング確認**: `checkMissingFields` 関数が、フィールド変更時に即座に呼び出されていないか確認
   - `handleNavigate` 関数内でのみ呼び出されるべき

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する反例を表面化させ、次に修正が正しく動作し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現する反例を表面化させる。根本原因分析を確認または反証する。反証された場合は、再度仮説を立てる必要があります。

**Test Plan**: 「配信メール」ボタンを「要」に変更し、希望条件が未入力の場合に、ボタンが押せるかどうかをテストします。修正前のコードでは、ボタンが押せない、または値が変更されないことを確認します。

**Test Cases**:
1. **配信メール変更テスト**: 「配信メール」を「要」に変更 + 希望条件未入力 → ボタンが押せない（修正前のコードで失敗）
2. **値変更阻止テスト**: 「配信メール」を「要」に変更 + 希望条件未入力 → 値が変更されない（修正前のコードで失敗）
3. **即時注意喚起テスト**: 「配信メール」を「要」に変更 + 希望条件未入力 → 即座に注意喚起が表示される（修正前のコードで失敗）
4. **エッジケーステスト**: 「配信メール」を「不要」に変更 + 希望条件未入力 → ボタンが押せる（修正前のコードで成功）

**Expected Counterexamples**:
- ボタンを押した時点で注意喚起が表示され、値の変更が阻止される
- 可能性のある原因: ボタン押下時のバリデーション、InlineEditableFieldコンポーネントの実装、checkMissingFields関数の呼び出しタイミング

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleInlineFieldSave_fixed('distribution_type', '要')
  ASSERT result.success === true
  ASSERT buyer.distribution_type === '要'
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleInlineFieldSave_original(input) = handleInlineFieldSave_fixed(input)
END FOR
```

**Testing Approach**: 保存チェックには、プロパティベーステストが推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成します
- 手動の単体テストでは見逃す可能性のあるエッジケースをキャッチします
- 非バグ入力に対して動作が変更されていないことを強力に保証します

**Test Plan**: まず修正前のコードで「配信メール」を「不要」に変更する動作や、希望条件が入力済みの場合の動作を観察し、その後、その動作をキャプチャするプロパティベーステストを作成します。

**Test Cases**:
1. **配信メール「不要」保存テスト**: 修正前のコードで「配信メール」を「不要」に変更する動作を観察し、修正後も同じ動作が継続することを検証するテストを作成
2. **希望条件入力済み保存テスト**: 修正前のコードで希望条件が入力済みの場合の動作を観察し、修正後も同じ動作が継続することを検証するテストを作成
3. **ページ遷移バリデーションテスト**: 修正前のコードでページ遷移時のバリデーション動作を観察し、修正後も同じ動作が継続することを検証するテストを作成

### Unit Tests

- 「配信メール」ボタンを「要」に変更するテスト（希望条件未入力）
- 「配信メール」ボタンを「不要」に変更するテスト（希望条件未入力）
- ページ遷移時のバリデーションテスト（「配信メール」が「要」+ 希望条件未入力）
- 希望条件ページへの遷移テスト（バリデーションスキップ）

### Property-Based Tests

- ランダムな買主データを生成し、「配信メール」ボタンの動作を検証
- ランダムな希望条件の入力状態を生成し、ページ遷移時のバリデーション動作を検証
- 多くのシナリオで既存の動作が継続することをテスト

### Integration Tests

- 「配信メール」を「要」に変更 → 希望条件ページに遷移 → 希望条件を入力 → 保存
- 「配信メール」を「要」に変更 → 別ページに遷移しようとする → バリデーション警告が表示される
- 「配信メール」を「不要」に変更 → 別ページに遷移 → バリデーション警告が表示されない
