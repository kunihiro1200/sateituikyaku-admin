# 要件定義書

## はじめに

物件リスト詳細画面（PropertyListingDetailPage）の買付情報セクションに関する、以下のバグ修正と機能追加をまとめて対応する。

1. **バグ修正**: 買付情報の全フィールドを空欄にして保存すると500エラーが発生する
2. **機能追加**: 買付フィールドに何か値を入力した場合、「買付日」「状況」「買付コメント」を必須項目にするバリデーション
3. **機能追加**: 買付日の入力欄をどこでもクリックしたらカレンダーが即時に開くようにする
4. **機能追加**: 買付情報を保存したら Google Chat に通知を送信する

## 用語集

- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **PropertyListingService**: 物件リストのCRUD処理を担うバックエンドサービス（`backend/src/services/PropertyListingService.ts`）
- **PropertyListings_Route**: 物件リストのAPIルート（`backend/src/routes/propertyListings.ts`）
- **offer_amount**: 買付金額フィールド（`property_listings`テーブルのカラム）。買付情報の主要フィールドであり、このフィールドへの入力が他の買付フィールドの必須バリデーションのトリガーとなる
- **offer_date**: 買付日フィールド（`property_listings`テーブルのカラム）
- **offer_status**: 買付の状況フィールド（`property_listings`テーブルのカラム）。空でない値が存在する場合、ヘッダーの買付ステータスバッジに表示される
- **offer_comment**: 買付コメントフィールド（`property_listings`テーブルのカラム）
- **PurchaseStatusBadge**: 物件詳細画面ヘッダーに表示される買付ステータスバッジ（「一般片手」等）。`offer_status` が空の場合は非表示になる
- **Google_Chat_Notifier**: Google Chat Webhook へ通知を送信する処理
- **Validator**: フロントエンドのバリデーション処理

---

## 要件

### 要件1: 買付情報全空欄保存時の500エラー修正

**ユーザーストーリー:** 担当者として、買付情報の全フィールドを空欄にして保存したとき、500エラーではなく正常に保存されるようにしたい。そうすることで、買付情報をクリアする操作が安全に行える。

#### 受け入れ基準

1. WHEN `offer_date`・`offer_status`・`offer_comment` がすべて空文字列または `null` の状態で PUT `/api/property-listings/:propertyNumber` が呼ばれた場合、THE PropertyListings_Route SHALL 500エラーを返さずに正常なレスポンス（200）を返す
2. WHEN 買付情報の更新データに空文字列が含まれる場合、THE PropertyListingService SHALL 空文字列を `null` に変換してからデータベースに保存する
3. IF データベースへの保存処理でエラーが発生した場合、THEN THE PropertyListings_Route SHALL 500エラーとエラーメッセージをレスポンスとして返す

---

### 要件2: 買付フィールド入力時の必須バリデーション

**ユーザーストーリー:** 担当者として、買付金額（`offer_amount`）に値を入力した場合、「買付日」「状況」「買付コメント」の3項目すべての入力を求めるバリデーションを表示してほしい。そうすることで、不完全な買付情報が保存されるのを防げる。また、買付情報を全て空欄にして保存した場合は、ヘッダーの買付ステータスバッジが消えてほしい。

#### 受け入れ基準

1. WHEN `offer_amount`（買付金額）に値が入力されている状態で保存ボタンが押された場合、THE Validator SHALL `offer_date`・`offer_status`・`offer_comment` の未入力フィールドに対してエラーメッセージを表示する
2. WHEN `offer_amount` が空欄の場合、THE Validator SHALL `offer_date`・`offer_status`・`offer_comment` のバリデーションエラーを表示せずに保存処理を実行する
3. WHEN バリデーションエラーが表示されている場合、THE PropertyListingDetailPage SHALL 保存APIの呼び出しを行わない
4. WHEN バリデーションエラーが表示されている場合、THE PropertyListingDetailPage SHALL 各エラーフィールドの下に「必須項目です」というエラーメッセージを表示する
5. WHEN ユーザーがエラーフィールドに値を入力した場合、THE Validator SHALL そのフィールドのエラーメッセージを即時に消去する
6. WHEN `offer_amount`・`offer_date`・`offer_status`・`offer_comment` がすべて空欄の状態で保存が成功した場合、THE PropertyListingDetailPage SHALL ヘッダーの PurchaseStatusBadge（「一般片手」等の買付ステータス表示）を消去する

---

### 要件3: 買付日カレンダーのクリック領域拡大

**ユーザーストーリー:** 担当者として、買付日の入力欄のどこをクリックしてもカレンダーが開くようにしてほしい。そうすることで、カレンダーアイコンを正確に押す手間がなくなり、入力がスムーズになる。

#### 受け入れ基準

1. WHEN 買付日の入力フィールド（テキスト部分を含む全領域）がクリックされた場合、THE PropertyListingDetailPage SHALL カレンダーピッカーを即時に開く
2. THE PropertyListingDetailPage SHALL 買付日の入力フィールドに対して `type="date"` の `<input>` 要素を使用し、フィールド全体をクリック可能にする
3. WHILE 買付日の編集モードが有効な場合、THE PropertyListingDetailPage SHALL 買付日フィールドのカーソルをポインター（`pointer`）として表示する

---

### 要件4: 買付情報保存時のGoogle Chat通知

**ユーザーストーリー:** 担当者として、買付情報を保存したときに Google Chat に通知が届くようにしてほしい。そうすることで、チームメンバーが買付情報の更新をリアルタイムで把握できる。

#### 受け入れ基準

1. WHEN 買付情報の保存が成功した場合、THE Google_Chat_Notifier SHALL Webhook URL `https://chat.googleapis.com/v1/spaces/AAAA6iEDkiU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=azlyf21pENCpLLUdJPjnRNXOzsIAP550xebOMVxYRMQ` に対して POST リクエストを送信する
2. WHEN Google Chat への通知を送信する場合、THE Google_Chat_Notifier SHALL 物件番号・買付日・状況・買付コメントを含むメッセージを送信する
3. IF Google Chat への通知送信が失敗した場合、THEN THE Google_Chat_Notifier SHALL エラーをサーバーログに記録し、買付情報の保存結果には影響を与えない（通知失敗は保存成功とは独立して扱う）
4. WHEN 買付情報の保存が成功した場合、THE PropertyListings_Route SHALL 買付情報の保存完了後に非同期で Google Chat 通知を送信する
