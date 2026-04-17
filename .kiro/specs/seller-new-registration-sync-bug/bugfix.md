# Bugfix Requirements Document

## Introduction

売主リストの新規登録画面（`NewSellerPage.tsx`）で売主を登録すると、一部のフィールドがスプレッドシートに同期されない問題。

`SellerService.supabase.ts` の `createSeller` メソッド内の `appendRow` 呼び出しで、次電日・訪問日・営業担当・確度・状況（当社）・コメント・査定情報・追客情報など多数のフィールドが含まれていないため、スプレッドシートの該当列が空欄になる。

**バグ条件（Bug Condition）**:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CreateSellerRequest
  OUTPUT: boolean

  // 次電日・訪問日・営業担当・確度・状況（当社）・コメント・査定情報など
  // appendRow に含まれないフィールドが1つ以上入力されている場合にバグが発生する
  RETURN X.nextCallDate IS NOT NULL
      OR X.visitDate IS NOT NULL
      OR X.visitAssignee IS NOT NULL
      OR X.confidence IS NOT NULL
      OR X.status IS NOT NULL
      OR X.comments IS NOT NULL
      OR X.valuationAmount1 IS NOT NULL
      OR X.valuationMethod IS NOT NULL
      OR X.contactMethod IS NOT NULL
      OR X.preferredContactTime IS NOT NULL
      OR X.assignedTo IS NOT NULL
END FUNCTION
```

**修正対象ファイル**: `backend/src/services/SellerService.supabase.ts`（`createSeller` メソッド内の `appendRow` 呼び出し）

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 新規登録画面で次電日を入力して売主を登録する THEN スプレッドシートの「次電日」列が空欄になる

1.2 WHEN 新規登録画面で訪問日を入力して売主を登録する THEN スプレッドシートの「訪問日」列が空欄になる

1.3 WHEN 新規登録画面で営担（visitAssignee）を選択して売主を登録する THEN スプレッドシートの「営担」列が空欄になる

1.4 WHEN 新規登録画面で確度を選択して売主を登録する THEN スプレッドシートの「確度」列が空欄になる

1.5 WHEN 新規登録画面で状況（当社）を選択して売主を登録する THEN スプレッドシートの「状況（当社）」列が空欄になる

1.6 WHEN 新規登録画面でコメントを入力して売主を登録する THEN スプレッドシートの「コメント」列が空欄になる

1.7 WHEN 新規登録画面で査定情報（査定額・査定方法・査定担当）を入力して売主を登録する THEN スプレッドシートの査定関連列が空欄になる

1.8 WHEN 新規登録画面で追客情報（連絡方法・連絡取りやすい時間帯）を入力して売主を登録する THEN スプレッドシートの追客情報関連列が空欄になる

1.9 WHEN 新規登録画面で担当社員（assignedTo）を入力して売主を登録する THEN スプレッドシートの「1番電話」列が空欄になる

1.10 WHEN 新規登録画面で訪問時間・訪問メモを入力して売主を登録する THEN スプレッドシートの「訪問時間」「訪問メモ」列が空欄になる

### Expected Behavior (Correct)

2.1 WHEN 新規登録画面で次電日を入力して売主を登録する THEN スプレッドシートの「次電日」列に入力した日付が即時同期される

2.2 WHEN 新規登録画面で訪問日を入力して売主を登録する THEN スプレッドシートの「訪問日 Y/M/D」列に入力した日付が即時同期される

2.3 WHEN 新規登録画面で営担（visitAssignee）を選択して売主を登録する THEN スプレッドシートの「営担」列に選択したイニシャルが即時同期される

2.4 WHEN 新規登録画面で確度を選択して売主を登録する THEN スプレッドシートの「確度」列に選択した値が即時同期される

2.5 WHEN 新規登録画面で状況（当社）を選択して売主を登録する THEN スプレッドシートの「状況（当社）」列に選択した値が即時同期される

2.6 WHEN 新規登録画面でコメントを入力して売主を登録する THEN スプレッドシートの「コメント」列に入力した内容が即時同期される

2.7 WHEN 新規登録画面で査定情報（査定額・査定方法・査定担当）を入力して売主を登録する THEN スプレッドシートの査定関連列に入力した値が即時同期される

2.8 WHEN 新規登録画面で追客情報（連絡方法・連絡取りやすい時間帯）を入力して売主を登録する THEN スプレッドシートの追客情報関連列に入力した値が即時同期される

2.9 WHEN 新規登録画面で担当社員（assignedTo）を入力して売主を登録する THEN スプレッドシートの「1番電話」列に入力した値が即時同期される

2.10 WHEN 新規登録画面で訪問時間・訪問メモを入力して売主を登録する THEN スプレッドシートの「訪問時間」「訪問メモ」列に入力した値が即時同期される

**Property: Fix Checking**
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← createSeller'(X)
  ASSERT スプレッドシートの該当列 = X の入力値
END FOR
```

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 新規登録画面で売主番号・名前・電話番号・メールアドレスを入力して売主を登録する THEN スプレッドシートの B〜F列（売主番号・名前・住所・電話番号・メール）は引き続き正しく同期される

3.2 WHEN 新規登録画面で物件所在地を入力して売主を登録する THEN スプレッドシートの「物件所在地」（R列）は引き続き正しく同期される

3.3 WHEN 新規登録画面で反響日付・サイトを入力して売主を登録する THEN スプレッドシートの「反響日付」「サイト」列は引き続き正しく同期される

3.4 WHEN 売主を新規登録する THEN データベース（Supabaseの`sellers`テーブル・`properties`テーブル）への保存は引き続き正しく行われる

3.5 WHEN 売主を新規登録する THEN 連番シートC2の更新は引き続き正しく行われる

3.6 WHEN 売主を新規登録する THEN 既存の売主詳細ページ・通話モードページでの表示は引き続き正しく動作する

**Property: Preservation Checking**
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
