# seller-call-mode-email-field-assignment-bug バグ修正設計

## Overview

`CallModePage.tsx` の `handleConfirmSend` 関数内に存在するラベルベースフォールバック判定ロジックが、意図しないテンプレートにもマッチし、`valuationReasonEmailAssignee`（査定理由別３後Eメ担）フィールドに誤って値が書き込まれるバグを修正する。

具体的には、以下の2箇所に重複して存在するフォールバック判定の条件：

```typescript
} else if (template.label.includes('査定額案内') || template.label.includes('査定理由')) {
  assigneeKeyForDirect = 'valuationReasonEmailAssignee';
}
```

この条件が「査定額案内メール」（本来は `valuationReasonEmailAssignee` に書き込むべきでない）や、「査定理由」という文字列を含む他のテンプレートにも誤ってマッチしてしまう。

修正方針は、`EMAIL_TEMPLATE_ASSIGNEE_MAP` に定義されたIDベースのマッピングのみを使用し、ラベルの部分一致によるフォールバック判定から `査定額案内` と `査定理由` の条件を削除することで、誤ったフィールド書き込みを防止する。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — `EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在しないテンプレートを送信した際に、ラベルフォールバック判定が `valuationReasonEmailAssignee` に誤ってマッチする
- **Property (P)**: 期待される正しい動作 — 各テンプレート送信時に、対応する正しいassigneeフィールドのみが更新される
- **Preservation**: 修正によって変更してはいけない既存の動作 — 各テンプレートIDに対するEMAIL_TEMPLATE_ASSIGNEE_MAPの正しいマッピング動作
- **handleConfirmSend**: `frontend/frontend/src/pages/CallModePage.tsx` 内の関数で、メール送信確認後に実行される処理（担当フィールドの自動セットを含む）
- **EMAIL_TEMPLATE_ASSIGNEE_MAP**: `frontend/frontend/src/components/AssigneeSection.tsx` で定義されたテンプレートID → sellerKeyのマッピングオブジェクト
- **assigneeKeyForDirect**: `handleConfirmSend` 内でフロントエンドが直接担当フィールドを保存する際に使用するsellerKeyの変数名
- **valuationReasonEmailAssignee**: 「査定理由別３後Eメ担」フィールド。`reason_relocation_3day`、`reason_inheritance_3day`、`reason_divorce_3day`、`reason_loan_3day` の4テンプレートIDのみが対象

## Bug Details

### Bug Condition

バグは `handleConfirmSend` 関数内のEmailパスで、`EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在しないテンプレートを送信した際に発動する。フォールバック判定の `template.label.includes('査定額案内') || template.label.includes('査定理由')` という条件が、意図しないテンプレートラベルにもマッチし、`valuationReasonEmailAssignee` に誤って値を設定してしまう。

このフォールバック判定は `handleConfirmSend` 内に2箇所存在する（メイン処理とバックグラウンド処理）。

**Formal Specification:**
```
FUNCTION isBugCondition(template)
  INPUT: template of type { id: string, label: string }
  OUTPUT: boolean

  // EMAIL_TEMPLATE_ASSIGNEE_MAPにIDが存在しない（フォールバック判定に落ちる）
  mapResult := EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id]
  IF mapResult IS NOT undefined THEN
    RETURN false  // IDマッピングが存在する場合はバグ条件に該当しない
  END IF

  // ラベルフォールバック判定でvaluationReasonEmailAssigneeに誤マッチする
  RETURN (template.label.includes('査定額案内') OR template.label.includes('査定理由'))
         AND NOT (template.id IN ['reason_relocation_3day', 'reason_inheritance_3day',
                                   'reason_divorce_3day', 'reason_loan_3day'])
END FUNCTION
```

### Examples

- **バグ例1**: スプレッドシート由来の「査定額案内メール（相続以外）」テンプレートを送信 → `EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在しない → ラベルに「査定額案内」が含まれる → `valuationReasonEmailAssignee` に誤って担当者イニシャルが書き込まれる（期待: 書き込まれない）
- **バグ例2**: スプレッドシート由来の「査定理由確認メール」のようなラベルを持つテンプレートを送信 → `EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在しない → ラベルに「査定理由」が含まれる → `valuationReasonEmailAssignee` に誤って担当者イニシャルが書き込まれる（期待: 書き込まれない）
- **正常例**: `reason_relocation_3day` テンプレートを送信 → `EMAIL_TEMPLATE_ASSIGNEE_MAP` に `valuationReasonEmailAssignee` が正しくマッピングされている → IDマッピングが使用される → `valuationReasonEmailAssignee` に正しく担当者イニシャルが書き込まれる

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `EMAIL_TEMPLATE_ASSIGNEE_MAP` に定義されたIDベースのマッピングによる担当フィールド自動セット（全テンプレート）
- 訪問前日通知メール（`visit_reminder`）送信時の `visitReminderAssignee` への書き込み
- リマインドメール（`remind`）送信時の `callReminderEmailAssignee` への書き込み
- キャンセル案内メール（`ieul_call_cancel` 等）送信時の `cancelNoticeAssignee` への書き込み
- 査定理由別３後Eメール（`reason_*_3day`）送信時の `valuationReasonEmailAssignee` への書き込み
- 除外前・長期客メール（`exclusion_long_term`）送信時の `longTermEmailAssignee` への書き込み
- ラベルフォールバック判定の他の条件（訪問前日、リマインド、キャンセル、長期客）は引き続き機能する

