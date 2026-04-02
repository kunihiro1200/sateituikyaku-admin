# 買主テンプレート「内覧前伝達事項」挿入バグ修正設計

## Overview

買主リスト詳細画面でSMS送信・Gmail送信時に「資料請求～」テンプレートを選択した場合、「内覧前伝達事項」フィールドの内容がメッセージに挿入されない問題を修正します。

根本原因は、`BuyerDetailPage.tsx`が`SmsDropdownButton`および`BuyerGmailSendButton`に渡している`preViewingNotes`プロパティが、**買主テーブルの`buyer.pre_viewing_notes`**を参照しているが、正しくは**物件リストテーブルの`linkedProperties[0]?.pre_viewing_notes`**を参照する必要があることです。

この問題は何度か修正されているが、同じ失敗を繰り返しているため、ステアリングドキュメントを作成して再発を防止します。

## Glossary

- **Bug_Condition (C)**: 買主番号に紐づく物件が存在し、その物件に「内覧前伝達事項」が設定されている状態
- **Property (P)**: 「資料請求～」テンプレート選択時に、物件リストテーブルの「内覧前伝達事項」がSMS/Gmailメッセージに正しく挿入される動作
- **Preservation**: 「資料請求～」以外のテンプレート選択時、および「内覧前伝達事項」が空の場合の既存動作
- **BuyerDetailPage**: 買主リスト詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **SmsDropdownButton**: SMS送信ボタンコンポーネント（`frontend/frontend/src/components/SmsDropdownButton.tsx`）
- **BuyerGmailSendButton**: Gmail送信ボタンコンポーネント（`frontend/frontend/src/components/BuyerGmailSendButton.tsx`）
- **linkedProperties**: 買主番号に紐づく物件リストの配列（`PropertyListing[]`型）
- **pre_viewing_notes**: 物件リストテーブルの「内覧前伝達事項」カラム（`property_listings.pre_viewing_notes`）

## Bug Details

### Bug Condition

バグは、買主番号に紐づく物件が存在し、その物件に「内覧前伝達事項」が設定されている場合に発生します。`BuyerDetailPage.tsx`が誤ったデータソース（`buyer.pre_viewing_notes`）を参照しているため、正しい値（`linkedProperties[0]?.pre_viewing_notes`）が取得されません。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerDetailPageState
  OUTPUT: boolean
  
  RETURN input.linkedProperties.length > 0
         AND input.linkedProperties[0].pre_viewing_notes IS NOT NULL
         AND input.linkedProperties[0].pre_viewing_notes != ''
         AND (input.selectedTemplate IN ['land_no_permission', 'land_need_permission', 'house_mansion', 
                                          '資料請求メール（土）許可不要', '資料請求メール（土）売主へ要許可', '資料請求メール（戸、マ）'])
