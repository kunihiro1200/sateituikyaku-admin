# バグ修正要件ドキュメント

## はじめに

買主リストにおいて、DB→スプレッドシートへの即時同期時に価格フォーマットが壊れるバグを修正する。

具体的には、DBの `buyers.price` カラムには `23800000`（円単位）が保存されており、フロントエンドはこれを `2380万円` と表示する。しかし、DBで価格を変更してスプシに即時同期すると、`2380万円` という**文字列**がスプシのBR列「価格」に書き込まれてしまう。スプシには `23800000` という**数値**で書き込まれるべきである。

**影響範囲**: 買主番号7363を含む、価格フィールドを持つすべての買主レコード

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN DBの `buyers.price` フィールドを変更してDB→スプシ即時同期を実行する THEN システムは `2380万円` のような万円表示の文字列をスプシのBR列「価格」に書き込む

1.2 WHEN フロントエンドで価格フィールドを編集して保存する THEN システムは万円表示の文字列（例: `2380万円`）をそのままAPIに送信し、バックエンドがその文字列をスプシに書き込む

1.3 WHEN `BuyerColumnMapper.mapDatabaseToSpreadsheet` が `price` フィールドを処理する THEN システムは `databaseToSpreadsheet` マッピングに `price` → `価格` のエントリが存在しないため、`price` フィールドをスプシカラム名に変換できない

### 期待される動作（正しい動作）

2.1 WHEN DBの `buyers.price` フィールドを変更してDB→スプシ即時同期を実行する THEN システムは `23800000` のような円単位の数値をスプシのBR列「価格」に書き込むものとする

2.2 WHEN フロントエンドで価格フィールドを編集して保存する THEN システムは万円表示の文字列（例: `2380万円`）を円単位の数値（例: `23800000`）に変換してからAPIに送信するものとする（または、バックエンドが変換するものとする）

2.3 WHEN `BuyerColumnMapper.mapDatabaseToSpreadsheet` が `price` フィールドを処理する THEN システムは `price` → `価格` のマッピングを使用してスプシカラム名に正しく変換し、円単位の数値をそのまま書き込むものとする

### 変化しない動作（リグレッション防止）

3.1 WHEN 価格フィールド以外のフィールド（氏名・電話番号・内覧日など）を変更してDB→スプシ即時同期を実行する THEN システムは引き続き各フィールドを正しくスプシに書き込み続けるものとする

3.2 WHEN 価格が未設定（null または 0）の買主レコードをDB→スプシ即時同期する THEN システムは引き続き価格フィールドを空またはゼロとして正しく書き込み続けるものとする

3.3 WHEN フロントエンドで価格フィールドを表示する THEN システムは引き続き `23800000` を `2380万円` と正しく表示し続けるものとする（表示ロジックは変更しない）

3.4 WHEN スプシ→DBへの同期（GASによる全件同期）を実行する THEN システムは引き続き `23800000` という数値をDBの `price` カラムに正しく保存し続けるものとする

---

## バグ条件の定式化

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerPriceUpdate
  OUTPUT: boolean

  // priceフィールドが更新対象に含まれており、
  // かつその値が万円表示の文字列（例: "2380万円"）である場合にtrueを返す
  RETURN "price" IN X.updatedFields
         AND typeof(X.price) = "string"
         AND X.price MATCHES /^\d+万円?$/
END FUNCTION
```

### 修正確認プロパティ

```pascal
// プロパティ: 修正確認 - 価格の正しい数値書き込み
FOR ALL X WHERE isBugCondition(X) DO
  result ← syncToSpreadsheet'(X)
  ASSERT typeof(result.spreadsheetPriceValue) = "number"
         AND result.spreadsheetPriceValue = parseManToYen(X.price)
END FOR
```

### 保全確認プロパティ

```pascal
// プロパティ: 保全確認 - 価格以外のフィールドへの影響なし
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT syncToSpreadsheet(X) = syncToSpreadsheet'(X)
END FOR
```
