# 要件ドキュメント

## はじめに

買主リスト詳細画面（BuyerDetailPage）において、Pinrichフィールドの隣に「500万以上登録」フィールドを追加する機能。

このフィールドは、買主のメールアドレスが入力されており、かつ問合せ物件の価格が500万以下の買主に対してのみ表示される。表示条件を満たす場合、デフォルトで「未」が選択され、「済」に切り替えると即座にサイドバーカテゴリー「Pinrich500万以上登録未」から除外される。

---

## 用語集

- **BuyerDetailPage**: 買主リスト詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **BuyerStatusSidebar**: 買主リストのサイドバーコンポーネント（`frontend/frontend/src/components/BuyerStatusSidebar.tsx`）
- **500万以上登録フィールド**: 買主がPinrichの500万以上物件に登録済みかどうかを記録するフィールド（`pinrich_500man_registration`カラム）
- **問合せ物件価格**: 買主が問い合わせた物件の価格（`inquiry_property_price`カラム）
- **表示条件**: メールアドレスが入力されており、かつ問合せ物件の価格が500万以下であること
- **Pinrich500万以上登録未カテゴリ**: サイドバーに表示されるカテゴリ。表示条件を満たし、かつ「未」状態の買主をカウントする
- **ButtonSelect**: 「済」「未」のボタン選択UIコンポーネント
- **GAS**: Google Apps Script。スプレッドシートとデータベースの同期処理を担当

---

## 要件

### 要件1：500万以上登録フィールドの表示制御

**ユーザーストーリー：** 担当者として、メールアドレスがあり問合せ物件が500万以下の買主に対して「500万以上登録」フィールドを表示したい。そうすることで、Pinrichへの500万以上物件登録の対応漏れを防ぐことができる。

#### 受け入れ基準

1. WHILE 買主のメールアドレス（`email`）が空白でなく、かつ問合せ物件の価格（`inquiry_property_price`）が500万以下（5,000,000円以下）の場合、THE BuyerDetailPage SHALL Pinrichフィールドの隣に「500万以上登録」フィールドを表示する

2. WHILE 買主のメールアドレス（`email`）が空白の場合、THE BuyerDetailPage SHALL 「500万以上登録」フィールドを表示しない

3. WHILE 問合せ物件の価格（`inquiry_property_price`）が500万超（5,000,001円以上）の場合、THE BuyerDetailPage SHALL 「500万以上登録」フィールドを表示しない

4. THE BuyerDetailPage SHALL 「500万以上登録」フィールドをPinrichフィールドと同一行（Grid行内）に配置する

5. THE BuyerDetailPage SHALL メールアドレスまたは問合せ物件価格が変更された場合、表示条件を再評価し、フィールドの表示・非表示を即座に更新する

---

### 要件2：500万以上登録フィールドのUI

**ユーザーストーリー：** 担当者として、「済」「未」のボタン選択UIで500万以上登録状況を直感的に操作したい。そうすることで、素早く登録状況を更新できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 「500万以上登録」フィールドを「済」「未」の2択ボタン選択UI（ButtonSelect）で表示する

2. WHEN 表示条件を満たす買主の「500万以上登録」フィールドが未設定（null または 空）の場合、THE BuyerDetailPage SHALL デフォルト値として「未」を選択状態にする

3. WHEN ユーザーが「済」ボタンを選択した場合、THE BuyerDetailPage SHALL `pinrich_500man_registration` フィールドを「済」に更新する

4. WHEN ユーザーが「未」ボタンを選択した場合、THE BuyerDetailPage SHALL `pinrich_500man_registration` フィールドを「未」に更新する

5. THE BuyerDetailPage SHALL 「500万以上登録」フィールドのラベルを「500万以上登録」と表示する

---

### 要件3：Pinrich500万以上登録方法リンクの表示

**ユーザーストーリー：** 担当者として、500万以上登録フィールドが表示されたときに登録方法のリンクにすぐアクセスしたい。そうすることで、Pinrichへの登録手順を確認しながら作業できる。

#### 受け入れ基準

1. WHEN 「500万以上登録」フィールドが表示されている場合、THE BuyerDetailPage SHALL フィールドの下に「Pinrich500万以上登録方法」というリンクを表示する