END FUNCTION
```

### Examples

- **例1（SMS送信）**: 買主番号BB14に紐づく物件AA9926の「内覧前伝達事項」が「駐車場は敷地内に2台分あります」と設定されている場合、「資料請求（土）許可不要」テンプレートを選択してSMS送信すると、メッセージに「駐車場は敷地内に2台分あります」が挿入されるべきだが、現在は挿入されない
- **例2（Gmail送信）**: 買主番号BB15に紐づく物件AA9927の「内覧前伝達事項」が「鍵は管理会社に預けています」と設定されている場合、「資料請求メール（戸、マ）」テンプレートを選択してGmail送信すると、メール本文に「鍵は管理会社に預けています」が挿入されるべきだが、現在は挿入されない
- **例3（空の場合）**: 買主番号BB16に紐づく物件AA9928の「内覧前伝達事項」が空の場合、「資料請求（土）売主要許可」テンプレートを選択してSMS送信すると、メッセージに余分な改行が挿入されない（既存の動作を維持）
- **エッジケース（複数物件）**: 買主番号BB17に複数の物件（AA9929、AA9930）が紐づいている場合、最初の物件（`linkedProperties[0]`）の「内覧前伝達事項」が使用される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「資料請求～」以外のテンプレート（「買付あり内覧NG」「買付あり内覧OK」「前回問合せ後反応なし」等）を選択した場合、既存の動作が維持される
- SMS送信履歴の記録処理が既存の動作を維持する
- Gmail送信履歴の記録処理が既存の動作を維持する

**Scope:**
「資料請求～」テンプレート以外のテンプレート選択、および「内覧前伝達事項」が空の場合は、この修正の影響を受けません。これには以下が含まれます：
- 「買付あり内覧NG」「買付あり内覧OK」テンプレート
- 「前回問合せ後反応なし」「反応なし（買付あり不適合）」テンプレート
- 「物件指定なし（Pinrich）」「民泊問合せ」テンプレート

## Hypothesized Root Cause

要件定義ドキュメントの分析に基づき、最も可能性が高い原因は以下の通りです：

1. **データソースの混同**: `BuyerDetailPage.tsx`が`buyer.pre_viewing_notes`（買主テーブル）を参照しているが、正しくは`linkedProperties[0]?.pre_viewing_notes`（物件リストテーブル）を参照する必要がある
   - 買主テーブルと物件リストテーブルの両方に`pre_viewing_notes`カラムが存在するため、混同が発生した
   - 実際のデータは物件リストテーブルに格納されている

2. **ドキュメント不足**: 「内覧前伝達事項」がどのテーブルから取得されるべきかが明確に文書化されていなかった
   - 過去に同じ問題が繰り返されている
   - ステアリングドキュメントが存在しなかった

3. **テスト不足**: 実際のデータを使用したE2Eテストが不足していたため、バグが検出されなかった
   - 単体テストは存在するが、実際のデータフローをテストしていない

4. **コンポーネント間の依存関係**: `SmsDropdownButton`と`BuyerGmailSendButton`は正しく実装されているが、`BuyerDetailPage.tsx`が誤ったプロパティを渡している
   - コンポーネント自体は正しく動作する
   - 問題は親コンポーネント（`BuyerDetailPage.tsx`）のデータ取得ロジックにある

## Correctness Properties

Property 1: Bug Condition - 「内覧前伝達事項」が正しく挿入される

_For any_ 買主詳細画面の状態において、買主番号に紐づく物件が存在し、その物件に「内覧前伝達事項」が設定されており、「資料請求～」テンプレートが選択された場合、修正後の`BuyerDetailPage.tsx`は物件リストテーブルの「内覧前伝達事項」（`linkedProperties[0]?.pre_viewing_notes`）を`SmsDropdownButton`および`BuyerGmailSendButton`に渡し、SMS/Gmailメッセージに正しく挿入される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存動作の維持

_For any_ 買主詳細画面の状態において、「資料請求～」以外のテンプレートが選択された場合、または「内覧前伝達事項」が空の場合、修正後のコードは既存の動作を維持し、SMS送信履歴・Gmail送信履歴の記録処理、および余分な改行の挿入防止が正しく動作する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Function**: `BuyerDetailPage`コンポーネント

**Specific Changes**:
1. **`SmsDropdownButton`のpropsを修正**: `preViewingNotes`プロパティを`buyer.pre_viewing_notes`から`linkedProperties[0]?.pre_viewing_notes`に変更
   - 現在の実装: `preViewingNotes={buyer.pre_viewing_notes || ''}`
   - 修正後: `preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}`

2. **`BuyerGmailSendButton`のpropsを修正**: `preViewingNotes`プロパティを`buyer.pre_viewing_notes`から`linkedProperties[0]?.pre_viewing_notes`に変更
   - 現在の実装: `preViewingNotes={buyer.pre_viewing_notes || ''}`
   - 修正後: `preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}`

3. **コードコメントの追加**: 修正箇所に「物件リストテーブルから取得」というコメントを追加
   - 将来の開発者が同じ間違いを繰り返さないようにする

4. **ステアリングドキュメントの作成**: `.kiro/steering/buyer-pre-viewing-notes-data-source.md`を作成
   - 「内覧前伝達事項」のデータソースを明確に文書化
   - 買主テーブルと物件リストテーブルの違いを説明

5. **E2Eテストの追加**: 実際のデータを使用して「内覧前伝達事項」が正しく挿入されることを確認するテストを追加
   - 買主番号に紐づく物件の「内覧前伝達事項」が設定されている場合のテスト
   - 「内覧前伝達事項」が空の場合のテスト

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現し、次に修正後のコードで正しく動作することを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は、再度仮説を立てる必要がある。

**Test Plan**: 買主番号に紐づく物件の「内覧前伝達事項」が設定されている状態で、「資料請求～」テンプレートを選択してSMS/Gmail送信を実行し、メッセージに「内覧前伝達事項」が挿入されないことを確認する。修正前のコードで実行する。

**Test Cases**:
1. **SMS送信テスト（土地・許可不要）**: 買主番号BB14、物件AA9926の「内覧前伝達事項」が「駐車場は敷地内に2台分あります」と設定されている状態で、「資料請求（土）許可不要」テンプレートを選択してSMS送信を実行（修正前のコードで失敗する）
2. **Gmail送信テスト（戸建て・マンション）**: 買主番号BB15、物件AA9927の「内覧前伝達事項」が「鍵は管理会社に預けています」と設定されている状態で、「資料請求メール（戸、マ）」テンプレートを選択してGmail送信を実行（修正前のコードで失敗する）
3. **空の場合のテスト**: 買主番号BB16、物件AA9928の「内覧前伝達事項」が空の状態で、「資料請求（土）売主要許可」テンプレートを選択してSMS送信を実行（修正前のコードでも正しく動作する）
4. **複数物件のテスト**: 買主番号BB17に複数の物件（AA9929、AA9930）が紐づいている状態で、「資料請求メール（土）許可不要」テンプレートを選択してGmail送信を実行（修正前のコードで失敗する）

**Expected Counterexamples**:
- SMS/Gmailメッセージに「内覧前伝達事項」が挿入されない
- 可能性のある原因: `buyer.pre_viewing_notes`が空、`linkedProperties[0]?.pre_viewing_notes`が正しく取得されていない、プロパティの渡し方が間違っている

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := BuyerDetailPage_fixed(input)
  ASSERT result.smsMessage CONTAINS input.linkedProperties[0].pre_viewing_notes
  ASSERT result.gmailMessage CONTAINS input.linkedProperties[0].pre_viewing_notes
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT BuyerDetailPage_original(input) = BuyerDetailPage_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動の単体テストでは見逃す可能性のあるエッジケースを検出する
- 非バグ入力に対して動作が変更されていないという強力な保証を提供する

**Test Plan**: まず、修正前のコードで「資料請求～」以外のテンプレート選択時の動作を観察し、次にその動作を捕捉するproperty-based testを作成する。

**Test Cases**:
1. **「買付あり内覧NG」テンプレートの保存**: 修正前のコードで「買付あり内覧NG」テンプレートを選択した場合の動作を観察し、修正後も同じ動作が維持されることを確認
2. **SMS送信履歴の保存**: 修正前のコードでSMS送信履歴が正しく記録されることを観察し、修正後も同じ動作が維持されることを確認
3. **Gmail送信履歴の保存**: 修正前のコードでGmail送信履歴が正しく記録されることを観察し、修正後も同じ動作が維持されることを確認
4. **余分な改行の挿入防止**: 修正前のコードで「内覧前伝達事項」が空の場合に余分な改行が挿入されないことを観察し、修正後も同じ動作が維持されることを確認

### Unit Tests

- `BuyerDetailPage.tsx`の`SmsDropdownButton`と`BuyerGmailSendButton`に渡される`preViewingNotes`プロパティが正しい値（`linkedProperties[0]?.pre_viewing_notes`）であることをテスト
- 「内覧前伝達事項」が空の場合、空文字列が渡されることをテスト
- 複数物件が紐づいている場合、最初の物件（`linkedProperties[0]`）の「内覧前伝達事項」が使用されることをテスト

### Property-Based Tests

- ランダムな買主データと物件データを生成し、「資料請求～」テンプレート選択時に「内覧前伝達事項」が正しく挿入されることを確認
- ランダムな買主データと物件データを生成し、「資料請求～」以外のテンプレート選択時に既存の動作が維持されることを確認
- 多くのシナリオで「内覧前伝達事項」が空の場合に余分な改行が挿入されないことをテスト

### Integration Tests

- 買主詳細画面で「資料請求～」テンプレートを選択してSMS送信を実行し、メッセージに「内覧前伝達事項」が正しく挿入されることを確認
- 買主詳細画面で「資料請求～」テンプレートを選択してGmail送信を実行し、メール本文に「内覧前伝達事項」が正しく挿入されることを確認
- 買主詳細画面で「資料請求～」以外のテンプレートを選択してSMS/Gmail送信を実行し、既存の動作が維持されることを確認