**スコープ:**
`EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在するテンプレートの動作は一切変更しない。
フォールバック判定の `査定額案内` と `査定理由` の条件のみを削除する。

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **ラベルフォールバック判定の過剰マッチ**: スプレッドシート由来のテンプレートIDは `seller_sheet_XX` 形式のため `EMAIL_TEMPLATE_ASSIGNEE_MAP` にマッチしない。フォールバック判定でラベルの部分一致を使用しているが、`template.label.includes('査定額案内')` という条件が「査定額案内メール」系テンプレートに誤ってマッチする

2. **フォールバック判定の重複**: `handleConfirmSend` 内に同じフォールバック判定ロジックが2箇所存在する（メイン処理の `assigneeKeyForDirect` 計算部分と、バックグラウンド処理の `assigneeKey` 計算部分）。両方に同じバグが存在する

3. **EMAIL_TEMPLATE_ASSIGNEE_MAPとの不整合**: `EMAIL_TEMPLATE_ASSIGNEE_MAP` には査定額案内系のIDが定義されていない（正しい設計）が、フォールバック判定がその意図を無視して `valuationReasonEmailAssignee` を設定してしまう

4. **査定理由別３後Eメールの正しいIDマッピング**: `reason_relocation_3day` 等のIDは `EMAIL_TEMPLATE_ASSIGNEE_MAP` に正しくマッピングされているため、フォールバック判定に落ちることはない。つまりフォールバック判定の `査定理由` 条件は実際には不要

## Correctness Properties

Property 1: Bug Condition - 誤ったvaluationReasonEmailAssignee書き込みの防止

_For any_ テンプレートで `EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id]` が `undefined` を返し（IDマッピングが存在しない）、かつ `template.id` が `reason_relocation_3day`、`reason_inheritance_3day`、`reason_divorce_3day`、`reason_loan_3day` のいずれでもない場合、修正後の `handleConfirmSend` は `valuationReasonEmailAssignee` フィールドを変更しない。

**Validates: Requirements 2.3, 2.4**

Property 2: Preservation - 既存のIDベースマッピングの保持

_For any_ テンプレートで `EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id]` が `undefined` でない（IDマッピングが存在する）場合、修正後の `handleConfirmSend` は修正前と同じ `assigneeKey` を使用して担当フィールドを更新し、既存の正しいマッピング動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `handleConfirmSend`

**Specific Changes**:

1. **メイン処理のフォールバック判定から `査定額案内` と `査定理由` の条件を削除**（約3080行目付近）:

   修正前:
   ```typescript
   } else if (template.label.includes('査定額案内') || template.label.includes('査定理由')) {
     assigneeKeyForDirect = 'valuationReasonEmailAssignee';
   } else if (template.label.includes('長期客') || template.label.includes('除外前')) {
   ```

   修正後:
   ```typescript
   } else if (template.label.includes('長期客') || template.label.includes('除外前')) {
   ```

2. **バックグラウンド処理のフォールバック判定から同じ条件を削除**（約3130行目付近）:

   修正前:
   ```typescript
   } else if (template.label.includes('査定額案内') || template.label.includes('査定理由')) {
     assigneeKey = 'valuationReasonEmailAssignee';
   } else if (template.label.includes('長期客') || template.label.includes('除外前')) {
   ```

   修正後:
   ```typescript
   } else if (template.label.includes('長期客') || template.label.includes('除外前')) {
   ```

**変更の根拠**:
- `reason_*_3day` テンプレートは `EMAIL_TEMPLATE_ASSIGNEE_MAP` に正しくマッピングされているため、フォールバック判定に落ちることはない
- 査定額案内メールは `valuationReasonEmailAssignee` に書き込むべきでない
- 削除する条件は実際には不要（IDマッピングが正しく機能している）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず修正前のコードでバグを再現するテストを書いてバグを確認し、次に修正後のコードでバグが解消されていること（Fix Checking）と既存動作が保持されていること（Preservation Checking）を確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認する。

**Test Plan**: `handleConfirmSend` 内のフォールバック判定ロジックを単体でテストし、`EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在しない「査定額案内」ラベルのテンプレートに対して `valuationReasonEmailAssignee` が設定されることを確認する。

**Test Cases**:
1. **査定額案内メールのバグ再現**: `{ id: 'seller_sheet_99', label: '査定額案内メール（相続以外）' }` を入力 → フォールバック判定が `valuationReasonEmailAssignee` を返すことを確認（修正前コードで失敗するはず）
2. **査定理由含むラベルのバグ再現**: `{ id: 'seller_sheet_100', label: '査定理由確認メール' }` を入力 → フォールバック判定が `valuationReasonEmailAssignee` を返すことを確認（修正前コードで失敗するはず）
3. **不通時Sメールのバグ確認**: SMS送信パスでは `EMAIL_TEMPLATE_ASSIGNEE_MAP` を参照しないため、このバグは発生しないことを確認

**Expected Counterexamples**:
- `template.label.includes('査定額案内')` が `true` を返し、`valuationReasonEmailAssignee` が設定される
- `template.label.includes('査定理由')` が `true` を返し、`valuationReasonEmailAssignee` が設定される

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当するすべての入力に対して `valuationReasonEmailAssignee` が設定されないことを確認する。

**Pseudocode:**
```
FOR ALL template WHERE isBugCondition(template) DO
  result := getAssigneeKeyFromFallback_fixed(template)
  ASSERT result != 'valuationReasonEmailAssignee'
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、`EMAIL_TEMPLATE_ASSIGNEE_MAP` に定義されたIDベースのマッピングが引き続き正しく機能することを確認する。

**Pseudocode:**
```
FOR ALL template WHERE NOT isBugCondition(template) DO
  result_original := getAssigneeKey_original(template)
  result_fixed    := getAssigneeKey_fixed(template)
  ASSERT result_original = result_fixed
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される。`EMAIL_TEMPLATE_ASSIGNEE_MAP` の全エントリに対して、修正前後で同じ `assigneeKey` が返されることを確認する。

**Test Cases**:
1. **IDマッピング保持**: `EMAIL_TEMPLATE_ASSIGNEE_MAP` の全IDに対して、修正後も同じ `assigneeKey` が返されることを確認
2. **訪問前日通知メール保持**: `{ id: 'seller_sheet_X', label: '☆訪問前日通知メール' }` → `visitReminderAssignee` が返されることを確認
3. **リマインドメール保持**: `{ id: 'seller_sheet_X', label: 'リマインド' }` → `callReminderEmailAssignee` が返されることを確認
4. **キャンセル案内保持**: `{ id: 'seller_sheet_X', label: 'キャンセル案内のみ（イエウール）' }` → `cancelNoticeAssignee` が返されることを確認
5. **査定理由別３後Eメール保持**: `{ id: 'reason_relocation_3day', label: '（査定理由別）住替え先（３日後メール）' }` → `valuationReasonEmailAssignee` が返されることを確認（IDマッピングが使用される）

### Unit Tests

- フォールバック判定ロジックを抽出した純粋関数のユニットテスト
- `EMAIL_TEMPLATE_ASSIGNEE_MAP` の全エントリに対するIDマッピングテスト
- バグ条件に該当するテンプレートラベルに対して `valuationReasonEmailAssignee` が返されないことのテスト

### Property-Based Tests

- ランダムなテンプレートIDとラベルの組み合わせを生成し、`valuationReasonEmailAssignee` が設定されるのは `reason_*_3day` IDのみであることを確認
- `EMAIL_TEMPLATE_ASSIGNEE_MAP` の全エントリに対して、修正前後で同じ `assigneeKey` が返されることを確認
- 「査定額案内」「査定理由」を含む任意のラベルに対して、IDが `reason_*_3day` でない限り `valuationReasonEmailAssignee` が返されないことを確認

### Integration Tests

- 通話モードページで「査定額案内メール」を送信し、`valuationReasonEmailAssignee` フィールドが変更されないことを確認
- 通話モードページで「査定理由別３後Eメール」を送信し、`valuationReasonEmailAssignee` フィールドに正しく担当者イニシャルが設定されることを確認
- 通話モードページで「訪問前日通知メール」を送信し、`visitReminderAssignee` フィールドに正しく担当者イニシャルが設定されることを確認
