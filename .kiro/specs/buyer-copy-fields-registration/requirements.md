# 要件ドキュメント

## はじめに

新規買主登録画面（`NewBuyerPage.tsx`）の基本情報セクションに「売主コピー」と「買主コピー」フィールドを追加する機能。売主の新規登録画面（`NewSellerPage.tsx`）に既に実装されている同様のフィールドを参考に、買主登録画面にも同じ仕組みを実装する。

コピーフィールドを使用した際は、問合せ元（`inquiry_source`）を自動設定することで、登録作業の効率化を図る。

## 用語集

- **NewBuyerPage**: 新規買主登録画面（`frontend/frontend/src/pages/NewBuyerPage.tsx`）
- **NewSellerPage**: 売主新規登録画面（`frontend/frontend/src/pages/NewSellerPage.tsx`）
- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **売主コピー**: 既存の売主番号を入力して、その売主の情報（氏名・電話番号・メールアドレス）を買主登録フォームにコピーするフィールド
- **買主コピー**: 既存の買主番号を入力して、その買主の情報（氏名・電話番号・メールアドレス）を買主登録フォームにコピーするフィールド
- **問合せ元（inquiry_source）**: 買主がどこから問い合わせてきたかを示すフィールド。`INQUIRY_SOURCE_OPTIONS` で定義された選択肢から選ぶ
- **2件目以降**: `inquiry_source` の選択肢の一つ（カテゴリ: その他）
- **売主**: `inquiry_source` の選択肢の一つ（カテゴリ: 売主）

## 要件

### 要件1: 売主コピーフィールドの追加

**ユーザーストーリー:** 担当者として、既存の売主情報を買主登録フォームにコピーしたい。そうすることで、売主が買主として問い合わせてきた場合に素早く登録できる。

#### 受け入れ基準

1. THE NewBuyerPage SHALL 基本情報セクションの買主番号フィールドの上に「売主コピー」Autocompleteフィールドを表示する
2. WHEN 売主コピーフィールドに2文字以上入力された場合、THE NewBuyerPage SHALL `/api/sellers/search?q=` APIを呼び出して候補一覧を表示する
3. WHEN 売主コピーの候補が選択された場合、THE NewBuyerPage SHALL `/api/sellers/by-number/{sellerNumber}` APIを呼び出して売主情報を取得する
4. WHEN 売主コピーで売主が選択された場合、THE NewBuyerPage SHALL 取得した売主の氏名・電話番号・メールアドレスを対応するフォームフィールドに自動入力する
5. WHEN 売主コピーで売主が選択された場合、THE NewBuyerPage SHALL 問合せ元（inquiry_source）を「売主」に自動設定する
6. IF 売主コピーの検索結果が0件の場合、THEN THE NewBuyerPage SHALL 「該当する売主が見つかりません」と表示する

### 要件2: 買主コピーフィールドの追加

**ユーザーストーリー:** 担当者として、既存の買主情報を新規買主登録フォームにコピーしたい。そうすることで、同じ買主が2件目以降の問い合わせをしてきた場合に素早く登録できる。

#### 受け入れ基準

1. THE NewBuyerPage SHALL 基本情報セクションの売主コピーフィールドの下（買主番号フィールドの上）に「買主コピー」Autocompleteフィールドを表示する
2. WHEN 買主コピーフィールドに2文字以上入力された場合、THE NewBuyerPage SHALL `/api/buyers/search?q=` APIを呼び出して候補一覧を表示する
3. WHEN 買主コピーの候補が選択された場合、THE NewBuyerPage SHALL `/api/buyers/{buyer_number}` APIを呼び出して買主情報を取得する
4. WHEN 買主コピーで買主が選択された場合、THE NewBuyerPage SHALL 取得した買主の氏名・電話番号・メールアドレスを対応するフォームフィールドに自動入力する
5. WHEN 買主コピーで買主が選択された場合、THE NewBuyerPage SHALL 問合せ元（inquiry_source）を「2件目以降」に自動設定する
6. IF 買主コピーの検索結果が0件の場合、THEN THE NewBuyerPage SHALL 「該当する買主が見つかりません」と表示する

### 要件3: フィールドの配置順序

**ユーザーストーリー:** 担当者として、コピーフィールドが買主番号の上に配置されていることで、登録前に素早くコピー操作を行いたい。

#### 受け入れ基準

1. THE NewBuyerPage SHALL 基本情報セクションのフィールドを以下の順序で表示する：
   1. 売主コピー
   2. 買主コピー
   3. 買主番号（自動採番）
   4. 氏名・会社名
   5. 電話番号
   6. メールアドレス
   7. 法人名
   8. 業者問合せ（法人名入力時のみ）

### 要件4: 問合せ元の自動設定ルール

**ユーザーストーリー:** 担当者として、コピー操作時に問合せ元が自動設定されることで、手動入力の手間を省きたい。

#### 受け入れ基準

1. WHEN 買主コピーで買主が選択された場合、THE NewBuyerPage SHALL 問合せ元（inquiry_source）を「2件目以降」に設定する
2. WHEN 売主コピーで売主が選択された場合、THE NewBuyerPage SHALL 問合せ元（inquiry_source）を「売主」に設定する
3. WHILE 問合せ元が自動設定された後にユーザーが手動で変更した場合、THE NewBuyerPage SHALL ユーザーが選択した値を優先して保持する
4. THE NewBuyerPage SHALL 自動設定された問合せ元の値が `INQUIRY_SOURCE_OPTIONS` に存在する有効な値であることを保証する

### 要件5: BuyerDetailPageとの同期（buyer-new-registration-sync-rule準拠）

**ユーザーストーリー:** 開発者として、新規登録画面と詳細画面のフィールド構成を一致させたい。そうすることで、登録後に詳細画面で情報を確認・編集できる。

#### 受け入れ基準

1. THE NewBuyerPage SHALL 売主コピー・買主コピーフィールドを追加する際、BuyerDetailPage.tsx の `BUYER_FIELD_SECTIONS` との整合性を維持する
2. THE NewBuyerPage SHALL 売主コピー・買主コピーはフォーム補助フィールドであり、DBに保存しない（コピー元の情報をフォームに転記するだけ）