2. WHEN ユーザーが「Pinrich500万以上登録方法」リンクをクリックした場合、THE BuyerDetailPage SHALL `https://docs.google.com/spreadsheets/d/14gi7bEM1jLgMGA5iOes69DbcLkcRox2vZdKiUy-4_VU/edit?usp=sharing` を新しいタブで開く

3. THE BuyerDetailPage SHALL 「Pinrich500万以上登録方法」リンクに `rel="noopener noreferrer"` 属性を付与する（セキュリティ対策）

4. WHEN 「500万以上登録」フィールドが非表示の場合、THE BuyerDetailPage SHALL 「Pinrich500万以上登録方法」リンクも表示しない

---

### 要件4：サイドバーカテゴリー「Pinrich500万以上登録未」の表示

**ユーザーストーリー：** 担当者として、Pinrich500万以上登録が未完了の買主をサイドバーで一覧確認したい。そうすることで、登録対応が必要な買主を素早く把握できる。

#### 受け入れ基準

1. THE BuyerStatusSidebar SHALL 表示条件（メールアドレスが空白でない かつ 問合せ物件価格が500万以下）を満たし、かつ `pinrich_500man_registration` が「未」または未設定（null・空）の買主数を「Pinrich500万以上登録未」カテゴリとして表示する

2. WHEN 「Pinrich500万以上登録未」カテゴリのカウントが0より大きい場合、THE BuyerStatusSidebar SHALL 「Pinrich500万以上登録未」カテゴリを赤色（#d32f2f）で表示する

3. WHEN 「Pinrich500万以上登録未」カテゴリのカウントが0の場合、THE BuyerStatusSidebar SHALL 「Pinrich500万以上登録未」カテゴリを表示しない

---

### 要件5：「済」切り替え時のサイドバーリアルタイム更新

**ユーザーストーリー：** 担当者として、「済」に切り替えた瞬間にサイドバーカテゴリーから除外されてほしい。そうすることで、対応済みの買主が即座に一覧から消え、残タスクを正確に把握できる。

#### 受け入れ基準

1. WHEN ユーザーが「500万以上登録」フィールドを「済」に変更した場合、THE BuyerDetailPage SHALL サイドバーの「Pinrich500万以上登録未」カウントを即座に減算する

2. WHEN ユーザーが「500万以上登録」フィールドを「未」に変更した場合（表示条件を満たす買主）、THE BuyerDetailPage SHALL サイドバーの「Pinrich500万以上登録未」カウントを即座に加算する

3. THE BuyerDetailPage SHALL 「済」「未」の切り替え時に、保存ボタンを押さずともサイドバーカウントをリアルタイムで更新する

---

### 要件6：データ永続化とスプレッドシート同期

**ユーザーストーリー：** 担当者として、「500万以上登録」の状態が保存・同期されてほしい。そうすることで、他の担当者も最新の登録状況を確認できる。

#### 受け入れ基準

1. WHEN 買主詳細画面の保存ボタンが押された場合、THE BuyerDetailPage SHALL `pinrich_500man_registration` フィールドの値をデータベースに保存する

2. THE GAS SHALL `pinrich_500man_registration` フィールドをスプレッドシートの対応カラムと双方向同期する

3. IF データベースへの保存が失敗した場合、THEN THE BuyerDetailPage SHALL エラーメッセージを表示し、フィールドの値を保存前の状態に戻す

---

### 要件7：GASサイドバーカウント更新

**ユーザーストーリー：** 担当者として、GASの定期同期によってサイドバーカウントが最新状態に保たれてほしい。そうすることで、画面を再読み込みしなくても正確なカウントを確認できる。

#### 受け入れ基準

1. THE GAS SHALL `updateBuyerSidebarCounts_()` 関数において、「Pinrich500万以上登録未」カテゴリのカウントを計算し、`buyer_sidebar_counts` テーブルに保存する

2. THE GAS SHALL 「Pinrich500万以上登録未」カウントの計算において、以下の条件を全て満たす買主をカウントする：
   - `email`（●メアド）が空白でない
   - `inquiry_property_price`（問合せ物件価格）が500万以下（5,000,000円以下）
   - `pinrich_500man_registration`（500万以上登録）が「未」または空白

3. THE GAS SHALL `syncBuyerList()` の実行後に `updateBuyerSidebarCounts_()` を呼び出し、カウントを更新する
