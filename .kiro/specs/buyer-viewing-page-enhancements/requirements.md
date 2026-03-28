# 要件定義書

## はじめに

買主リストの内覧ページ（`BuyerViewingResultPage`）と買主一覧ページ（`BuyersPage`）に対して、以下の2つの機能を追加する。

1. **内覧ページのヘッダーに問合せ物件の所在地を表示する**
2. **買主一覧でサイドバーカテゴリーが「内覧日前日」の場合、案件クリック時に内覧ページを開く**

## 用語集

- **BuyerViewingResultPage**: 内覧ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ
- **BuyersPage**: 買主一覧ページ。`/buyers` に対応するフロントエンドページ
- **BuyerStatusSidebar**: 買主一覧ページの左サイドバーコンポーネント。`calculated_status` に基づくカテゴリーを表示する
- **calculated_status**: バックエンドの `BuyerStatusCalculator` が計算する買主のステータス文字列
- **内覧日前日**: `calculated_status` の値の一つ。内覧日の前日（木曜内覧の場合は2日前）に該当する買主に付与される
- **linkedProperties**: 買主に紐づいた物件リスト。`GET /api/buyers/:buyer_number/properties` で取得する
- **property_address**: 物件の所在地。`linkedProperties` の各物件オブジェクトに含まれる `address` フィールド
- **handleRowClick**: 買主一覧ページでテーブル行またはカードをクリックした際に呼び出されるハンドラー関数

---

## 要件

### 要件1：内覧ページのヘッダーに問合せ物件の所在地を表示する

**ユーザーストーリー：** 担当者として、内覧ページを開いたときにどの物件の内覧かをヘッダーで即座に確認したい。そうすることで、物件情報を別途確認する手間を省ける。

#### 受け入れ基準

1. WHEN 内覧ページ（`BuyerViewingResultPage`）が表示される WHEN 買主に紐づいた物件が1件以上存在する場合、THE System SHALL ヘッダーエリアに最初の紐づき物件の所在地（`address`）を表示する
2. WHEN 内覧ページが表示される WHEN 買主に紐づいた物件が存在しない場合、THE System SHALL 物件所在地の表示エリアを表示しない
3. WHEN 内覧ページが表示される WHEN 紐づき物件の `address` が空欄の場合、THE System SHALL 物件所在地の表示エリアを表示しない
4. THE System SHALL 物件所在地をヘッダーの買主名・買主番号と同じ行に表示する
5. THE System SHALL 物件所在地の表示を、既存のヘッダー要素（戻るボタン、タイトル、買主名、買主番号チップ、前日メールボタン）のレイアウトを崩さない形で追加する

---

### 要件2：「内覧日前日」カテゴリーの案件クリック時に内覧ページを開く

**ユーザーストーリー：** 担当者として、買主一覧でサイドバーの「内覧日前日」カテゴリーを選択中に案件をクリックしたとき、直接内覧ページに遷移したい。そうすることで、買主詳細ページを経由せずに内覧対応を素早く開始できる。

#### 受け入れ基準

1. WHEN 買主一覧ページ（`BuyersPage`）でサイドバーカテゴリーとして「内覧日前日」が選択されている WHEN テーブル行またはカードをクリックする場合、THE System SHALL `/buyers/:buyer_number/viewing` に遷移する
2. WHEN 買主一覧ページでサイドバーカテゴリーとして「内覧日前日」以外が選択されている WHEN テーブル行またはカードをクリックする場合、THE System SHALL 従来通り `/buyers/:buyer_number` に遷移する
3. WHEN 買主一覧ページでサイドバーカテゴリーが未選択（All）の状態 WHEN テーブル行またはカードをクリックする場合、THE System SHALL 従来通り `/buyers/:buyer_number` に遷移する
4. THE System SHALL モバイル表示（カードリスト）とデスクトップ表示（テーブル）の両方で同じナビゲーションロジックを適用する
