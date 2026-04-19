# バグ修正要件ドキュメント

## はじめに

物件リスト（業務リスト）の詳細画面において、ATBB状況を「非公開」に変更した場合、「買付」フィールドが必須項目となるため保存できない。しかし、保存ボタンを押した際に、なぜ保存できないのかを示すポップアップやエラーメッセージが一切表示されない。

このバグにより、ユーザーは保存が失敗した理由を把握できず、何を入力すれば保存できるのかが全くわからない状態になる。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN ATBB状況が「非公開」に設定された状態で保存ボタンが押された場合 THEN システムは保存を実行せず、何も表示しない（静かに失敗する）

1.2 WHEN ATBB状況が「非公開」かつ「買付」フィールドが未入力の状態で保存ボタンが押された場合 THEN システムはバリデーションエラーの理由をユーザーに伝えない

### 期待される動作（正しい動作）

2.1 WHEN ATBB状況が「非公開」に設定された状態で保存ボタンが押された場合 THEN システムは「買付フィールドが必須です」などの理由を示す警告ダイアログ（ポップアップ）を表示しなければならない（SHALL）

2.2 WHEN ATBB状況が「非公開」かつ「買付」フィールドが未入力の状態で保存ボタンが押された場合 THEN システムはユーザーが何を入力すべきかを明確に伝えるエラーメッセージを表示しなければならない（SHALL）

### 変更されない動作（リグレッション防止）

3.1 WHEN ATBB状況が「非公開」以外（例：「公開中」）の状態で保存ボタンが押された場合 THEN システムは引き続き通常通り保存処理を実行しなければならない（SHALL CONTINUE TO）

3.2 WHEN ATBB状況が「非公開」かつ「買付」フィールドが正しく入力された状態で保存ボタンが押された場合 THEN システムは引き続き正常に保存処理を実行しなければならない（SHALL CONTINUE TO）

3.3 WHEN 他のフィールドのバリデーションエラーが発生した場合 THEN システムは引き続き既存のバリデーション動作を維持しなければならない（SHALL CONTINUE TO）

---

## バグ条件の定義

**バグ条件関数**:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListSaveInput
  OUTPUT: boolean

  RETURN X.atbbStatus = "非公開" AND X.purchaseField = null (または未入力)
END FUNCTION
```

**修正チェックプロパティ**:

```pascal
// Property: Fix Checking - ATBB非公開時の保存バリデーション
FOR ALL X WHERE isBugCondition(X) DO
  result ← savePropertyListing'(X)
  ASSERT validationPopupDisplayed(result) = true
    AND errorMessage(result) CONTAINS "買付" (または必須フィールドの説明)
END FOR
```

**保全チェックプロパティ**:

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT savePropertyListing(X) = savePropertyListing'(X)
END FOR
```
