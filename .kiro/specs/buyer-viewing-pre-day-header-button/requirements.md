# 要件定義書

## はじめに

買主の内覧ページ（`BuyerViewingResultPage`）のヘッダーに「内覧日前日一覧」ボタンを追加する。このボタンは、その買主が内覧日前日の条件を満たす場合（`isViewingPreDay(buyer) === true`）のみ表示される。クリックすると買主リストページ（`/buyers`）に遷移し、`calculated_status === '内覧日前日'` の買主一覧がフィルタリングされた状態で表示される。

## 用語集

- **BuyerViewingResultPage**: 買主の内覧結果・後続対応ページ。`/buyers/:buyer_number/viewing-result` に対応
- **isViewingPreDay**: 内覧日前日かどうかを判定する既存関数（`BuyerViewingResultPage.tsx` 内に定義済み）
- **内覧日前日一覧ボタン**: 内覧ページのヘッダーに追加する新規ボタン。内覧日前日の買主の場合のみ表示される
- **BuyersPage**: 買主一覧ページ（`/buyers`）。`selectedCalculatedStatus` でフィルタリング状態を管理する
- **selectedCalculatedStatus**: `BuyersPage` が管理するステート。URLクエリパラメータ経由で初期値を受け取れるようにする

---

## 要件

### 要件1：内覧ページのヘッダーに「内覧日前日一覧」ボタンを追加する

**ユーザーストーリー：** 担当者として、内覧日前日の買主の内覧ページを開いているとき、ヘッダーに「内覧日前日一覧」ボタンを表示したい。そうすることで、同じ日に内覧がある他の買主一覧に素早くアクセスできる。

#### 受け入れ基準

1. THE System SHALL `isViewingPreDay(buyer) === true` の場合のみ、内覧ページ（`BuyerViewingResultPage`）のヘッダーに「内覧日前日一覧」ボタンを表示する
2. THE System SHALL `isViewingPreDay(buyer) === false` の場合、「内覧日前日一覧」ボタンを表示しない
3. THE System SHALL 「内覧日前日一覧」ボタンを、既存のヘッダー要素（戻るボタン、タイトル、買主名、買主番号チップ、メール/SMSボタン等）のレイアウトを崩さない形で追加する
4. THE System SHALL 「内覧日前日一覧」ボタンに緑系の色（`success` カラー）を適用する

---

### 要件2：「内覧日前日一覧」ボタンのクリックで内覧日前日買主一覧を表示する

**ユーザーストーリー：** 担当者として、「内覧日前日一覧」ボタンをクリックしたとき、買主リストページに遷移して内覧日前日の買主一覧が表示されてほしい。そうすることで、当日内覧対応が必要な全買主を一覧で確認できる。

#### 受け入れ基準

1. WHEN 「内覧日前日一覧」ボタンをクリックする場合、THE System SHALL `/buyers?status=内覧日前日` に遷移する
2. WHEN `/buyers?status=内覧日前日` にアクセスした場合、THE System SHALL `BuyersPage` が `selectedCalculatedStatus` を `'内覧日前日'` にセットし、該当買主のみを一覧表示する
3. THE System SHALL URLクエリパラメータ `status` の値が `BuyersPage` の `selectedCalculatedStatus` の初期値として使用される
