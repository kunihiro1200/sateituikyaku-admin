# 要件ドキュメント

## はじめに

買主リストの内覧カレンダー送信機能において、カレンダーイベントのタイトル形式を変更する機能です。

現在の実装（`BuyerViewingResultPage.tsx`）では、タイトルが以下の形式で生成されています：

```
{viewing_type} {物件住所} {買主氏名}
```

この機能では、タイトル形式を以下のルールに従って変更します：
- 内覧形態フィールドの値をそのままタイトルの先頭に使用する（`viewing_type` または `viewing_type_general`）
- `viewing_type` に値がある場合はそちらを優先し、空の場合は `viewing_type_general` を使用する
- 「立会」という文字を含む場合（ただし「立会不要」は除く）は末尾に（買主氏名）を追加する

## 用語集

- **CalendarTitleGenerator**: カレンダーイベントタイトルを生成するロジック
- **viewing_type**: 専任物件用の内覧形態フィールド。選択肢：`【内覧_専（自社物件）】`、`【内覧（他社物件）】`、`準不【内覧_専（立会）】`、`準不【内覧_専（立会不要）】`
- **viewing_type_general**: 一般媒介物件用の内覧形態フィールド。選択肢：`【内覧_一般（自社物件）】`、`準不【内覧_一般（立会）】`、`準不【内覧_一般（立会不要）】`
- **property_address**: 物件所在地フィールド（例：「大分市中央町1-1-1」）
- **name**: 買主氏名フィールド（例：「山田太郎」）
- **BuyerViewingResultPage**: 買主内覧結果ページ（カレンダー送信機能を含む）
- **calendarConfirmDialog**: カレンダー登録確認ダイアログの状態

## 要件

### 要件 1: カレンダーイベントタイトルの基本形式

**ユーザーストーリー:** 担当者として、内覧カレンダーを送信する際に、内覧形態・物件所在地が一目でわかるタイトルを生成したい。そうすることで、カレンダー上で内覧の詳細を素早く把握できる。

#### 受け入れ基準

1. WHEN 内覧カレンダーのタイトルを生成するとき、THE CalendarTitleGenerator SHALL `{viewing_type または viewing_type_general の値} {property_address}` の形式でタイトルを生成する
2. WHEN viewing_type に値がある場合、THE CalendarTitleGenerator SHALL viewing_type を使用する
3. WHEN viewing_type が空で viewing_type_general に値がある場合、THE CalendarTitleGenerator SHALL viewing_type_general を使用する
4. WHEN viewing_type と viewing_type_general の両方が空の場合、THE CalendarTitleGenerator SHALL property_address のみをタイトルとして生成する
5. THE CalendarTitleGenerator SHALL viewing_type または viewing_type_general フィールドの値をそのままタイトルの先頭に使用する（例：`【内覧_専（自社物件）】大分市中央町1-1-1`、`準不【内覧_一般（立会不要）】別府市光町8-7（海月不動産）`）

### 要件 2: 「立会」を含む場合の買主氏名追加

**ユーザーストーリー:** 担当者として、立会内覧のカレンダーイベントに買主氏名を含めたい。そうすることで、誰の立会内覧かをカレンダー上で即座に識別できる。

#### 受け入れ基準

1. WHEN 使用する内覧形態の値に「立会」という文字列が含まれ、かつ「立会不要」という文字列が含まれない場合、THE CalendarTitleGenerator SHALL タイトルの末尾に `（{name}）` を追加する
2. WHEN 使用する内覧形態の値に「立会不要」という文字列が含まれる場合、THE CalendarTitleGenerator SHALL 買主氏名を追加しない（「立会不要」は「立会」を含むが立会ではないため）
3. WHEN 使用する内覧形態の値に「立会」が含まれ（「立会不要」を除く）、かつ name が空欄の場合、THE CalendarTitleGenerator SHALL 買主氏名部分を省略して `（）` を付けない
4. WHEN 使用する内覧形態の値に「立会」が含まれない場合、THE CalendarTitleGenerator SHALL タイトルに買主氏名を追加しない

