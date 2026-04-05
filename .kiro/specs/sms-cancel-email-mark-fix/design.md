# SMS送信「キャンセル案内」テンプレート選択時の誤マーク表示修正 Bugfix Design

## Overview

通話モードページのSMS送信機能において、「キャンセル案内」テンプレートを選択した際に、「メール送信確認」セクションの「査定理由別３後Eメ担当」に不要な赤色マークが表示される問題を修正します。

この問題は、SMS送信後に担当フィールドを自動セットする処理において、`SMS_TEMPLATE_ASSIGNEE_MAP`のマッピングが正しく機能していないことが原因です。具体的には、「キャンセル案内」テンプレート（`cancellation`）を選択した際に、`cancelNoticeAssignee`フィールドのみが更新されるべきですが、何らかの理由で`valuationReasonEmailAssignee`フィールドも更新されてしまっています。

## Glossary

- **Bug_Condition (C)**: SMS送信で「キャンセル案内」テンプレートを選択し、送信を実行した際に、`valuationReasonEmailAssignee`フィールドに誤って値が設定される条件
- **Property (P)**: SMS送信で「キャンセル案内」テンプレートを選択した場合、`cancelNoticeAssignee`フィールドのみが更新され、`valuationReasonEmailAssignee`フィールドは更新されない
- **Preservation**: Email送信や他のSMSテンプレート選択時の担当フィールド自動セット機能が正しく動作し続けること
- **SMS_TEMPLATE_ASSIGNEE_MAP**: SMSテンプレートIDと対応するsellerフィールドのマッピング定義（`AssigneeSection.tsx`）
- **assigneeKey**: SMS送信後に自動セットされる担当フィールドのキー（例: `cancelNoticeAssignee`）
- **sendStatus**: 活動履歴から計算されたSMS/Email送信状態（`calcSendStatus`関数）

## Bug Details

### Bug Condition

バグは、SMS送信で「キャンセル案内」テンプレートを選択し、送信を実行した際に発生します。`CallModePage.tsx`の`handleConfirmSend`関数内で、`SMS_TEMPLATE_ASSIGNEE_MAP[template.id]`を使用して担当フィールドを自動セットする処理が実行されますが、この処理において`valuationReasonEmailAssignee`フィールドにも誤って値が設定されてしまいます。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { templateId: string, sendType: 'sms' | 'email' }
  OUTPUT: boolean
  
  RETURN input.sendType === 'sms'
         AND input.templateId === 'cancellation'
         AND valuationReasonEmailAssigneeIsUpdated()
