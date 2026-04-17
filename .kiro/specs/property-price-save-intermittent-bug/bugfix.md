# Bugfix Requirements Document

## Introduction

物件リスト詳細画面（`PropertyListingDetailPage`）の「価格情報」セクションにおいて、売買価格を変更して保存ボタンを押しても、間欠的に保存が行われないバグが存在する。

ユーザーは保存成功のフィードバックがないまま編集モードが終了するため、保存されたと誤認する可能性がある。このバグは特定の操作順序（他のセクションを先に編集した後に価格を変更するなど）で発生しやすい。

**根本原因の概要：**

`PropertyListingDetailPage` では全セクションが `editedData` という単一の共有 state を使用している。`handleSavePrice` 関数は `Object.keys(editedData).length === 0` の場合に早期リターン（例外なし）するが、`EditableSection` コンポーネントはこの早期リターンを「保存成功」と判断して `onEditToggle()` を呼び出し、編集モードを終了させる。その結果、価格フィールドが `editedData` に含まれていない状態で保存ボタンを押すと、何も保存されないまま編集モードが閉じられる。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 価格情報セクションを編集モードにして売買価格を変更せずに保存ボタンを押した場合（`editedData` が空の状態）THEN システムは API を呼び出さずに早期リターンするが、`EditableSection` は保存成功と判断して編集モードを終了する

1.2 WHEN 他のセクション（ヘッダー情報など）を先に編集して `editedData` に他フィールドが入っている状態で、価格情報セクションの売買価格を変更せずに保存ボタンを押した場合 THEN システムは `editedData` が空でないため API を呼び出すが、価格フィールドを含まないデータを送信する（価格は保存されない）

1.3 WHEN 価格情報セクションで売買価格を変更した後、保存ボタンを押す前に他のセクションの編集をキャンセルして `editedData` がリセットされた場合 THEN システムは `editedData` が空になったため API を呼び出さず、価格変更が保存されない

1.4 WHEN `handleSavePrice` が `editedData` 空チェックで早期リターンした場合 THEN システムは例外をスローしないため `EditableSection.handleSave` は成功とみなし `onEditToggle()` を呼び出して編集モードを終了する（保存失敗がユーザーに通知されない）

### Expected Behavior (Correct)

2.1 WHEN 価格情報セクションで売買価格を変更して保存ボタンを押した場合 THEN システムは SHALL 変更された価格を API に送信して保存し、成功メッセージを表示する

2.2 WHEN 価格情報セクションで何も変更せずに保存ボタンを押した場合 THEN システムは SHALL 保存をスキップするか、または変更なしである旨をユーザーに通知し、編集モードを適切に終了する

2.3 WHEN 他のセクションの `editedData` が存在する状態で価格情報セクションの保存ボタンを押した場合 THEN システムは SHALL 価格情報セクションに関連するフィールド（`price`、`price_reduction_history`、`price_reduction_scheduled_date`）のみを API に送信する

2.4 WHEN `handleSavePrice` が保存をスキップする場合 THEN システムは SHALL `EditableSection` に対して保存が行われなかったことを伝え、編集モードを維持するか適切に処理する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 価格情報セクションで売買価格を変更して保存ボタンを押した場合（正常ケース）THEN システムは SHALL CONTINUE TO 値下げ履歴を自動追記し、API に保存し、成功メッセージを表示する

3.2 WHEN 価格情報セクションでキャンセルボタンを押した場合 THEN システムは SHALL CONTINUE TO `editedData` をリセットして編集モードを終了する

3.3 WHEN 価格情報セクションで値下げ予約日を変更して保存した場合 THEN システムは SHALL CONTINUE TO `propertyPriceReductionUpdated` イベントを発火してサイドバーを更新する

3.4 WHEN 他のセクション（基本情報、物件詳細など）の保存処理 THEN システムは SHALL CONTINUE TO 正常に動作する（価格セクションの修正が他セクションに影響しない）

3.5 WHEN 価格情報セクションの Chat 送信ボタンを押した場合 THEN システムは SHALL CONTINUE TO Google Chat に値下げ通知を送信する

---

## Bug Condition

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SavePriceAction
    X.editedData: Record<string, any>  // 保存ボタン押下時の editedData の状態
    X.priceFieldPresent: boolean       // editedData に 'price' キーが含まれるか
  OUTPUT: boolean

  // editedData が空、または価格フィールドが含まれていない場合にバグが発生する
  RETURN X.editedData が空 OR NOT X.priceFieldPresent
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - 価格保存の確実性
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleSavePrice'(X)
  ASSERT (APIが呼び出されない場合、編集モードが維持されるか適切なフィードバックが表示される)
  AND (価格フィールドが editedData に含まれる場合のみ API が呼び出される)
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  // editedData に price フィールドが含まれる正常ケース
  ASSERT handleSavePrice(X) = handleSavePrice'(X)
  // 保存処理、値下げ履歴追記、成功メッセージ表示が従来通り動作する
END FOR
```