### 要件 3: タイトル形式の具体例

**ユーザーストーリー:** 担当者として、生成されるタイトルが期待通りの形式であることを確認したい。

#### 受け入れ基準

1. WHEN viewing_type が `【内覧_専（自社物件）】`、property_address が「大分市中央町1-1-1」の場合、THE CalendarTitleGenerator SHALL `【内覧_専（自社物件）】大分市中央町1-1-1` を生成する
2. WHEN viewing_type_general が `準不【内覧_一般（立会不要）】`、property_address が「別府市光町8-7（海月不動産）」の場合、THE CalendarTitleGenerator SHALL `準不【内覧_一般（立会不要）】別府市光町8-7（海月不動産）` を生成する（「立会不要」のため買主氏名なし）
3. WHEN viewing_type が `準不【内覧_専（立会）】`、property_address が「大分市中央町1-1-1」、name が「山田太郎」の場合、THE CalendarTitleGenerator SHALL `準不【内覧_専（立会）】大分市中央町1-1-1（山田太郎）` を生成する
4. WHEN viewing_type_general が `準不【内覧_一般（立会）】`、property_address が「別府市光町8-7」、name が「田中花子」の場合、THE CalendarTitleGenerator SHALL `準不【内覧_一般（立会）】別府市光町8-7（田中花子）` を生成する

### 要件 5: カレンダー説明欄への買主詳細URL追加

**ユーザーストーリー:** 担当者として、カレンダーイベントの説明欄に買主詳細画面のURLを含めたい。そうすることで、カレンダーから直接買主詳細画面にアクセスできる。

#### 受け入れ基準

1. WHEN カレンダーイベントの説明欄を生成するとき、THE BuyerViewingResultPage SHALL 説明欄の末尾に `買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/{buyer_number}` の形式でURLを追加する
2. THE BuyerViewingResultPage SHALL 買主詳細URLのベースURLとして `https://sateituikyaku-admin-frontend.vercel.app` を使用する
3. THE BuyerViewingResultPage SHALL 買主詳細URLのパスとして `/buyers/{buyer_number}` の形式を使用する（`{buyer_number}` は実際の買主番号に置換）
4. WHEN 説明欄を生成するとき、THE BuyerViewingResultPage SHALL 以下の形式で説明欄を構成する：
   ```
   物件住所: {property_address}
   GoogleMap: {google_map_url}

   お客様名: {name}
   電話番号: {phone_number}
   問合時ヒアリング: {inquiry_hearing}
   買主詳細: https://sateituikyaku-admin-frontend.vercel.app/buyers/{buyer_number}
   ```
5. WHEN handleCalendarButtonClick 関数内で description を生成するとき、THE BuyerViewingResultPage SHALL 買主詳細URLを含めた説明欄を生成する
6. WHEN calendarConfirmDialog の description 初期値を設定するとき、THE BuyerViewingResultPage SHALL 買主詳細URLを含めた説明欄を初期値として設定する

### 要件 4: BuyerViewingResultPage への適用

**ユーザーストーリー:** 担当者として、内覧結果ページのカレンダー送信ボタンを押した際に、新しいタイトル形式が適用されたカレンダーイベントが生成されてほしい。

#### 受け入れ基準

1. WHEN BuyerViewingResultPage でカレンダー送信ボタンを押したとき、THE BuyerViewingResultPage SHALL 新しいタイトル形式を使用して calendarConfirmDialog の title を設定する
2. WHEN calendarConfirmDialog が表示されたとき、THE BuyerViewingResultPage SHALL 新しい形式で生成されたタイトルをタイトルフィールドの初期値として表示する
3. WHEN カレンダー登録確認ダイアログでユーザーがタイトルを手動編集したとき、THE BuyerViewingResultPage SHALL 編集後のタイトルをそのままカレンダーイベントのタイトルとして使用する
4. WHEN 直接カレンダーを開く（handleCalendarButtonClick）場合も、THE BuyerViewingResultPage SHALL 新しいタイトル形式を使用する
