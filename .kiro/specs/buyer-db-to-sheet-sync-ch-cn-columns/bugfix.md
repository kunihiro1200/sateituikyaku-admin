# Bugfix Requirements Document

## Introduction

買主リストに物件番号を登録した際、スプレッドシートのCH〜CN列（内覧前伝達事項・鍵等・売却理由・値下げ履歴・内覧の時の伝達事項・駐車場・内覧時駐車場）に物件番号に紐づく値が反映されないバグ。

DBには正しく値が保存されているが、DBからスプレッドシートへの即時同期処理において、CH〜CN列に対応するフィールドが `databaseToSpreadsheet` マッピングに存在しないため、スプレッドシートへの書き戻しが行われない。

**影響範囲**: 買主リストで物件番号を登録・更新した際のスプレッドシートCH〜CN列の即時同期

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCH列（内覧前伝達事項）に物件番号に紐づく値が反映されない

1.2 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCI列（鍵等）に物件番号に紐づく値が反映されない

1.3 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCJ列（売却理由）に物件番号に紐づく値が反映されない

1.4 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCK列（値下げ履歴）に物件番号に紐づく値が反映されない

1.5 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCL列（内覧の時の伝達事項）に物件番号に紐づく値が反映されない

1.6 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCM列（駐車場）に物件番号に紐づく値が反映されない

1.7 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCN列（内覧時駐車場）に物件番号に紐づく値が反映されない

### Expected Behavior (Correct)

2.1 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCH列（内覧前伝達事項）に `buyers.pre_viewing_notes` の値が SHALL 反映される

2.2 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCI列（鍵等）に `buyers.key_info` の値が SHALL 反映される

2.3 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCJ列（売却理由）に `buyers.sale_reason` の値が SHALL 反映される

2.4 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCK列（値下げ履歴）に `buyers.price_reduction_history` の値が SHALL 反映される

2.5 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCL列（内覧の時の伝達事項）に `buyers.viewing_notes` の値が SHALL 反映される

2.6 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCM列（駐車場）に `buyers.parking` の値が SHALL 反映される

2.7 WHEN 買主リストに物件番号を登録する THEN スプレッドシートのCN列（内覧時駐車場）に `buyers.viewing_parking` の値が SHALL 反映される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主リストの物件番号以外のフィールドを更新する THEN スプレッドシートの対応列に SHALL CONTINUE TO 正しく値が反映される

3.2 WHEN 買主リストに物件番号を登録する THEN スプレッドシートの既存同期フィールド（物件所在地・住居表示・価格・物件担当者）に SHALL CONTINUE TO 正しく値が反映される

3.3 WHEN 買主リストに物件番号が登録されていない THEN スプレッドシートのCH〜CN列は SHALL CONTINUE TO 変更されない（空白のまま）

3.4 WHEN 買主リストに物件番号を登録するが対応物件が存在しない THEN 処理は SHALL CONTINUE TO エラーなく完了し、CH〜CN列は空白のまま維持される

3.5 WHEN スプレッドシートから買主データをDBに同期する（全件同期） THEN CH〜CN列のスプシ→DB方向のマッピングは SHALL CONTINUE TO 正常に動作する

---

## Bug Condition (バグ条件の定式化)

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerUpdateInput
  OUTPUT: boolean

  // 買主更新データに property_number が含まれ、かつ非null・非空文字の場合にバグが発現
  RETURN X.property_number != null AND X.property_number != ''
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking - CH〜CN列の即時同期
FOR ALL X WHERE isBugCondition(X) DO
  result ← updateWithSync'(X)
  ASSERT spreadsheet[CH列] = buyers[X.id].pre_viewing_notes
  ASSERT spreadsheet[CI列] = buyers[X.id].key_info
  ASSERT spreadsheet[CJ列] = buyers[X.id].sale_reason
  ASSERT spreadsheet[CK列] = buyers[X.id].price_reduction_history
  ASSERT spreadsheet[CL列] = buyers[X.id].viewing_notes
  ASSERT spreadsheet[CM列] = buyers[X.id].parking
  ASSERT spreadsheet[CN列] = buyers[X.id].viewing_parking
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)  // 既存の同期動作が変わらない
END FOR
```

### 根本原因

`databaseToSpreadsheet` マッピング（即時同期用）に以下のフィールドが存在しない:

| DBカラム | スプレッドシート列名 | 列 |
|---|---|---|
| `pre_viewing_notes` | 内覧前伝達事項 | CH |
| `key_info` | 鍵等 | CI |
| `sale_reason` | 売却理由 | CJ |
| `price_reduction_history` | 値下げ履歴 | CK |
| `viewing_notes` | 内覧の時の伝達事項 | CL |
| `parking` | 駐車場 | CM |
| `viewing_parking` | 内覧時駐車場 | CN |

`spreadsheetToDatabaseExtended`（スプシ→DB方向）には既に存在しているが、DB→スプシ方向の即時同期処理で使用されるマッピングに欠落している。
