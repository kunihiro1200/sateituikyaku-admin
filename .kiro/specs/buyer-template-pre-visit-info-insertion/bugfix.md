# Bugfix Requirements Document

## Introduction

買主リスト詳細画面でSMS送信・Gmail送信時に「資料請求～」テンプレートを選択した場合、「内覧前伝達事項」フィールドの内容がメッセージに挿入されない問題を修正する。

この問題は何度か修正されているが、同じ失敗を繰り返しているため、根本原因を特定して再発を防止する必要がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リスト詳細画面でSMS送信をクリックし、「資料請求（土）許可不要」「資料請求（土）売主要許可」「資料請求（戸・マ）」のいずれかのテンプレートを選択した場合 THEN 「内覧前伝達事項」フィールドの内容がSMSメッセージに挿入されない

1.2 WHEN 買主リスト詳細画面でGmail送信をクリックし、「資料請求メール（土）許可不要」「資料請求メール（土）売主へ要許可」「資料請求メール（戸、マ）」のいずれかのテンプレートを選択した場合 THEN 「内覧前伝達事項」フィールドの内容がメール本文に挿入されない

1.3 WHEN 買主番号に紐づく物件番号の「内覧前伝達事項」が物件リストテーブル（`property_listings.pre_viewing_notes`）に存在する場合 THEN その値が取得されず、SMS/Gmailメッセージに挿入されない

### Expected Behavior (Correct)

2.1 WHEN 買主リスト詳細画面でSMS送信をクリックし、「資料請求（土）許可不要」「資料請求（土）売主要許可」「資料請求（戸・マ）」のいずれかのテンプレートを選択した場合 THEN 買主番号に紐づく物件番号の「内覧前伝達事項」（`property_listings.pre_viewing_notes`）がSMSメッセージに挿入される

2.2 WHEN 買主リスト詳細画面でGmail送信をクリックし、「資料請求メール（土）許可不要」「資料請求メール（土）売主へ要許可」「資料請求メール（戸、マ）」のいずれかのテンプレートを選択した場合 THEN 買主番号に紐づく物件番号の「内覧前伝達事項」（`property_listings.pre_viewing_notes`）がメール本文に挿入される

2.3 WHEN 買主番号に紐づく物件番号の「内覧前伝達事項」が物件リストテーブル（`property_listings.pre_viewing_notes`）に存在する場合 THEN その値が正しく取得され、SMS/Gmailメッセージに挿入される

2.4 WHEN 買主番号に紐づく物件番号の「内覧前伝達事項」が空または存在しない場合 THEN SMS/Gmailメッセージに空文字が挿入される（既存の動作を維持）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「資料請求～」以外のテンプレート（「買付あり内覧NG」「買付あり内覧OK」「前回問合せ後反応なし」等）を選択した場合 THEN 既存の動作が維持される

3.2 WHEN SMS送信履歴の記録処理が実行される場合 THEN 既存の動作が維持される

3.3 WHEN Gmail送信履歴の記録処理が実行される場合 THEN 既存の動作が維持される

3.4 WHEN 「内覧前伝達事項」が空の場合 THEN メッセージに余分な改行や空白が挿入されない

3.5 WHEN 買主番号に複数の物件が紐づいている場合 THEN 最初の物件（`linkedProperties[0]`）の「内覧前伝達事項」が使用される

## Root Cause Analysis

### 根本原因

`BuyerDetailPage.tsx`で`SmsDropdownButton`および`BuyerGmailSendButton`に渡している`preViewingNotes`プロパティが、**買主テーブルの`buyer.pre_viewing_notes`**を参照しているが、正しくは**物件リストテーブルの`linkedProperties[0]?.pre_viewing_notes`**を参照する必要がある。

### 現在の実装（誤り）

```typescript
<SmsDropdownButton
  // ...
  preViewingNotes={buyer.pre_viewing_notes || ''}
/>

<BuyerGmailSendButton
  // ...
  preViewingNotes={buyer.pre_viewing_notes || ''}
/>
```

### 正しい実装

```typescript
<SmsDropdownButton
  // ...
  preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}
/>

<BuyerGmailSendButton
  // ...
  preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}
/>
```

### なぜこの問題が繰り返されたか

