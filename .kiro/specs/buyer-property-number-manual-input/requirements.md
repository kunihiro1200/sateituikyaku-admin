# 要件ドキュメント

## はじめに

買主詳細画面（BuyerDetailPage）の物件詳細カードエリアにおいて、買主レコードの `property_number`（物件番号）が未設定の場合、担当者が手動で物件番号を入力・保存できる機能を追加する。

現状、物件番号が空の買主（例：買主番号 7360）は「紐づいた物件はありません」と表示されるだけで、後から物件番号を設定する手段が画面上に存在しない。この機能により、物件番号の後付け設定が可能になり、物件詳細カードを正常に表示できるようになる。

また、物件番号が未設定の場合でも、担当者が「他社物件情報」として自由記述形式で物件情報を入力・保存できるセクションを物件詳細カードの下に追加する。「他社物件情報」に値が入力されている場合は、物件詳細カードが空であっても代替情報として機能する。

## 用語集

- **BuyerDetailPage**: 買主詳細画面。買主の詳細情報・物件詳細カード・通話履歴などを表示するページ
- **PropertyDetailCard**: 物件詳細カード。買主詳細画面の中央列に表示される、紐づき物件の詳細情報カード
- **PropertyNumber**: 物件番号。`property_listings` テーブルの `property_number` カラムに対応する識別子（例：`AA7360`）
- **LinkedProperty**: 紐づき物件。買主レコードの `property_number` フィールドに設定された物件番号に対応する物件
- **ManualInputForm**: 物件番号手動入力フォーム。物件番号が未設定の場合に表示される入力UI
- **OtherCompanyPropertySection**: 他社物件情報セクション。物件番号が未設定の場合に物件詳細カードの下に表示される、自由記述形式の物件情報入力エリア
- **OtherCompanyPropertyInfo**: 他社物件情報。担当者が自由に入力する他社物件に関するテキスト情報
- **BuyerService**: バックエンドの買主管理サービス（`backend/src/services/BuyerService.ts`）
- **BuyersRoute**: バックエンドの買主APIルーター（`backend/src/routes/buyers.ts`）

---

## 要件

### 要件 1: 物件番号未設定時の手動入力フォーム表示

**ユーザーストーリー:** 担当者として、買主の物件番号が未設定の場合に手動入力フォームを表示してほしい。そうすることで、後から物件番号を設定して物件詳細カードを表示できるようになる。

#### 受け入れ基準

1. WHEN 買主の `property_number` が空文字または未設定の状態で BuyerDetailPage が表示される, THE ManualInputForm SHALL 物件詳細カードエリアに入力フォームを表示する
2. WHILE 買主の `property_number` に有効な値が設定されている, THE ManualInputForm SHALL 入力フォームを非表示にする
3. THE ManualInputForm SHALL テキスト入力フィールドと保存ボタンを含む
4. THE ManualInputForm SHALL 入力フィールドのプレースホルダーとして「物件番号を入力（例：AA1234）」を表示する

---

### 要件 2: 物件番号の入力バリデーション

**ユーザーストーリー:** 担当者として、無効な物件番号を誤って保存しないようにしてほしい。そうすることで、存在しない物件番号が設定されるミスを防げる。

#### 受け入れ基準

1. WHEN 担当者が空文字のまま保存ボタンを押す, THE ManualInputForm SHALL 保存処理を実行せずにエラーメッセージ「物件番号を入力してください」を表示する
2. WHEN 担当者が物件番号を入力して保存ボタンを押す, THE ManualInputForm SHALL バックエンドAPIに対して入力された物件番号が `property_listings` テーブルに存在するかを確認する
3. IF 入力された物件番号が `property_listings` テーブルに存在しない, THEN THE ManualInputForm SHALL エラーメッセージ「物件番号「{入力値}」は存在しません」を表示し保存を中止する
4. WHEN 入力された物件番号が `property_listings` テーブルに存在する, THE ManualInputForm SHALL 保存処理を続行する

---

### 要件 3: 物件番号の保存処理

