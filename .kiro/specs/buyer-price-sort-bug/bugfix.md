# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（`/sellers/:id/call`）にある「近隣買主」セクションで、価格（`inquiry_price`）の昇順・降順ソートボタンをクリックすると、途中から数値として正しくない順序になるバグ。

例：4980万円の次に580万円が来るなど、辞書順（文字列比較）でソートされてしまう。

**根本原因の仮説**：`NearbyBuyersList.tsx` の `sortedBuyers` useMemo 内のソートロジックは、`typeof aValue === 'number'` が `true` の場合のみ数値比較を行う。しかし、バックエンドの `BuyerService.getBuyersByAreas()` が返す `inquiry_price`（`buyer.price` フィールド）が文字列型として来た場合、`typeof` チェックが `false` になり、`localeCompare` による辞書順比較にフォールバックする。辞書順では `"49800000"` < `"5800000"` となるため（先頭文字 `"4"` < `"5"`）、数値的に正しくない順序になる。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 近隣買主セクションで価格の昇順ソートボタンをクリックし、`inquiry_price` の値が文字列型として返ってくる THEN システムは辞書順（文字列比較）でソートし、数値的に正しくない順序（例：4980万円の次に580万円）で表示する

1.2 WHEN 近隣買主セクションで価格の降順ソートボタンをクリックし、`inquiry_price` の値が文字列型として返ってくる THEN システムは辞書順（文字列比較）でソートし、数値的に正しくない順序で表示する

1.3 WHEN `inquiry_price` の値が数値型と文字列型の混在で返ってくる THEN システムは一部の比較で型不一致が発生し、ソート結果が不安定になる

### Expected Behavior (Correct)

2.1 WHEN 近隣買主セクションで価格の昇順ソートボタンをクリックする THEN システムは `inquiry_price` を数値として比較し、低い価格から高い価格の順（例：580万円 → 4980万円）で正しく表示する

2.2 WHEN 近隣買主セクションで価格の降順ソートボタンをクリックする THEN システムは `inquiry_price` を数値として比較し、高い価格から低い価格の順（例：4980万円 → 580万円）で正しく表示する

2.3 WHEN `inquiry_price` が文字列型として返ってきた場合でも THEN システムは `Number()` または `parseFloat()` で数値に変換してから比較し、正しい数値順でソートする

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `inquiry_price` が `null` または `undefined` の買主が存在する THEN システムは引き続き null/undefined の買主をリストの末尾に配置する

3.2 WHEN 価格以外のカラム（買主番号、名前、最新状況、内覧日）でソートする THEN システムは引き続き既存のソートロジックで正しく動作する

3.3 WHEN 価格ソートを適用していない初期状態 THEN システムは引き続きバックエンドから返ってきた順序（受付日降順・確度順）でリストを表示する

3.4 WHEN 近隣買主リストのメール送信・SMS送信・PDF印刷機能を使用する THEN システムは引き続き正常に動作する

---

## Bug Condition (Pseudocode)

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type NearbyBuyer
  OUTPUT: boolean

  // inquiry_price が文字列型として返ってきた場合にバグが発生する
  RETURN typeof X.inquiry_price = 'string' AND X.inquiry_price IS NOT NULL
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - 価格の数値ソート
FOR ALL pair (A, B) WHERE isBugCondition(A) OR isBugCondition(B) DO
  sortedList ← sortByInquiryPrice'([A, B], 'asc')
  numericA ← Number(A.inquiry_price)
  numericB ← Number(B.inquiry_price)
  ASSERT sortedList[0] = (numericA <= numericB ? A : B)
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  // inquiry_price が数値型の場合、既存の動作と同じ結果になる
  ASSERT sortByInquiryPrice(X) = sortByInquiryPrice'(X)
END FOR
```
