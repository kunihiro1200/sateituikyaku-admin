# 要件定義書

## はじめに

買主（Buyer）が他社物件を希望している場合、物件番号が存在しないため `linkedProperties` が空になる。
現在の内覧ページ（`BuyerViewingResultPage`）では、内覧形態（viewing type）の表示を `linkedProperties` の `atbb_status` に依存しているため、他社物件の買主では内覧形態が一切表示されない。
内覧形態が表示されないとカレンダー送信ボタンが有効にならず、カレンダー送信ができない。

本機能では、物件番号がない（他社物件）場合でも「一般媒介ではないパターン」の内覧形態（`viewing_mobile` フィールドに対応する選択肢）を内覧ページに表示する。

## 用語集

- **BuyerViewingResultPage**: 内覧ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ
- **linkedProperties**: 買主に紐づいた物件リスト。`GET /api/buyers/:buyer_number/properties` で取得する
- **他社物件**: 自社管理外の物件。物件番号が存在しないため `linkedProperties` が空になる
- **atbb_status**: 物件の媒介種別ステータス。「専任」または「一般」を含む文字列
- **viewing_mobile**: 専任媒介・他社物件向けの内覧形態フィールド（DBカラム名）
- **viewing_type_general**: 一般媒介向けの内覧形態フィールド（DBカラム名）
- **一般媒介ではないパターン**: `viewing_mobile` フィールドに保存される内覧形態の選択肢群（専任物件・他社物件向け）
- **isCalendarEnabled**: カレンダー送信ボタンの有効/無効を制御する計算値。内覧日・時間・後続担当・内覧形態の4条件がすべて非空の場合に `true` になる
- **viewingTypeValue**: `isCalendarEnabled` の計算に使用する内覧形態の値。`atbb_status` に応じて `viewing_mobile` または `viewing_type_general` を参照する

---

## 要件

### 要件1：他社物件（物件番号なし）の場合に内覧形態を表示する

**ユーザーストーリー：** 担当者として、買主が他社物件を希望していて物件番号がない場合でも、内覧ページで内覧形態を選択したい。そうすることで、カレンダー送信ボタンを有効にしてカレンダー送信ができるようになる。

#### 受け入れ基準

1. WHEN 内覧ページ（`BuyerViewingResultPage`）が表示される WHEN 内覧日が入力されている WHEN `linkedProperties` が空（物件番号なし）の場合、THE System SHALL 「一般媒介ではないパターン」の内覧形態選択ボタン群を表示する
2. WHEN 内覧ページが表示される WHEN 内覧日が入力されている WHEN `linkedProperties` が空の場合、THE System SHALL `viewing_mobile` フィールドに対応する選択肢（`【内覧_専（自社物件）】`、`【内覧（他社物件）】`、`準不【内覧_専（立会）】`、`準不【内覧_専（立会不要）】`）を表示する
3. WHEN 内覧ページが表示される WHEN 内覧日が入力されていない場合、THE System SHALL 内覧形態選択ボタン群を表示しない（既存動作を維持する）
4. WHEN 内覧ページが表示される WHEN `linkedProperties` に専任物件が存在する場合、THE System SHALL 既存の専任物件向け内覧形態表示ロジックを維持する
5. WHEN 内覧ページが表示される WHEN `linkedProperties` に一般媒介物件が存在する場合、THE System SHALL 既存の一般媒介向け内覧形態表示ロジックを維持する

---

### 要件2：他社物件の内覧形態選択でカレンダー送信を可能にする

**ユーザーストーリー：** 担当者として、他社物件の買主の内覧形態を選択した後、カレンダー送信ボタンを押せるようにしたい。そうすることで、他社物件の内覧予定をカレンダーに登録できる。

#### 受け入れ基準

1. WHEN `linkedProperties` が空の場合、THE System SHALL `viewingTypeValue` の計算において `buyer.viewing_mobile` を参照する
2. WHEN `linkedProperties` が空 WHEN `buyer.viewing_mobile` が非空 WHEN 内覧日・時間・後続担当がすべて非空の場合、THE System SHALL カレンダー送信ボタン（`isCalendarEnabled`）を有効にする
3. WHEN `linkedProperties` が空 WHEN `buyer.viewing_mobile` が空の場合、THE System SHALL カレンダー送信ボタンを無効のままにする
4. WHEN `linkedProperties` が空の場合、THE System SHALL カレンダータイトル生成（`generateCalendarTitle`）において `buyer.viewing_mobile` を `viewingType` 引数として渡す

---

### 要件3：他社物件の内覧形態選択UIの動作

**ユーザーストーリー：** 担当者として、他社物件の内覧形態選択ボタンが専任物件と同じ操作感で動作してほしい。そうすることで、操作に迷わず内覧形態を設定できる。

#### 受け入れ基準

1. WHEN 内覧形態ボタンをクリックする WHEN 選択されていないボタンをクリックした場合、THE System SHALL `viewing_mobile` フィールドにその選択肢の値を保存する
2. WHEN 内覧形態ボタンをクリックする WHEN すでに選択されているボタンを再クリックした場合、THE System SHALL `viewing_mobile` フィールドを空文字列にクリアする
3. WHEN `viewing_mobile` に値が保存されている場合、THE System SHALL 対応するボタンを `contained`（塗りつぶし）スタイルで表示する
4. WHEN 内覧日が入力されているが内覧形態が未選択の場合、THE System SHALL 内覧形態選択エリアを赤枠・「*必須」ラベルで強調表示する
5. THE System SHALL 内覧形態の保存時にスプレッドシートへの同期（`sync: true`）を実行する