1. **データソースの混同**: 買主テーブルと物件リストテーブルの両方に`pre_viewing_notes`カラムが存在するため、どちらを使用すべきか混同していた
2. **ドキュメント不足**: 「内覧前伝達事項」がどのテーブルから取得されるべきかが明確に文書化されていなかった
3. **テスト不足**: 実際のデータを使用したE2Eテストが不足していたため、バグが検出されなかった

### 再発防止策

1. **ステアリングドキュメントの作成**: 「内覧前伝達事項」のデータソースを明確に文書化する
2. **コードコメントの追加**: `BuyerDetailPage.tsx`に「物件リストテーブルから取得」というコメントを追加する
3. **E2Eテストの追加**: 実際のデータを使用して「内覧前伝達事項」が正しく挿入されることを確認するテストを追加する

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerDetailPageState
  OUTPUT: boolean
  
  // 買主番号に紐づく物件が存在し、その物件に「内覧前伝達事項」が設定されている場合
  RETURN X.linkedProperties.length > 0 AND 
         X.linkedProperties[0].pre_viewing_notes IS NOT NULL AND
         X.linkedProperties[0].pre_viewing_notes != ''
END FUNCTION
```

### Property Specification (Fix Checking)

```pascal
// Property: Fix Checking - 「内覧前伝達事項」が正しく挿入される
FOR ALL X WHERE isBugCondition(X) DO
  smsMessage ← generateSmsMessage'(X, 'land_no_permission')
  gmailMessage ← generateGmailMessage'(X, '資料請求メール（土）許可不要')
  
  ASSERT smsMessage CONTAINS X.linkedProperties[0].pre_viewing_notes
  ASSERT gmailMessage CONTAINS X.linkedProperties[0].pre_viewing_notes
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 既存の動作が維持される
FOR ALL X WHERE NOT isBugCondition(X) DO
  // 「内覧前伝達事項」が空の場合
  IF X.linkedProperties.length == 0 OR 
     X.linkedProperties[0].pre_viewing_notes IS NULL OR
     X.linkedProperties[0].pre_viewing_notes == '' THEN
    
    smsMessage ← generateSmsMessage'(X, 'land_no_permission')
    gmailMessage ← generateGmailMessage'(X, '資料請求メール（土）許可不要')
    
    // 余分な改行や空白が挿入されないこと
    ASSERT smsMessage DOES NOT CONTAIN '\n\n\n\n'
    ASSERT gmailMessage DOES NOT CONTAIN '\n\n\n\n'
  END IF
END FOR
```

## Affected Files

### Frontend

- `frontend/frontend/src/pages/BuyerDetailPage.tsx` - `SmsDropdownButton`と`BuyerGmailSendButton`に渡す`preViewingNotes`を修正
- `frontend/frontend/src/components/SmsDropdownButton.tsx` - 既に正しく実装されている（修正不要）
- `frontend/frontend/src/components/BuyerGmailSendButton.tsx` - 既に正しく実装されている（修正不要）

### Backend

- `backend/src/services/BuyerTemplateService.ts` - 既に正しく実装されている（修正不要）
- `backend/src/services/EmailTemplateService.ts` - 既に正しく実装されている（修正不要）

### Documentation

- `.kiro/steering/buyer-pre-viewing-notes-data-source.md` - 新規作成（ステアリングドキュメント）

## Testing Strategy

### Unit Tests

- `frontend/frontend/src/components/__tests__/SmsDropdownButton.bugfix.test.tsx` - 既存のテストが正しく動作することを確認
- `backend/src/services/__tests__/EmailTemplateService.bugfix.test.ts` - 既存のテストが正しく動作することを確認

### E2E Tests

- 買主番号に紐づく物件の「内覧前伝達事項」が設定されている場合、SMS/Gmailメッセージに正しく挿入されることを確認
- 買主番号に紐づく物件の「内覧前伝達事項」が空の場合、SMS/Gmailメッセージに余分な改行が挿入されないことを確認

## Success Criteria

1. ✅ 買主リスト詳細画面でSMS送信時に「資料請求～」テンプレートを選択した場合、物件リストテーブルの「内覧前伝達事項」がSMSメッセージに挿入される
2. ✅ 買主リスト詳細画面でGmail送信時に「資料請求～」テンプレートを選択した場合、物件リストテーブルの「内覧前伝達事項」がメール本文に挿入される
3. ✅ 「内覧前伝達事項」が空の場合、既存の動作が維持される
4. ✅ 既存のテストが全て通過する
5. ✅ ステアリングドキュメントが作成され、データソースが明確に文書化される
