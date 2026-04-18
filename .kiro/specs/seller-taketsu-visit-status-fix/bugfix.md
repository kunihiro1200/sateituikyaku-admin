# Bugfix Requirements Document

## Introduction

売主リストにおいて「他決→追客通知」ボタンを押した際、Google Chat通知の本文に表示される訪問状況のラベルが誤っている。
訪問済み（訪問に営業担当が入っている）の場合でも「未訪問他決」と表示されてしまい、正しくは「訪問後他決」と表示されるべきである。
AA13872のケースで確認されたバグ。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 訪問に営業担当が入っている（訪問済み）かつ状況（当社）に「他決」が含まれる売主に対して「他決→追客通知」ボタンを押す THEN システムはGoogle Chat通知の本文に「未訪問他決」と表示する

### Expected Behavior (Correct)

2.1 WHEN 訪問に営業担当が入っている（訪問済み）かつ状況（当社）に「他決」が含まれる売主に対して「他決→追客通知」ボタンを押す THEN システムはGoogle Chat通知の本文に「訪問後他決」と表示する SHALL

2.2 WHEN 訪問に営業担当が入っていない（未訪問）かつ状況（当社）に「他決」が含まれる売主に対して「他決→追客通知」ボタンを押す THEN システムはGoogle Chat通知の本文に「未訪問他決」と表示する SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「他決→追客通知」ボタンを押す THEN システムはGoogle Chat（https://chat.googleapis.com/v1/spaces/AAAA0Ey7RU8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=9jIN_bTulZibUDaPCPQmdsdkgbzfV5kCzH4dIx2IKb4）への通知送信自体は SHALL CONTINUE TO 正常に行う

3.2 WHEN 訪問に営業担当が入っていない（未訪問）の売主に対して「他決→追客通知」ボタンを押す THEN システムはGoogle Chat通知の本文に「未訪問他決」と SHALL CONTINUE TO 表示する

3.3 WHEN 「他決→追客通知」ボタンを押す THEN システムは売主番号・売主名・担当者などの他の通知本文の内容は SHALL CONTINUE TO 正しく表示する

---

## Bug Condition (バグ条件の定式化)

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerChatNotificationInput
  OUTPUT: boolean
  
  // 訪問済み（訪問担当者が設定されている）かつ他決の場合にバグが発生
  RETURN X.visitAssignee IS NOT NULL AND X.visitAssignee != "" 
         AND X.status CONTAINS "他決"
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - 訪問済み他決の表示ラベル修正
FOR ALL X WHERE isBugCondition(X) DO
  result ← sendTaketsuNotification'(X)
  ASSERT result.chatMessageBody CONTAINS "訪問後他決"
  ASSERT result.chatMessageBody NOT CONTAINS "未訪問他決"
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT sendTaketsuNotification(X) = sendTaketsuNotification'(X)
END FOR
```