**ユーザーストーリー:** 担当者として、入力した物件番号を買主レコードに保存してほしい。そうすることで、物件詳細カードが正しく表示されるようになる。

#### 受け入れ基準

1. WHEN 有効な物件番号の保存が確定する, THE BuyerDetailPage SHALL 既存の `PUT /api/buyers/:id` エンドポイントを使用して `property_number` フィールドを更新する
2. WHEN 保存が成功する, THE BuyerDetailPage SHALL `fetchLinkedProperties` を再実行して物件詳細カードを最新状態に更新する
3. WHEN 保存が成功する, THE BuyerDetailPage SHALL ManualInputForm を非表示にして物件詳細カードを表示する
4. IF 保存APIがエラーを返す, THEN THE ManualInputForm SHALL エラーメッセージ「保存に失敗しました。再度お試しください。」を表示する

---

### 要件 4: 保存中の操作制御

**ユーザーストーリー:** 担当者として、保存処理中に誤って重複送信しないようにしてほしい。そうすることで、データの二重更新を防げる。

#### 受け入れ基準

1. WHILE 保存APIリクエストが進行中である, THE ManualInputForm SHALL 保存ボタンを無効化（disabled）する
2. WHILE 保存APIリクエストが進行中である, THE ManualInputForm SHALL 保存ボタンのラベルを「保存中...」に変更する
3. WHEN 保存APIリクエストが完了する（成功・失敗問わず）, THE ManualInputForm SHALL 保存ボタンを再度有効化する

---

### 要件 5: 既存の「紐づいた物件はありません」表示との統合

**ユーザーストーリー:** 担当者として、物件番号が未設定の場合に既存の空状態メッセージの代わりに入力フォームを表示してほしい。そうすることで、操作の導線が明確になる。

#### 受け入れ基準

1. WHEN 買主の `property_number` が未設定で ManualInputForm が表示される, THE BuyerDetailPage SHALL 既存の「紐づいた物件はありません」メッセージを非表示にする
2. THE BuyerDetailPage SHALL ManualInputForm と「紐づいた物件はありません」メッセージを同時に表示しない

---

### 要件 6: 他社物件情報セクションの表示と編集

**ユーザーストーリー:** 担当者として、物件番号が未設定の買主に対して他社物件の情報を自由に入力・保存できるようにしてほしい。そうすることで、物件番号が紐づいていない場合でも物件に関する情報を管理できるようになる。

#### 受け入れ基準

1. WHEN 買主の `property_number` が未設定の状態で BuyerDetailPage が表示される, THE BuyerDetailPage SHALL 物件詳細カードの下に OtherCompanyPropertySection を表示する
2. WHILE 買主の `property_number` に有効な値が設定されている, THE BuyerDetailPage SHALL OtherCompanyPropertySection を非表示にする
3. THE OtherCompanyPropertySection SHALL 「他社物件情報」というラベルを持つ編集可能なテキストエリアを含む
4. WHEN 担当者が OtherCompanyPropertySection のテキストエリアに入力して保存ボタンを押す, THE BuyerDetailPage SHALL 既存の `PUT /api/buyers/:id` エンドポイントを使用して OtherCompanyPropertyInfo を保存する
5. WHEN OtherCompanyPropertyInfo の保存が成功する, THE OtherCompanyPropertySection SHALL 保存完了を示すフィードバックを表示する
6. IF OtherCompanyPropertyInfo の保存APIがエラーを返す, THEN THE OtherCompanyPropertySection SHALL エラーメッセージ「保存に失敗しました。再度お試しください。」を表示する
7. WHILE OtherCompanyPropertyInfo の保存APIリクエストが進行中である, THE OtherCompanyPropertySection SHALL 保存ボタンを無効化（disabled）し、ラベルを「保存中...」に変更する
8. WHEN BuyerDetailPage が表示される, THE OtherCompanyPropertySection SHALL 既存の OtherCompanyPropertyInfo をテキストエリアに表示する
9. THE BuyerService SHALL `buyers` テーブルに `other_company_property_info`（TEXT型、NULL許容）カラムを追加して OtherCompanyPropertyInfo を永続化する