END FUNCTION
```

### Examples

- **例1**: SMS送信で「キャンセル案内」テンプレートを選択 → 「キャンセル案内担当」に赤色マーク（✅正しい） + 「査定理由別３後Eメ担当」に赤色マーク（❌誤り）
- **例2**: SMS送信で「不通時Sメール」テンプレートを選択 → 「不通時Sメール担当」に赤色マーク（✅正しい） + 他のフィールドにマークなし（✅正しい）
- **例3**: Email送信で「キャンセル案内」テンプレートを送信 → 「キャンセル案内担当」に青色マーク（✅正しい） + 他のフィールドにマークなし（✅正しい）
- **エッジケース**: SMS送信で「キャンセル案内」テンプレートを選択し、ログインユーザーのイニシャルが取得できない場合 → 担当フィールドは更新されない（✅正しい）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Email送信で「（査定理由別）～」のテンプレートを送信した際、「査定理由別３後Eメ担当」に青色のマークが正しく表示される
- SMS送信で「不通時Sメール」などの他のテンプレートを選択した際、対応する担当フィールドのみに赤色のマークが表示される
- Email送信で「キャンセル案内」テンプレートを送信した際、「キャンセル案内担当」に青色のマークが正しく表示される

**Scope:**
SMS送信で「キャンセル案内」テンプレート以外を選択した場合、または Email送信を実行した場合は、この修正の影響を受けません。これには以下が含まれます：
- SMS送信で「不通時Sメール」「査定Sメール」「除外前・長期客Sメール」「当社が電話したというリマインドメール」「訪問事前通知メール」を選択した場合
- Email送信で任意のテンプレートを送信した場合
- 担当フィールドの手動編集

## Hypothesized Root Cause

コードレビューの結果、以下の可能性が考えられます：

1. **マッピング定義の誤り**: `SMS_TEMPLATE_ASSIGNEE_MAP`に`cancellation`テンプレートが複数のフィールドにマッピングされている可能性
   - 現在の定義: `cancellation: 'cancelNoticeAssignee'`
   - 可能性: 何らかの理由で`valuationReasonEmailAssignee`も含まれている

2. **活動履歴の解析ロジックの誤り**: `calcSendStatus`関数が活動履歴を解析する際、「キャンセル案内」のラベルを誤って`valuationReasonEmailAssignee`にもマッピングしている可能性
   - `SMS_LABEL_TO_KEY`の定義を確認する必要がある

3. **担当フィールド自動セット処理の誤り**: `handleConfirmSend`関数内で、`assigneeKey`の値が正しく取得されているが、何らかの理由で複数のフィールドが更新されている可能性
   - API呼び出し時に複数のフィールドが含まれている可能性

4. **ボタンの色付けロジックの誤り**: `AssigneeSection.tsx`のボタン色付けロジックが、`sendStatus`の計算結果に基づいて誤って赤色マークを表示している可能性
   - `sendStatus[field.sellerKey]`の値が誤って`'sms'`になっている可能性

## Correctness Properties

Property 1: Bug Condition - SMS「キャンセル案内」送信時の担当フィールド更新

_For any_ SMS送信において、「キャンセル案内」テンプレート（`cancellation`）を選択した場合、修正後のシステムは`cancelNoticeAssignee`フィールドのみを更新し、`valuationReasonEmailAssignee`フィールドは更新しない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他のテンプレート選択時の動作

_For any_ SMS送信またはEmail送信において、「キャンセル案内」テンプレート以外を選択した場合、修正後のシステムは元のシステムと同じ動作を行い、対応する担当フィールドのみを更新する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の分析結果に基づき、以下の修正を実施します：

**File**: `frontend/frontend/src/components/AssigneeSection.tsx`

**Specific Changes**:
1. **`SMS_TEMPLATE_ASSIGNEE_MAP`の確認**: `cancellation`テンプレートが`cancelNoticeAssignee`のみにマッピングされていることを確認
   - 現在の定義が正しいことを確認
   - 他のテンプレートとの重複がないことを確認

2. **`SMS_LABEL_TO_KEY`の確認**: 「キャンセル案内」ラベルが`cancelNoticeAssignee`のみにマッピングされていることを確認
   - 現在の定義: `'キャンセル案内': 'cancelNoticeAssignee'`
   - 他のラベルとの重複がないことを確認

3. **`calcSendStatus`関数のデバッグログ追加**: 活動履歴の解析結果を確認するため、デバッグログを追加
   - どのラベルがどのフィールドにマッピングされているか確認
   - `sendStatus`の計算結果を確認

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Specific Changes**:
4. **担当フィールド自動セット処理のデバッグログ追加**: `handleConfirmSend`関数内で、`assigneeKey`の値とAPI呼び出しの内容を確認
   - `SMS_TEMPLATE_ASSIGNEE_MAP[template.id]`の値を確認
   - API呼び出し時のペイロードを確認

5. **修正の適用**: 根本原因が特定された後、該当箇所を修正
   - マッピング定義の修正（必要な場合）
   - 活動履歴解析ロジックの修正（必要な場合）
   - 担当フィールド自動セット処理の修正（必要な場合）

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現し、根本原因を特定します。次に、修正後のコードでバグが解消され、既存の機能が正しく動作することを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を特定します。

**Test Plan**: 通話モードページでSMS送信機能を使用し、「キャンセル案内」テンプレートを選択して送信を実行します。その後、「メール送信確認」セクションの各担当フィールドのボタンの色を確認します。また、ブラウザのDevToolsでネットワークタブを開き、API呼び出しの内容を確認します。

**Test Cases**:
1. **キャンセル案内SMS送信テスト**: SMS送信で「キャンセル案内」テンプレートを選択し、送信を実行（修正前のコードで失敗することを確認）
2. **不通時SメールSMS送信テスト**: SMS送信で「不通時Sメール」テンプレートを選択し、送信を実行（修正前のコードで成功することを確認）
3. **キャンセル案内Email送信テスト**: Email送信で「キャンセル案内」テンプレートを送信（修正前のコードで成功することを確認）
4. **API呼び出し内容の確認**: DevToolsのネットワークタブで、`/api/sellers/:id`へのPUTリクエストのペイロードを確認

**Expected Counterexamples**:
- 「キャンセル案内」SMS送信後、「査定理由別３後Eメ担当」に赤色マークが表示される
- API呼び出しのペイロードに`valuationReasonEmailAssignee`フィールドが含まれている可能性
- `calcSendStatus`関数が「キャンセル案内」ラベルを誤って`valuationReasonEmailAssignee`にマッピングしている可能性

### Fix Checking

**Goal**: 修正後のコードで、「キャンセル案内」テンプレート選択時に`cancelNoticeAssignee`フィールドのみが更新されることを確認します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleConfirmSend_fixed(input)
  ASSERT cancelNoticeAssigneeIsUpdated(result)
  ASSERT NOT valuationReasonEmailAssigneeIsUpdated(result)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、「キャンセル案内」テンプレート以外を選択した場合、元のシステムと同じ動作を行うことを確認します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleConfirmSend_original(input) = handleConfirmSend_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは推奨されませんが、手動テストで以下のケースを確認します：
- SMS送信で「不通時Sメール」「査定Sメール」「除外前・長期客Sメール」「当社が電話したというリマインドメール」「訪問事前通知メール」を選択した場合
- Email送信で「キャンセル案内」「（査定理由別）～」「除外前、長期客（お客様いるメール）」「リマインド」「☆訪問前日通知メール」を送信した場合

**Test Plan**: 修正前のコードで各テンプレートの動作を確認し、修正後のコードで同じ動作を行うことを確認します。

**Test Cases**:
1. **不通時SメールSMS送信テスト**: 「不通時Sメール担当」のみに赤色マークが表示されることを確認
2. **査定理由別Email送信テスト**: 「査定理由別３後Eメ担当」のみに青色マークが表示されることを確認
3. **キャンセル案内Email送信テスト**: 「キャンセル案内担当」のみに青色マークが表示されることを確認
4. **他のSMSテンプレート送信テスト**: 対応する担当フィールドのみに赤色マークが表示されることを確認

### Unit Tests

- SMS送信で「キャンセル案内」テンプレートを選択した際、`SMS_TEMPLATE_ASSIGNEE_MAP['cancellation']`が`'cancelNoticeAssignee'`を返すことを確認
- `calcSendStatus`関数が「キャンセル案内」ラベルを`cancelNoticeAssignee`にマッピングすることを確認
- 担当フィールド自動セット処理が、`assigneeKey`の値に基づいて正しいフィールドのみを更新することを確認

### Property-Based Tests

Property-based testingは、このバグ修正には適用しません。理由は以下の通りです：
- バグの発生条件が特定のテンプレート選択時に限定されているため、ランダムな入力生成では効率的にテストできない
- 手動テストで十分にカバーできる範囲である

### Integration Tests

- 通話モードページでSMS送信機能を使用し、「キャンセル案内」テンプレートを選択して送信を実行
- 送信後、「メール送信確認」セクションの「キャンセル案内担当」のみに赤色マークが表示されることを確認
- 「査定理由別３後Eメ担当」にマークが表示されないことを確認
- 活動履歴に「【キャンセル案内】」が記録されることを確認
